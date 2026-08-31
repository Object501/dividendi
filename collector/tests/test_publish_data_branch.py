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
        self.write_data(1)

    def write_data(self, history: int) -> None:
        (self.data / "history.json").write_text(f'{{"value":{history}}}\n')

    def publish(
        self,
        *,
        rewrite_message: bool = False,
        timestamp: str = TIMESTAMP,
    ) -> subprocess.CompletedProcess[str]:
        environment = os.environ | {"DIVIDENDI_DATA_TIMESTAMP": timestamp}
        arguments: list[str | Path] = ["bash", PUBLISH_SCRIPT]
        if rewrite_message:
            arguments.append("--rewrite-message")
        arguments.extend((self.data, "origin"))
        return subprocess.run(
            arguments,
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

    def install_legacy_latest_file(self) -> None:
        latest = self.data / "latest.json"
        latest.write_text('{"legacy":true}\n')
        entries = []
        for filename in ("history.json", "latest.json"):
            blob = subprocess.run(
                ["git", "hash-object", "-w", self.data / filename],
                cwd=self.repository,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            entries.append(f"100644 blob {blob}\t{filename}\n")
        tree = subprocess.run(
            ["git", "mktree"],
            cwd=self.repository,
            input="".join(entries),
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        commit = subprocess.run(
            ["git", "commit-tree", tree, "-m", "legacy data"],
            cwd=self.repository,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        subprocess.run(
            ["git", "push", "--force", "origin", f"{commit}:refs/heads/data"],
            cwd=self.repository,
            check=True,
            capture_output=True,
        )

    def test_lists_history_and_skips_unchanged_data(self) -> None:
        self.publish()
        expected = "\n".join(
            (
                f"chore: update data @ {TIMESTAMP}",
                "",
                "Files changed:",
                "- history.json",
            )
        )
        self.assertEqual(self.commit_message(), expected)

        first_commit = subprocess.run(
            ["git", f"--git-dir={self.remote}", "rev-parse", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.assertEqual(self.publish().stdout, "data unchanged\n")

        self.write_data(2)
        self.publish()
        self.assertEqual(self.commit_message(), expected)
        changed_commit = subprocess.run(
            ["git", f"--git-dir={self.remote}", "rev-parse", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.assertNotEqual(first_commit, changed_commit)

    def test_can_rewrite_only_the_root_commit_message(self) -> None:
        self.publish()
        first_tree = subprocess.run(
            ["git", f"--git-dir={self.remote}", "show", "-s", "--format=%T", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

        rewritten_timestamp = "2026-08-30 21:31"
        self.publish(rewrite_message=True, timestamp=rewritten_timestamp)
        rewritten_tree = subprocess.run(
            ["git", f"--git-dir={self.remote}", "show", "-s", "--format=%T", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

        self.assertEqual(first_tree, rewritten_tree)
        self.assertEqual(
            self.commit_message(),
            "\n".join(
                (
                    f"chore: update data @ {rewritten_timestamp}",
                    "",
                    "Files changed:",
                    "- history.json",
                )
            ),
        )

    def test_removes_a_legacy_latest_file_without_republishing_it(self) -> None:
        self.publish()
        self.install_legacy_latest_file()

        self.publish()

        files = subprocess.run(
            ["git", f"--git-dir={self.remote}", "ls-tree", "--name-only", "data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.splitlines()
        self.assertEqual(files, ["history.json"])
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


if __name__ == "__main__":
    unittest.main()
