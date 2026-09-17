"""Finds project folders under the `PS` share's `_Project *` archive roots.

See ../app/(app)/project-card/CONTEXT.md for the domain glossary and
PROJECT-SEARCH-GRILL-2026-09-15.md (repo root) for why the layout is
inconsistent across clients: MEA/MOF put project folders directly under the
client folder, NT/NBTC nest a year folder in between. Detection has to
handle both without being told upfront which layout a given client uses.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# A project folder is recognised by containing at least one of these
# (case-insensitive prefix match) — matches Round 1 Q2's recommendation:
# auto-detect via subfolder pattern rather than requiring every project to
# be hand-marked. Folders that match neither this nor the year-folder shape
# below are skipped and reported, not guessed at.
PROJECT_MARKER_PREFIXES = ("_tor", "proposal", "scan file", "บทที่")

MIN_YEAR_FOLDER = 2000
MAX_YEAR_FOLDER = 2100


@dataclass(frozen=True)
class ProjectFolder:
    client: str
    path: Path
    # Known only when the share's own folder structure states it outright
    # (a `_Project 2026`-style single-year archive, or an explicit year
    # folder like NT's `2024`) — never guessed. None means the extraction
    # step must fall back to whatever the AI provider can find in the
    # source document, or leave it blank for manual entry.
    year_hint: int | None


@dataclass(frozen=True)
class DiscoveryResult:
    projects: list[ProjectFolder]
    # Client subfolders that matched neither the project-marker heuristic
    # nor the year-folder shape — surfaced so a human can look at them
    # rather than silently dropping folders that don't fit either pattern.
    skipped: list[Path]


def _archive_year_hint(archive_name: str) -> int | None:
    # "_Project 2026" -> 2026. "_Project 2018-2025" spans multiple years,
    # so no single hint can be derived from the archive name alone.
    suffix = archive_name.removeprefix("_Project").strip()
    if suffix.isdigit() and len(suffix) == 4:
        return int(suffix)
    return None


def _year_folder_value(name: str) -> int | None:
    if not (name.isdigit() and len(name) == 4):
        return None
    year = int(name)
    if MIN_YEAR_FOLDER <= year <= MAX_YEAR_FOLDER:
        return year
    return None


def _looks_like_project(folder: Path) -> bool:
    try:
        children = [child.name.lower() for child in folder.iterdir() if child.is_dir()]
    except OSError:
        return False
    return any(name.startswith(marker) for name in children for marker in PROJECT_MARKER_PREFIXES)


def find_project_folders(ps_root: Path) -> DiscoveryResult:
    """Walk every `_Project *` archive directly under `ps_root`.

    Each archive's immediate subfolders are clients (MEA, PEA, MOF, NT, ...).
    Under a client, a subfolder is either a project itself (MEA/MOF-style)
    or a year that contains projects (NT/NBTC-style) — which one applies is
    detected per client folder, not assumed globally, since it differs by
    client and nothing in the share states it explicitly.
    """
    projects: list[ProjectFolder] = []
    skipped: list[Path] = []

    for archive_root in sorted(p for p in ps_root.glob("_Project *") if p.is_dir()):
        archive_year_hint = _archive_year_hint(archive_root.name)
        for client_dir in sorted(p for p in archive_root.iterdir() if p.is_dir()):
            client = client_dir.name
            for candidate in sorted(p for p in client_dir.iterdir() if p.is_dir()):
                year_folder_value = _year_folder_value(candidate.name)
                if year_folder_value is not None:
                    for project_dir in sorted(p for p in candidate.iterdir() if p.is_dir()):
                        projects.append(ProjectFolder(client=client, path=project_dir, year_hint=year_folder_value))
                elif _looks_like_project(candidate):
                    projects.append(ProjectFolder(client=client, path=candidate, year_hint=archive_year_hint))
                else:
                    skipped.append(candidate)

    return DiscoveryResult(projects=projects, skipped=skipped)
