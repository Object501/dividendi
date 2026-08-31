from __future__ import annotations

import json
import unittest
from copy import deepcopy
from pathlib import Path

from collector.dividendi_data import load_instruments
from collector.dividendi_data.archive import (
    parse_history_document,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "snapshot.json"


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


if __name__ == "__main__":
    unittest.main()
