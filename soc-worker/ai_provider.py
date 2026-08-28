"""Provider boundary for semantic SOC review.

The production-safe default never sends document content anywhere. A future
approved local or external provider implements `review` and is selected by
SOC_AI_PROVIDER without changing extraction, queueing, or export code.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ReviewRequest:
    row_type: str
    soc_text: str
    reference_text: str
    page_texts: list[str]


class SocAiProvider(Protocol):
    def review(self, request: ReviewRequest) -> dict | None: ...


class DisabledProvider:
    def review(self, request: ReviewRequest) -> dict | None:
        return None


def build_provider() -> SocAiProvider:
    # Fail closed: unrecognised values never cause files to leave the server.
    return DisabledProvider()
