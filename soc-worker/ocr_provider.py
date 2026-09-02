"""On-prem OCR boundary for scanned SOC evidence pages.

OCR is fail-closed and disabled by default. Set SOC_OCR_PROVIDER=tesseract
after installing the Tesseract binary plus Thai and English language packs.
No document content is sent over the network.

Optional tuning (all have safe defaults; used by the Dev OCR benchmark and to
lock a chosen configuration without a code change):

- SOC_TESSERACT_CMD  explicit path to tesseract(.exe); else PATH, else a few
                     well-known Windows install dirs are probed.
- SOC_OCR_DPI        render resolution, default 180 (fitz zoom = DPI / 72).
- SOC_OCR_PSM        Tesseract page-segmentation mode, default 6.
- SOC_OCR_LANG       language string, default "tha+eng".
"""
from __future__ import annotations

import os

_WINDOWS_TESSERACT_DIRS = (
    r"C:\Program Files\Tesseract-OCR",
    r"C:\Program Files (x86)\Tesseract-OCR",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR"),
)


def _resolve_tesseract_cmd() -> str | None:
    """Explicit override, then PATH, then known Windows install locations."""
    explicit = os.environ.get("SOC_TESSERACT_CMD", "").strip()
    if explicit:
        return explicit
    from shutil import which

    found = which("tesseract")
    if found:
        return found
    for directory in _WINDOWS_TESSERACT_DIRS:
        candidate = os.path.join(directory, "tesseract.exe")
        if os.path.isfile(candidate):
            return candidate
    return None


def _ocr_settings() -> tuple[float, str, str]:
    try:
        dpi = float(os.environ.get("SOC_OCR_DPI", "180") or "180")
    except ValueError:
        dpi = 180.0
    psm = (os.environ.get("SOC_OCR_PSM", "6") or "6").strip()
    lang = (os.environ.get("SOC_OCR_LANG", "tha+eng") or "tha+eng").strip()
    return dpi, psm, lang


def ocr_pdf_page(pdf_path, page_index: int) -> str | None:
    provider = os.environ.get("SOC_OCR_PROVIDER", "disabled").strip().lower()
    if provider in {"", "disabled"}:
        return None
    if provider != "tesseract":
        raise ValueError(f"unsupported SOC_OCR_PROVIDER: {provider}")

    # Lazy imports keep native-text extraction working when OCR dependencies
    # are intentionally absent from a server.
    try:
        import pymupdf as fitz
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "SOC_OCR_PROVIDER=tesseract requires pymupdf, pytesseract and Pillow"
        ) from exc

    cmd = _resolve_tesseract_cmd()
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd

    dpi, psm, lang = _ocr_settings()
    zoom = dpi / 72.0

    document = fitz.open(pdf_path)
    try:
        page = document.load_page(page_index)
        try:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            image = Image.frombytes(
                "RGB", (pixmap.width, pixmap.height), pixmap.samples
            )
        except Exception:
            # Fail closed: a page we cannot rasterise (e.g. an unsupported
            # colorspace) stays unverifiable rather than silently empty.
            return None
        text = pytesseract.image_to_string(image, lang=lang, config=f"--psm {psm}")
        normalized = " ".join(text.split())
        return normalized or None
    finally:
        document.close()
