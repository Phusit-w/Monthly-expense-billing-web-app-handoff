# SOC OCR — Dev benchmark, 2026-09-02

E2E on Dev (DB `localhost:51218/template1`). Continues job
`cmtjm8gyd0003qofehpfh68t5`. **Production untouched. Auto-pass OFF. No row
confirmed on a human's behalf. Nothing committed.**

New A/B job: `c713156543b944fa6b176c0ee` — "Udon CASRI-H3C OCR E2E 2026-09-02",
same two source docs as `cmtjm8…`, left `NEEDS_REVIEW` (0/327 reviewed).

---

## 1. What changed (working tree only — NOT committed)

| file | change | why |
|---|---|---|
| `soc-worker/requirements.txt` | `pymupdf==1.26.4 → 1.28.2`; `Pillow==11.3.0 → 12.3.0` | 1.28.2 is what's installed; `import fitz` is deprecated there. Pillow 11.3 pin silently **downgraded** the machine's global Pillow 12.3 and broke `pdfplumber` — bumped back. |
| `soc-worker/ocr_provider.py` | `import fitz` → `import pymupdf as fitz`; add `SOC_TESSERACT_CMD` + Windows auto-discovery; add `SOC_OCR_DPI` / `SOC_OCR_PSM` / `SOC_OCR_LANG` (defaults unchanged: 180 / 6 / `tha+eng`); wrap `get_pixmap` in fail-closed try/except (colorspace) | portability to prod (`C:\Program Files\Tesseract-OCR`), let the sweep drive the real code path, lock a config via `.env` with no further edit, ADR-SOC-HUMAN-REVIEW fail-closed |
| `.env` (Dev only) | add `SOC_OCR_PROVIDER=tesseract` + `SOC_TESSERACT_CMD=…` | enable OCR on Dev after `tesseract --list-langs` confirmed `tha`+`eng` |

Validation: `py_compile` OK · `python -m unittest soc-worker/test_worker.py` **8/8**
· `tsc --noEmit` clean · (`eslint` shows a large pre-existing problem count,
unrelated — Python-only change).

Toolchain installed on the Dev machine (global Python 3.12, no venv — matches
the box): `pytesseract 0.3.13`, `Pillow 12.3.0`, `pymupdf 1.28.2`;
**Tesseract 5.4.0** via `winget install UB-Mannheim.TesseractOCR` →
`C:\Users\phusit.w\AppData\Local\Programs\Tesseract-OCR`; `tha.traineddata` +
`eng.traineddata` from **tessdata_best** dropped into `…/tessdata/` (winget
ships only `eng`+`osd`).

---

## 2. OCR config sweep (`ocr_sweep_result.json`)

11 representative scanned pages (one per cluster + spares), grid
DPI {180, 300} × PSM {6, 3, 4} × lang {`tha+eng`, `eng`}.

| finding | detail |
|---|---|
| DPI | 300 gives **no** yield gain (median chars 1082 vs 1085 @ 180) and is 30–60 % slower. |
| PSM | 6 ≥ 3 ≈ 4 on median chars; 6 is the default. |
| lang | `tha+eng` vs `eng`: near-identical char count. **`thai_frac` ≈ 0.00–0.02 for every config** — the CASRI-H3C brochure's scanned pages are English (ISO certs, ATEN/Samsung/Apple spec tables), not Thai. |

**Winning config = DPI 180 · PSM 6 · lang `tha+eng` = the existing
`ocr_provider.py` defaults.** No code change to defaults. `.env` left at
defaults.

> Caveat: `tha+eng` on English-only scans injects Thai-glyph noise
> (`า10พ2๓`, `ดู1506`). Harmless here (load-bearing numbers/codes/phrases
> survive), but a real Thai-scan job (PEA085) is *not* exercised by this
> fixture. Per-job or auto language selection is a future improvement, not
> done here.

---

## 3. Before / After — job `c713156543b944fa6b176c0ee`, 327 rows

Fresh **OCR-off** run first (`e2e_before_ocr_off.json`) — reproduced
`cmtjm8…` **exactly** (327 rows, identical every column), so the delta is
purely the `SOC_OCR_PROVIDER` flip. Then `.env` flipped, **same job**
re-queued (`e2e_after_ocr_on.json`).

| `finalReferenceCheck` | before | after | Δ |
|---|--:|--:|--:|
| match | 151 | 156 | **+5** |
| review | 137 | 156 | **+19** |
| **unverifiable** | **25** | **0** | **−25** |
| not_found | 11 | 11 | 0 |
| mismatch | 3 | 4 | +1 |

| `ruleVerdict` | before | after | Δ |
|---|--:|--:|--:|
| pass | 150 | 155 | +5 |
| needs_review | 137 | 156 | +19 |
| insufficient_evidence | 36 | 11 | −25 |
| conflict | 3 | 4 | +1 |
| better | 1 | 1 | 0 |

`keywordMatch` unverifiable 27 → 1. Baseline `cmtjm8…` had unverifiable 25
(`finalReferenceCheck`) — matched exactly by the OCR-off run.

**Reading:** exactly the ADR-SOC-AUTO-PASS-POLICY shape — `unverifiable`
collapses, most of it (19) lands in `needs_review` (reviewer still opens the
row, but now with real evidence text + a page to jump to), a handful (5) reach
`pass`/`match`, one surfaces a `conflict`. **Total human review load did not
fall this round** (review 137 → 156). That is the intended trade-off.

---

## 4. Verdict-change audit (`e2e_diff.md`, `e2e_audit` dumps)

