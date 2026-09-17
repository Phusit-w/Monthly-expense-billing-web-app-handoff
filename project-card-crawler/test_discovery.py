from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from discovery import find_project_folders


def _make_tree(root: Path, layout: dict) -> None:
    """layout: {relative_dir: [subfolder names]} — creates each dir with its
    listed subfolders, recursively, so tests can build a fixture share in a
    few lines instead of a long chain of mkdir calls."""
    for rel_dir, children in layout.items():
        for child in children:
            (root / rel_dir / child).mkdir(parents=True, exist_ok=True)


class FindProjectFoldersTest(unittest.TestCase):
    def test_flat_client_layout_like_mea_mof(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _make_tree(root, {
                "_Project 2026/MOF/MOFXXX_RFID": ["_TOR", "Proposal A"],
                "_Project 2026/MEA/MEAXXX_Solar Rooftop": ["Proposal A", "Scan file"],
            })
            result = find_project_folders(root)
            paths = {(p.client, p.path.name, p.year_hint) for p in result.projects}
            self.assertEqual(paths, {
                ("MOF", "MOFXXX_RFID", 2026),
                ("MEA", "MEAXXX_Solar Rooftop", 2026),
            })
            self.assertEqual(result.skipped, [])

    def test_year_nested_layout_like_nt_nbtc(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _make_tree(root, {
                "_Project 2018-2025/NT/2024/NTXXX_Fiber": ["_TOR"],
            })
            result = find_project_folders(root)
            self.assertEqual(len(result.projects), 1)
            project = result.projects[0]
            self.assertEqual(project.client, "NT")
            self.assertEqual(project.path.name, "NTXXX_Fiber")
            # Explicit year folder beats the archive name (which spans
            # 2018-2025 and can't give a single year on its own).
            self.assertEqual(project.year_hint, 2024)

    def test_multi_year_archive_has_no_year_hint_without_a_year_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _make_tree(root, {
                "_Project 2018-2025/MOF/MOFYYY_OldOne": ["_TOR"],
            })
            result = find_project_folders(root)
            self.assertEqual(result.projects[0].year_hint, None)

    def test_folder_matching_neither_pattern_is_reported_as_skipped_not_dropped_silently(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _make_tree(root, {
                "_Project 2026/MOF/some_random_folder": ["random_subfolder"],
            })
            result = find_project_folders(root)
            self.assertEqual(result.projects, [])
            self.assertEqual(len(result.skipped), 1)
            self.assertEqual(result.skipped[0].name, "some_random_folder")

    def test_project_marker_match_is_case_insensitive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _make_tree(root, {
                "_Project 2026/MEA/MEAXXX_Case": ["PROPOSAL B"],
            })
            result = find_project_folders(root)
            self.assertEqual(len(result.projects), 1)


if __name__ == "__main__":
    unittest.main()
