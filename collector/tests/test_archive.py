from __future__ import annotations

import json
import unittest
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from collector.dividendi_data import load_instruments
from collector.dividendi_data.archive import (
    load_history_document,
    parse_history_document,
    update_history,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "latest.json"


class HistoryDocumentTest(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = load_instruments()
        with FIXTURE_PATH.open(encoding="utf-8") as source:
            self.latest = json.load(source)

    def snapshot(self, market_date: str) -> dict[str, object]:
        snapshot = deepcopy(self.latest)
        snapshot["marketDate"] = market_date
        snapshot["fetchedAt"] = f"{market_date}T08:00:00Z"
        return snapshot

    def test_requires_sorted_unique_rolling_dates(self) -> None:
        history = {
            "schemaVersion": 1,
            "snapshots": [
                self.snapshot("2025-08-28"),
                self.snapshot("2025-08-29"),
                self.snapshot("2026-08-28"),
            ],
        }

        with self.assertRaisesRegex(ValueError, "超出 365 天"):
            parse_history_document(history, self.catalog)

        history["snapshots"].pop(0)
        document = parse_history_document(history, self.catalog)
        self.assertEqual(len(document.snapshots), 2)

    def test_rejects_empty_history_from_the_public_schema(self) -> None:
        with self.assertRaisesRegex(ValueError, "public-data-v1 JSON Schema"):
            parse_history_document({"schemaVersion": 1, "snapshots": []}, self.catalog)

    def test_replaces_same_day_and_preserves_earlier_snapshot(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            latest_path = root / "latest.json"
            history_path = root / "history.json"
            old = self.snapshot("2026-08-27")
            latest = self.snapshot("2026-08-28")
            latest_path.write_text(json.dumps(latest), encoding="utf-8")
            history_path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "snapshots": [old, self.snapshot("2026-08-28")],
                    }
                ),
                encoding="utf-8",
            )

            self.assertTrue(update_history(latest_path, history_path))
            history = load_history_document(history_path, self.catalog)
            self.assertEqual(
                tuple(snapshot.market_date.isoformat() for snapshot in history.snapshots),
                ("2026-08-27", "2026-08-28"),
            )

    def test_rejects_intraday_latest_snapshot(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            latest_path = root / "latest.json"
            latest = self.snapshot("2026-08-28")
            latest["fetchedAt"] = datetime(2026, 8, 28, 6, 59, tzinfo=UTC).isoformat()
            latest_path.write_text(json.dumps(latest), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "盘中行情"):
                update_history(latest_path, root / "history.json")


if __name__ == "__main__":
    unittest.main()
