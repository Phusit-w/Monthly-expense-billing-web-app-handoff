"""Dump full claim + OCR evidence for a set of rows so a human can adjudicate."""
from __future__ import annotations

import io
import json
import sys

import psycopg

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
DSN = dict(conninfo="postgresql://postgres:postgres@localhost:51218/template1",
           hostaddr="127.0.0.1", sslmode="disable", gssencmode="disable", connect_timeout=10)
JOB = "c713156543b944fa6b176c0ee"
rows = [int(x) for x in sys.argv[1:]] or [217, 250, 273, 274, 281, 276]

with psycopg.connect(**DSN) as conn, conn.cursor() as cur:
    cur.execute(
        'SELECT "rowNumber","item","socText","referenceText","referencePages",'
        '"ruleVerdict","finalReferenceCheck","verdictReason","semanticEvidence" '
        'FROM "SocCheckResult" WHERE "jobId"=%s AND "rowNumber"=ANY(%s) ORDER BY "rowNumber"',
        (JOB, rows))
    for rn, item, soc, ref, pages, rv, fr, reason, ev in cur.fetchall():
        print("=" * 100)
        print(f"ROW {rn}  item {item}   ->  ruleVerdict={rv}  finalRef={fr}")
        print(f"CITED: {ref!r}  pages={pages}")
        print(f"\nCLAIM:\n{soc}")
        print(f"\nENGINE REASON:\n{reason}")
        ev = ev if isinstance(ev, dict) else json.loads(ev or "{}")
        q = ev.get("quantities") or []
        if q:
            print("\nQUANTITIES:")
            for x in q:
                print("  ", json.dumps(x, ensure_ascii=False)[:300])
        print("\nEVIDENCE PAGES:")
        for p in ev.get("evidence", []) or []:
            print(f"  -- p.{p.get('evidence_page') or p.get('page')}  fidelity={p.get('fidelity')}  "
                  f"class={p.get('evidence_class')}")
            print("     quote:", (p.get("evidence_quote") or "")[:600])
        # full page text for context
        for p in ev.get("pages", []) or ev.get("evidence", []) or []:
            t = p.get("text")
            if t:
                print(f"\n  FULL p.{p.get('page') or p.get('evidence_page')} text ({len(t)} ch):\n{t[:1500]}")
        print()
