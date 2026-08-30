from __future__ import annotations

import os
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PUBLISH_SCRIPT = REPOSITORY_ROOT / "scripts" / "publish-data-branch"
TIMESTAMP = "2026-08-30 21:30"


class PublishDataBranchTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        root = Path(self.temporary_directory.name)
        self.remote = root / "remote.git"
        self.repository = root / "repository"
        self.data = self.repository / "data"
        subprocess.run(["git", "init", "--bare", "-q", self.remote], check=True)
        subprocess.run(["git", "init", "-q", self.repository], check=True)
        subprocess.run(["git", "config", "user.name", "test"], cwd=self.repository, check=True)
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"],
            cwd=self.repository,
            check=True,
        )
        subprocess.run(
            ["git", "remote", "add", "origin", self.remote],
            cwd=self.repository,
            check=True,
        )
        self.data.mkdir()
        self.write_data(latest=1, history=1)

    def write_data(self, *, latest: int, history: int) -> None:
        (self.data / "latest.json").write_text(f'{{"value":{latest}}}\n')
        (self.data / "history.json").write_text(f'{{"value":{history}}}\n')

    def publish(self) -> subprocess.CompletedProcess[str]:
        environment = os.environ | {"DIVIDENDI_DATA_TIMESTAMP": TIMESTAMP}
        return subprocess.run(
            ["bash", PUBLISH_SCRIPT, self.data, "origin"],
            cwd=self.repository,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )

    def commit_message(self) -> str:
        result = subprocess.run(
            ["git", f"--git-dir={self.remote}", "show", "-s", "--format=%B", "data"],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()

    def test_lists_every_changed_file(self) -> None:
        self.publish()
        self.assertEqual(
            self.commit_message(),
            "\n".join(
                (
                    f"chore: update data @ {TIMESTAMP}",
                    "",
                    "Files changed:",
                    "- latest.json",
                    "- history.json",
                )
            ),
        )

        self.write_data(latest=2, history=2)
        self.publish()
        self.assertEqual(
            self.commit_message(),
            "\n".join(
                (
                    f"chore: update data @ {TIMESTAMP}",
                    "",
                    "Files changed:",
                    "- latest.json",
                    "- history.json",
                )
            ),
        )

    def test_lists_only_latest_and_skips_unchanged_data(self) -> None:
        self.publish()
        first_commit = subprocess.run(
            ["git", f"--git-dir={self.remote}", "rev-parse", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

        self.write_data(latest=2, history=1)
        self.publish()
        self.assertEqual(
            self.commit_message(),
            "\n".join(
                (
                    f"chore: update data @ {TIMESTAMP}",
                    "",
                    "Files changed:",
                    "- latest.json",
                )
            ),
        )
        changed_commit = subprocess.run(
            ["git", f"--git-dir={self.remote}", "rev-parse", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.assertNotEqual(first_commit, changed_commit)

        result = self.publish()
        self.assertEqual(result.stdout, "data unchanged\n")
        unchanged_commit = subprocess.run(
            ["git", f"--git-dir={self.remote}", "rev-parse", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.assertEqual(changed_commit, unchanged_commit)

    def test_lists_only_history(self) -> None:
        self.publish()
        self.write_data(latest=1, history=2)
        self.publish()
        self.assertEqual(
            self.commit_message(),
            "\n".join(
                (
                    f"chore: update data @ {TIMESTAMP}",
                    "",
                    "Files changed:",
                    "- history.json",
                )
            ),
        )


if __name__ == "__main__":
    unittest.main()
