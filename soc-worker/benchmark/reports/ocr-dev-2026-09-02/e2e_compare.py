"""Diff the before/after E2E snapshots + pull OCR evidence for changed rows.

    python e2e_compare.py <job_id>

Reads e2e_before_ocr_off.json + e2e_after_ocr_on.json, writes:
  - e2e_diff.json                machine-readable diff
  - e2e_diff.md                  human summary (distribution deltas + changed rows)
  - e2e_ocr_pages.json           per scanned page: fidelity, char count, text
"""
from __future__ import annotations

import io
import json
import os
import sys
from collections import Counter

import psycopg

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
HERE = os.path.dirname(__file__)
DSN = dict(conninfo="postgresql://postgres:postgres@localhost:51218/template1",
           hostaddr="127.0.0.1", sslmode="disable", gssencmode="disable", connect_timeout=10)

# scanned/thin pages in datasheet-udon-h3c-r2.pdf (pypdf < 30 normalised chars)
SCANNED = set(range(17, 21)) | set(range(101, 110)) | set(range(127, 139)) | {150, 151}
IMPROVE_TO = {"match", "pass", "better"}
COLS = ["keywordMatch", "ruleVerdict", "finalReferenceCheck", "finalHeadingTitleCheck",
        "finalContentRelevance", "aiConfidence"]


def load(label):
    with open(os.path.join(HERE, f"e2e_{label}.json"), encoding="utf-8") as f:
        d = json.load(f)
    return {r["rowNumber"]: r for r in d["rows"]}, d


def dist(rows, col):
    return dict(sorted(Counter(r[col] for r in rows.values()).items(), key=lambda x: -x[1]))


def main(job_id):
    before, bmeta = load("before_ocr_off")
    after, ameta = load("after_ocr_on")

    diff = {"job_id": job_id, "before_rows": len(before), "after_rows": len(after),
            "distribution": {}, "changed": [], "improved_to_pass_or_match": []}
    md = ["# OCR Dev E2E — before/after diff", "",
          f"job `{job_id}` · before {len(before)} rows · after {len(after)} rows", "",
          "## Distribution (before -> after)", ""]
    for c in COLS:
        b, a = dist(before, c), dist(after, c)
        diff["distribution"][c] = {"before": b, "after": a}
        keys = list(dict.fromkeys(list(b) + list(a)))
        md.append(f"**{c}**  ")
        md.append(" · ".join(f"`{k}` {b.get(k,0)}->{a.get(k,0)}"
                             + ("" if b.get(k,0) == a.get(k,0) else " **Δ%+d**" % (a.get(k,0)-b.get(k,0)))
                             for k in keys))
        md.append("")

    for rn in sorted(before):
        rb, ra = before[rn], after.get(rn)
        if not ra:
            continue
        deltas = {c: [rb[c], ra[c]] for c in COLS if rb[c] != ra[c]}
        if not deltas:
            continue
        pages = rb.get("referencePages") or []
        try:
            pages = [int(p) for p in (pages if isinstance(pages, list) else json.loads(pages))]
        except Exception:
            pages = []
        rec = {"row": rn, "item": rb["item"], "row_type": rb["rowType"],
               "reference_text": rb["referenceText"], "cited_pages": pages,
               "cites_scanned_page": bool(set(pages) & SCANNED),
               "deltas": deltas,
               "reason_before": (rb.get("verdictReason") or "")[:400],
               "reason_after": (ra.get("verdictReason") or "")[:400]}
        diff["changed"].append(rec)
        if ra["finalReferenceCheck"] in IMPROVE_TO or ra["ruleVerdict"] in IMPROVE_TO:
            if rb["finalReferenceCheck"] not in IMPROVE_TO and rb["ruleVerdict"] not in IMPROVE_TO:
                diff["improved_to_pass_or_match"].append(rn)

    md += ["## Changed rows", "",
           f"total changed: **{len(diff['changed'])}**  ·  "
           f"moved into pass/match/better (audit 100%): **{len(diff['improved_to_pass_or_match'])}**", "",
           "| row | item | cites scan? | Δ finalRef | Δ ruleVerdict | reason (after) |",
           "|--:|--|:--:|--|--|--|"]
    for r in diff["changed"]:
        fr = r["deltas"].get("finalReferenceCheck")
        rv = r["deltas"].get("ruleVerdict")
        md.append(f"| {r['row']} | {r['item']} | {'Y' if r['cites_scanned_page'] else '·'} | "
                  f"{(fr[0]+'→'+fr[1]) if fr else ''} | {(rv[0]+'→'+rv[1]) if rv else ''} | "
                  f"{r['reason_after'][:120].replace(chr(10),' ')} |")

    with open(os.path.join(HERE, "e2e_diff.json"), "w", encoding="utf-8") as f:
        json.dump(diff, f, ensure_ascii=False, indent=2)
    with open(os.path.join(HERE, "e2e_diff.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")

    # pull OCR page evidence actually used by the after run
    with psycopg.connect(**DSN) as conn, conn.cursor() as cur:
        cur.execute('SELECT "rowNumber","semanticEvidence" FROM "SocCheckResult" '
                    'WHERE "jobId"=%s ORDER BY "rowNumber"', (job_id,))
        seen = {}
        for rn, ev in cur.fetchall():
            if not ev:
                continue
            ev = ev if isinstance(ev, dict) else json.loads(ev)
            for p in ev.get("evidence", []) or []:
                pg = p.get("evidence_page") or p.get("page")
                if pg and pg not in seen:
                    seen[pg] = {"page": pg, "fidelity": p.get("fidelity"),
                                "chars": len((p.get("evidence_quote") or p.get("text") or "")),
                                "text": (p.get("evidence_quote") or p.get("text") or "")[:1200]}
    with open(os.path.join(HERE, "e2e_ocr_pages.json"), "w", encoding="utf-8") as f:
        json.dump({"pages": [seen[k] for k in sorted(seen)]}, f, ensure_ascii=False, indent=2)

    print(f"changed rows: {len(diff['changed'])}")
    print(f"improved into pass/match/better: {diff['improved_to_pass_or_match']}")
    print("finalReferenceCheck:", diff["distribution"]["finalReferenceCheck"])
    print("ruleVerdict       :", diff["distribution"]["ruleVerdict"])
    print(f"ocr/text evidence pages captured: {len(seen)}")


if __name__ == "__main__":
    main(sys.argv[1])
