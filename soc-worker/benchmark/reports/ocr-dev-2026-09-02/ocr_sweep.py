"""C2 config sweep: DPI x PSM x lang on representative scanned pages.

Drives the real ocr_provider.ocr_pdf_page code path via env vars so the
winning config can be locked in .env with no further code change.
Writes a JSON + Markdown summary to the scratchpad.
"""
from __future__ import annotations

import io
import json
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(__file__)
APP = r"C:\Phusit\Claude Project\Monthly expense-billing web app-handoff\expense-billing-app"
sys.path.insert(0, os.path.join(APP, "soc-worker"))
os.environ["SOC_OCR_PROVIDER"] = "tesseract"

PDF = os.path.join(APP, "tmp", "e2e-fixtures", "datasheet-udon-h3c-r2.pdf")

# 1-based pages, representative of each scanned cluster (17-20 / 101-109 / 127-138 / 150-151)
PAGES = [17, 18, 20, 102, 105, 108, 128, 133, 137, 150, 151]
DPIS = [180, 300]
PSMS = ["6", "3", "4"]
LANGS = ["tha+eng", "eng"]

THAI_RANGE = range(0x0E00, 0x0E7F)


def thai_frac(s: str) -> float:
    if not s:
        return 0.0
    th = sum(1 for c in s if ord(c) in THAI_RANGE)
    al = sum(1 for c in s if c.isalpha())
    return th / al if al else 0.0


def run():
    from ocr_provider import ocr_pdf_page

    rows = []
    for dpi in DPIS:
        for psm in PSMS:
            for lang in LANGS:
                os.environ["SOC_OCR_DPI"] = str(dpi)
                os.environ["SOC_OCR_PSM"] = psm
                os.environ["SOC_OCR_LANG"] = lang
                per_page = []
                t0 = time.time()
                for pg in PAGES:
                    s = time.time()
                    txt = ocr_pdf_page(PDF, pg - 1)
                    per_page.append({
                        "page": pg,
                        "secs": round(time.time() - s, 2),
                        "chars": len(txt) if txt else 0,
                        "thai_frac": round(thai_frac(txt or ""), 3),
                        "sample": (txt or "")[:200],
                    })
                total = round(time.time() - t0, 1)
                chars = [p["chars"] for p in per_page]
                rows.append({
                    "dpi": dpi, "psm": psm, "lang": lang,
                    "total_secs": total,
                    "secs_per_page": round(total / len(PAGES), 2),
                    "min_chars": min(chars), "median_chars": sorted(chars)[len(chars) // 2],
                    "max_chars": max(chars),
                    "pages_over_200_chars": sum(1 for c in chars if c > 200),
                    "mean_thai_frac": round(sum(p["thai_frac"] for p in per_page) / len(per_page), 3),
                    "per_page": per_page,
                })
                print(f"dpi={dpi} psm={psm} lang={lang:8s} | {total:6.1f}s "
                      f"{total/len(PAGES):4.1f}s/pg | chars min/med/max "
                      f"{min(chars):5d}/{sorted(chars)[len(chars)//2]:5d}/{max(chars):5d} "
                      f"| >200ch {sum(1 for c in chars if c > 200):2d}/{len(PAGES)} "
                      f"| thai {sum(p['thai_frac'] for p in per_page)/len(per_page):.2f}")

    out = {
        "pdf": os.path.basename(PDF),
        "pages": PAGES,
        "grid": {"dpi": DPIS, "psm": PSMS, "lang": LANGS},
        "results": rows,
    }
    with open(os.path.join(HERE, "ocr_sweep_result.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\nwrote ocr_sweep_result.json")


if __name__ == "__main__":
    run()
