"""Orchestrates one crawl: discover folders -> extract text -> summarize ->
build ingest payloads. Kept free of network/CLI concerns (see main.py and
push_client.py) so it's testable with a temp-directory fixture and a fake
AI provider, no live share or server required.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ai_provider import ProjectCardAiProvider, SummarizeRequest
from discovery import ProjectFolder, find_project_folders
from extract_text import extract_text, find_source_document


@dataclass
class CrawlStats:
    total_projects: int
    summarized: int
    skipped_folders: list[Path]


def build_payload(project: ProjectFolder, provider: ProjectCardAiProvider) -> dict:
    """Builds one project's ingest payload (see lib/project-card.ts's
    ProjectCardInput for the wire shape this must match). AI summarization
    failure — no source document, an unreadable one, or a disabled provider
    — degrades to blank description/budget rather than dropping the
    project: client/projectName/folderPath are always known from the
    folder structure alone, so the card is still worth creating half-empty.
    """
    source_doc = find_source_document(project.path)
    text = extract_text(source_doc) if source_doc else None

    summary = None
    if text:
        summary = provider.summarize(SummarizeRequest(client=project.client, project_name=project.path.name, source_text=text))

    return {
        "folderPath": str(project.path),
        "client": project.client,
        "projectName": project.path.name,
        "descriptionTh": summary.description_th if summary else "",
        "descriptionEn": summary.description_en if summary else "",
        "budgetAmount": summary.budget_amount if summary else None,
        # Structural evidence (an explicit year folder, or a single-year
        # archive name — see discovery.py) beats whatever the AI thinks it
        # read off the page; it's only consulted when structure gives no hint.
        "year": project.year_hint if project.year_hint is not None else (summary.year if summary else None),
    }


def crawl(ps_root: Path, provider: ProjectCardAiProvider) -> tuple[list[dict], CrawlStats]:
    discovery = find_project_folders(ps_root)
    payloads = [build_payload(project, provider) for project in discovery.projects]
    summarized = sum(1 for p in payloads if p["descriptionTh"] or p["descriptionEn"])
    stats = CrawlStats(total_projects=len(discovery.projects), summarized=summarized, skipped_folders=discovery.skipped)
    return payloads, stats
