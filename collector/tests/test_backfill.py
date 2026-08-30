from __future__ import annotations

import json
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from collector.dividendi_data import CashDividend, load_instruments
from collector.dividendi_data.archive import load_history_document, publish_history_document
from collector.dividendi_data.backfill import assemble_backfilled_history, refresh_history
from collector.dividendi_data.baostock_history import HistoricalSpotClose
from collector.dividendi_data.calendar import active_contract_codes
from collector.dividendi_data.cffex_history import HistoricalFuturesClose


class HistoricalBackfillTest(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = load_instruments()
        self.sessions = (date(2026, 8, 27), date(2026, 8, 28))
        self.futures = tuple(
            HistoricalFuturesClose(product.code, contract, market_date, Decimal("6400"))
            for market_date in self.sessions
            for product in self.catalog.futures_products
            for contract in active_contract_codes(product.code, market_date)
        )
        instruments = {
            (instrument.market, instrument.code): instrument
            for instrument in (
                *(product.underlying for product in self.catalog.futures_products),
                *self.catalog.stocks,
            )
        }
        self.spots = {
            key: tuple(
                HistoricalSpotClose(
                    instrument.market,
                    instrument.code,
                    market_date,
                    Decimal("6500") if instrument.code == "000852" else Decimal("10"),
                )
                for market_date in self.sessions
            )
            for key, instrument in instruments.items()
        }
        self.dividends = {
            (stock.market, stock.code): (CashDividend(date(2026, 6, 1), Decimal("0.5")),)
            for stock in self.catalog.stocks
        }

    def test_builds_deterministic_daily_metrics(self) -> None:
        history = assemble_backfilled_history(
            self.catalog,
            self.sessions[0],
            self.sessions[-1],
            self.futures,
            self.spots,
            self.dividends,
        )

        self.assertEqual(len(history.snapshots), 2)
        self.assertEqual(history.snapshots[0].futures[0].discount_points, Decimal("100"))
        self.assertEqual(history.snapshots[0].stocks[0].dividend_yield, Decimal("0.05"))
        self.assertEqual(history.snapshots[0].fetched_at.hour, 15)
        self.assertEqual(history.snapshots[0].futures[0].source, "cffex")
        self.assertEqual(history.snapshots[0].stocks[0].price_source, "baostock")

    def test_carries_stock_close_across_suspension(self) -> None:
        first_stock = self.catalog.stocks[0]
        key = (first_stock.market, first_stock.code)
        self.spots[key] = self.spots[key][:1]

        history = assemble_backfilled_history(
            self.catalog,
            self.sessions[0],
            self.sessions[-1],
            self.futures,
            self.spots,
            self.dividends,
        )

        self.assertEqual(history.snapshots[-1].stocks[0].latest_price, Decimal("10"))

    def test_rejects_missing_active_contract(self) -> None:
        with self.assertRaisesRegex(ValueError, "中金所缺少"):
            assemble_backfilled_history(
                self.catalog,
                self.sessions[0],
                self.sessions[-1],
                self.futures[1:],
                self.spots,
                self.dividends,
            )

    def test_weekend_refresh_adds_friday_once_then_stays_idempotent(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            latest_path = root / "latest.json"
            history_path = root / "history.json"
            fixture = Path(__file__).parent / "fixtures" / "latest.json"
            latest = json.loads(fixture.read_text(encoding="utf-8"))
            latest["fetchedAt"] = "2026-08-30T10:00:00Z"
            latest_path.write_text(json.dumps(latest), encoding="utf-8")
            initial = assemble_backfilled_history(
                self.catalog,
                self.sessions[0],
                self.sessions[0],
                self.futures,
                self.spots,
                self.dividends,
            )
            publish_history_document(initial, self.catalog, history_path)

            with (
                patch(
                    "collector.dividendi_data.backfill.fetch_cffex_closes",
                    return_value=self.futures,
                ),
                patch(
                    "collector.dividendi_data.backfill.fetch_baostock_closes",
                    return_value=self.spots,
                ),
                patch(
                    "collector.dividendi_data.backfill.fetch_catalog_dividends",
                    return_value=self.dividends,
                ),
            ):
                self.assertTrue(refresh_history(latest_path, history_path))
                first_bytes = history_path.read_bytes()
                self.assertFalse(refresh_history(latest_path, history_path))
                self.assertEqual(history_path.read_bytes(), first_bytes)

            history = load_history_document(history_path, self.catalog)
            self.assertEqual(
                tuple(snapshot.market_date for snapshot in history.snapshots),
                self.sessions,
            )


if __name__ == "__main__":
    unittest.main()
