"""OCR Dev E2E driver for the SOC checker.

Subcommands:
  create   insert a new QUEUED SocJob (SQL + file copy; Next server is down,
           worker is pure psycopg). Same two source docs as job cmtjm8...
  snapshot <job_id> <label>   dump every SocCheckResult verdict for the job to
           scratchpad/e2e_<label>.json + print the distribution
  requeue  <job_id>           set status back to QUEUED for an OCR re-run
  status   <job_id>           print current job status
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import sys
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

import psycopg

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DSN = dict(
    conninfo="postgresql://postgres:postgres@localhost:51218/template1",
    hostaddr="127.0.0.1", sslmode="disable", gssencmode="disable", connect_timeout=10,
)
APP = r"C:\Phusit\Claude Project\Monthly expense-billing web app-handoff\expense-billing-app"
STORAGE_ROOT = os.path.join(APP, "data", "soc")
OWNER_ID = "u2b247fa8dac90c8d459f9b5b"  # UserTest (ADMIN)
SRC = r"C:\Phusit\Claude Project\Monthly expense-billing web app-handoff\SOC model compliance\SOC + Datasheet"
SOC_DOCX = os.path.join(SRC, "SOC_เอกสาร ภาคผนวก ก._R1 (ok).docx")
DATASHEET_PDF = os.path.join(SRC, "A UTH 08 CASRI Product brochure - udon-H3C_R2(ok).pdf")
TITLE = "Udon CASRI-H3C OCR E2E 2026-09-02"
HERE = os.path.dirname(__file__)

VERDICT_COLS = [
    "keywordMatch", "ruleVerdict", "finalReferenceCheck",
    "finalHeadingTitleCheck", "finalContentRelevance", "aiConfidence",
]


def _store(job_id: str, src: str, ext: str) -> dict:
    key = f"{job_id}/{uuid.uuid4().hex}{ext}"
    dst = os.path.join(STORAGE_ROOT, *key.split("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    data = open(dst, "rb").read()
    return dict(key=key, checksum=hashlib.sha256(data).hexdigest(),
               size=len(data), name=os.path.basename(src)[:240])


def create() -> None:
    for p in (SOC_DOCX, DATASHEET_PDF):
        if not os.path.exists(p):
            sys.exit(f"missing {p}")
    job_id = "c" + uuid.uuid4().hex[:24]
    soc, ev = _store(job_id, SOC_DOCX, ".docx"), _store(job_id, DATASHEET_PDF, ".pdf")
    expires = datetime.now(timezone.utc) + timedelta(days=90)
    with psycopg.connect(**DSN) as conn:
        with conn.cursor() as cur, conn.transaction():
            cur.execute(
                'INSERT INTO "SocJob" (id,title,"ownerId",status,stage,progress,"expiresAt","createdAt","updatedAt") '
                "VALUES (%s,%s,%s,'QUEUED','รอคิวตรวจสอบ',5,%s,NOW(),NOW())",
                (job_id, TITLE, OWNER_ID, expires))
            for typ, mime, d in (
                ("SOC", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", soc),
                ("EVIDENCE", "application/pdf", ev),
            ):
                cur.execute(
                    'INSERT INTO "SocDocument" (id,"jobId",type,"originalName","storageKey","mimeType","sizeBytes",checksum,"createdAt") '
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())",
                    (uuid.uuid4().hex, job_id, typ, d["name"], d["key"], mime, d["size"], d["checksum"]))
            cur.execute(
                'INSERT INTO "SocAuditEvent" (id,"jobId","actorId",action,detail,"createdAt") '
                "VALUES (%s,%s,%s,'JOB_CREATED',%s::jsonb,NOW())",
                (uuid.uuid4().hex, job_id, OWNER_ID, json.dumps({"evidenceCount": 1, "via": "ocr-e2e-2026-09-02"})))
        conn.commit()
    print(f"JOB_ID={job_id}")


def snapshot(job_id: str, label: str) -> None:
    with psycopg.connect(**DSN) as conn, conn.cursor() as cur:
        cur.execute('SELECT status,progress,stage FROM "SocJob" WHERE id=%s', (job_id,))
        job = cur.fetchone()
        cols = ",".join(f'"{c}"' for c in VERDICT_COLS)
        cur.execute(
            f'SELECT "rowNumber","item","rowType","referenceText","referencePages",{cols},'
            f'"verdictReason","semanticEngineVersion" '
            f'FROM "SocCheckResult" WHERE "jobId"=%s ORDER BY "rowNumber"', (job_id,))
        names = [d.name for d in cur.description]
        rows = [dict(zip(names, r)) for r in cur.fetchall()]
    out = {"job_id": job_id, "label": label, "job_status": job,
           "row_count": len(rows), "rows": rows}
    path = os.path.join(HERE, f"e2e_{label}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, default=str)
    print(f"{label}: job={job[0]} {job[1]}%  rows={len(rows)}  -> {os.path.basename(path)}")
    for c in ("keywordMatch", "ruleVerdict", "finalReferenceCheck", "finalContentRelevance"):
        dist = Counter(r[c] for r in rows)
        print(f"  {c:<20} {dict(sorted(dist.items(), key=lambda x: -x[1]))}")


def requeue(job_id: str) -> None:
    with psycopg.connect(**DSN) as conn:
        conn.execute(
            'UPDATE "SocJob" SET status=\'QUEUED\', stage=\'รอคิวตรวจสอบ\', progress=5, '
            '"errorMessage"=NULL, "updatedAt"=NOW() WHERE id=%s', (job_id,))
        conn.commit()
    print(f"requeued {job_id}")


def status(job_id: str) -> None:
    with psycopg.connect(**DSN) as conn, conn.cursor() as cur:
        cur.execute('SELECT status,progress,stage,"errorMessage","updatedAt" FROM "SocJob" WHERE id=%s', (job_id,))
        print(cur.fetchone())


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "create":
        create()
    elif cmd == "snapshot":
        snapshot(sys.argv[2], sys.argv[3])
    elif cmd == "requeue":
        requeue(sys.argv[2])
    elif cmd == "status":
        status(sys.argv[2])
    else:
        sys.exit(__doc__)