27 rows changed verdict. **0 false passes.**

### moved into `pass`/`match` — audited 100 % (5)

| row | item | claim | evidence (OCR, cited page) | call |
|--:|---|---|---|---|
| 217 | ๔.๕.5 | KVM switch, **8 ports**, rack | p.109 `KVM Ports 8 x SPHD-…` (clean) | **OK** — count 8=8 on clean OCR; prose parts (touchpad) still a reviewer check |
| 250 | ๔.๗.๔.๑ | **85-inch** screen | p.127 `85" Standalone Signage QMC … 85"`, model `LH85QMCEBGCXXT` (clean) | **OK** — 85″ genuinely on the cited page |
| 273 | 4.8.1.1 | 9-core CPU / 3 P + 6 E cores | p.133 `9-core CPU with 3 super cores and 6 efficiency cores` (verbatim) | **OK** |
| 274 | 4.8.1.2 | 10-core GPU | p.133 `…-10-core GPU…` (verbatim, x2) | **OK** |
| 281 | 4.8.1.9 | Magic Keyboard for iPad Pro 11-inch | p.138 `Magic Keyboard for iPad Pro 11-inch - Tech Specs` (verbatim) | **OK** |

### new `conflict` — audited (1)

| row | item | claim | evidence | call |
|--:|---|---|---|---|
| 276 | 4.8.1.4 | capacity **512GB** | p.132 OCR `Capacity 256GB` | **borderline-false-conflict** — the family *does* offer 512 GB (p.133 OCR: "Models with 256GB or 512GB storage"); the bidder cited the 256 GB base-model page. Flagged for the human = safe direction, not a policy breach. |

### `unverifiable → needs_review` (21) — 20 % sample audited (rows 50, 213, 278, 285)

All four: OCR text on the cited page is **real and on-topic** (LRQA ISO-14001
cert; rack "Standard Width 600mm"; "Face ID Enabled by TrueDepth camera";
iPad battery/IO page). Engine held them at `needs_review` for sound reasons
(partial OCR, standard-code parsed as a number, prose-only). Correct
conservative direction.

---

## 5. OCR yield (`ocr_yield.json`)

27 scanned pages OCR'd directly (worker uses the same path). "usable" =
≥ 120 chars and ≥ 55 % latin+digits.

| cluster | pages | raw text back | usable | mean s/page |
|---|--:|--:|--:|--:|
| 17–20 | 4 | 4/4 | 4/4 | 3.7 |
| 101–109 | 9 | 9/9 | 9/9 | 3.2 |
| 127–138 | 12 | 12/12 | 12/12 | 2.3 |
| 150–151 | 2 | 1/2 | 1/2 | 2.0 |
| **total** | **27** | **26/27** | **26/27** | **2.8** (≈ 75 s) |

The one miss (**p.150**, 27 chars) is a full-page graphic with no real text —
not a colorspace failure. It correctly stays `unverifiable` for any row citing
it (none in this SOC).

**`unknown colorspace: R##`** (MuPDF, stderr): fires on many pages in the
101–160 range but pymupdf **still rasterises them** (p.101 → 2 992 chars, etc.).
The new fail-closed `try/except` around `get_pixmap` never triggered. Warnings
are cosmetic here; the guard remains as insurance.

---

## 6. Limitations / not done

- **Thai OCR path unexercised** — this datasheet's scans are English. PEA085 /
  NT_IX_DWDM (real Thai scans) not run.
- **Gold set has 0 OCR rows** (`SOC-ACCURACY-ACCEPTANCE.md §2` wants ≥ 15) —
  `run.py` still can't report `ocr_yield`. Belongs to `feature/soc-gold-expansion`.
- `tha+eng` glyph noise on English scans (see §2 caveat).
- rule_semantic still parses standard codes ("ISO 14001", "802.3") as
  quantities → over-conservative `needs_review` (row 50). Pre-existing.
- Nothing committed; `.env` OCR flag is Dev-only.

---

## 7. To take OCR to production (checklist — do NOT do here)

1. `rule_semantic` clears `SOC-ACCURACY-ACCEPTANCE.md` on a ≥ 300-row real gold
   set (`conflict_recall` currently 0.0 — blocked, see `[[expense-billing-admin-soc-wip]]`).
2. Merge admin + SOC + semantic + these OCR edits from
   `codex-wip/admin-soc-2026-08-28` → `main` (nothing is merged today).
3. Fix `update.ps1` / NSSM 2.24 + permanent dev Postgres (see `[[expense-billing-deploy]]`).
4. `prisma migrate deploy` on prod — 3 pending migrations incl.
   `20260902090000_add_soc_semantic_results`.
5. On the prod server: install Tesseract + `tha`+`eng` (tessdata_best),
   set `SOC_OCR_PROVIDER=tesseract` (+ `SOC_TESSERACT_CMD` if not on PATH) in
   the **prod** `.env`. `.env.production.example` already documents the knob.
6. Deploy via `update.ps1`; smoke-test one scanned-page job; keep auto-pass OFF.

---

## Artifacts (scratchpad — not committed)

`ocr_sweep.py` · `ocr_sweep_result.json` · `e2e_job.py` · `e2e_compare.py` ·
`e2e_audit.py` · `e2e_before_ocr_off.json` · `e2e_after_ocr_on.json` ·
`e2e_baseline_cmtjm8.json` · `e2e_diff.json` · `e2e_diff.md` ·
`e2e_ocr_pages.json` · `ocr_yield.json` · `row250_pages.txt`
