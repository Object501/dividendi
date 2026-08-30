from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date

from collector.dividendi_data.history import retain_rolling_window


@dataclass(frozen=True)
class Snapshot:
    market_date: date
    value: int


class RollingHistoryTest(unittest.TestCase):
    def test_keeps_exact_365_day_window_and_sorts(self) -> None:
        snapshots = (
            Snapshot(date(2026, 8, 30), 3),
            Snapshot(date(2025, 8, 30), 1),
            Snapshot(date(2025, 8, 31), 2),
        )

        retained = retain_rolling_window(snapshots, lambda snapshot: snapshot.market_date)

        self.assertEqual(
            retained,
            (
                Snapshot(date(2025, 8, 31), 2),
                Snapshot(date(2026, 8, 30), 3),
            ),
        )

    def test_rejects_duplicate_market_dates(self) -> None:
        snapshots = (
            Snapshot(date(2026, 8, 30), 1),
            Snapshot(date(2026, 8, 30), 2),
        )

        with self.assertRaisesRegex(ValueError, "历史数据中存在重复交易日"):
            retain_rolling_window(snapshots, lambda snapshot: snapshot.market_date)

    def test_accepts_empty_history(self) -> None:
        self.assertEqual(retain_rolling_window((), lambda snapshot: snapshot.market_date), ())

    def test_rejects_nonpositive_window(self) -> None:
        with self.assertRaisesRegex(ValueError, "历史数据保留窗口必须大于零"):
            retain_rolling_window((), lambda snapshot: snapshot.market_date, window_days=0)


if __name__ == "__main__":
    unittest.main()
