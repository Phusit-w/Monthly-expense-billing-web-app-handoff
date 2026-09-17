"""Provider boundary for Project Card summarization/extraction.

Mirrors ../soc-worker/ai_provider.py's shape deliberately: same
fail-closed-by-default pattern, so a future approved provider slots in by
implementing `summarize` without touching discovery, extraction, or push
code. The production-safe default never sends document text anywhere and
returns no summary — cards it can't summarize just carry blank description/
budget/year until either a provider is wired up or a person fills them in
by hand (see CONTEXT.md's Description/Budget entries).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class SummarizeRequest:
    client: str
    project_name: str
    source_text: str


@dataclass
class SummarizeResult:
    description_th: str
    description_en: str
    budget_amount: float | None
    # Only set this when the source text states an exact year; discovery.py's
    # year_hint (derived from the folder structure itself) is preferred over
    # this when both are available — see crawler.py.
    year: int | None


class ProjectCardAiProvider(Protocol):
    def summarize(self, request: SummarizeRequest) -> SummarizeResult | None: ...


class DisabledProvider:
    def summarize(self, request: SummarizeRequest) -> SummarizeResult | None:
        return None


def build_provider() -> ProjectCardAiProvider:
    # Fail closed: unrecognised/unset values never cause document content to
    # leave this machine.
    return DisabledProvider()
