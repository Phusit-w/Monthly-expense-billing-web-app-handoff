"""Picks a project's source document (TOR/Proposal) and extracts its text.

Skips scanned/no-text-layer PDFs and anything else unreadable rather than
attempting OCR — v1 deliberately leaves those projects' description/budget
blank for manual entry instead (see PROJECT-SEARCH-GRILL-2026-09-15.md's
R2-Q3). Same library choices as ../soc-worker/worker.py (python-docx,
pypdf) for consistency, minus OCR — SOC's fallback doesn't apply here since
this v1 has no OCR path at all, not even an optional one.
"""
from __future__ import annotations

from pathlib import Path

from docx import Document
from pypdf import PdfReader

# .docx before .pdf: a TOR/proposal narrative in Word is far more likely to
# actually describe the project than a scanned or table-heavy PDF is.
PREFERRED_EXTENSIONS = (".docx", ".pdf")

# Below this character count, treat the file as having no usable text layer
# (would need OCR) — same idea as worker.py's pdf_text, minus the OCR
# fallback this v1 doesn't have.
MIN_USABLE_TEXT_LENGTH = 200


def find_source_document(project_dir: Path) -> Path | None:
    """Looks in the project folder itself and its `_TOR`/`Proposal*`
    subfolders for the most likely narrative document. Returns None if
    nothing usable is found — the crawler then leaves that project's
    AI-derived fields blank rather than guessing from an unrelated file.
    """
    if not project_dir.is_dir():
        return None

    search_dirs = [project_dir]
    for child in project_dir.iterdir():
        if child.is_dir() and child.name.lower().startswith(("_tor", "proposal")):
            search_dirs.append(child)

    candidates: list[Path] = []
    for directory in search_dirs:
        for ext in PREFERRED_EXTENSIONS:
            candidates.extend(sorted(directory.glob(f"*{ext}")))

    return candidates[0] if candidates else None


def _docx_text(path: Path) -> str:
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _pdf_text(path: Path) -> str:
    reader = PdfReader(path)
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def extract_text(path: Path) -> str | None:
    """Best-effort text extraction. Returns None on any failure (corrupt
    file, encrypted PDF, no text layer, unreadable over SMB, ...) — every
    failure mode is treated the same way: leave this project's AI fields
    blank rather than guessing, matching the "skip and leave blank" policy
    for unreadable documents.
    """
    try:
        if path.suffix.lower() == ".docx":
            text = _docx_text(path)
        elif path.suffix.lower() == ".pdf":
            text = _pdf_text(path)
        else:
            return None
    except Exception:
        return None

    return text if len(text.strip()) >= MIN_USABLE_TEXT_LENGTH else None
