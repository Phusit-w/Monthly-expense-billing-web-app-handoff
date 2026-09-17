"""Pushes discovered/summarized projects to the app's ingest API.

Runs from wherever the crawler runs (has share access, not the app server —
see ../docs/adr/0005-project-card-push-based-ingest.md), so this is a plain
HTTPS client, not a database connection.
"""
from __future__ import annotations

from dataclasses import dataclass

import requests


@dataclass
class PushResult:
    created: int
    updated: int
    skipped_verified_budget: int
    rejected: int
    errors: list[dict]


def push_projects(api_url: str, api_key: str, projects: list[dict], timeout_seconds: int = 120) -> PushResult:
    """`projects` is already in the ingest API's wire shape (folderPath,
    client, projectName, descriptionTh, descriptionEn, budgetAmount, year) —
    see lib/project-card.ts's ProjectCardInput for the authoritative shape
    this must match.
    """
    response = requests.post(
        api_url,
        json={"projects": projects},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    body = response.json()
    return PushResult(
        created=body["created"],
        updated=body["updated"],
        skipped_verified_budget=body["skippedVerifiedBudget"],
        rejected=body["rejected"],
        errors=body["errors"],
    )
