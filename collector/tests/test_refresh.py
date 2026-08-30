from __future__ import annotations

import unittest
from dataclasses import replace
from datetime import UTC, date, datetime, time
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

from collector.dividendi_data import CashDividend, load_instruments, load_latest_document
from collector.dividendi_data.refresh import (
    assemble_latest_document,
    is_intraday_snapshot,
    publish_latest_document,
)
from collector.dividendi_data.sina import CurrentQuotes, FuturesQuote, SpotQuote


class LatestRefreshTest(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = load_instruments()
        market_date = date(2026, 8, 28)
        fetched_at = datetime(2026, 8, 28, 7, 5, tzinfo=UTC)
        product = self.catalog.futures_products[0]
        self.quotes = CurrentQuotes(
            fetched_at=fetched_at,
            futures=(
                FuturesQuote(
                    product.code,
                    "IM2609",
                    Decimal("6464"),
                    market_date,
                    time(14, 59),
                ),
            ),
            underlyings=(
                SpotQuote(
                    product.underlying.market,
                    product.underlying.code,
                    product.underlying.name,
                    Decimal("6500"),
                    market_date,
                    time(14, 59),
                ),
            ),
            stocks=tuple(
                SpotQuote(
                    stock.market,
                    stock.code,
                    stock.name,
                    Decimal("10"),
                    market_date,
                    time(14, 59),
                )
                for stock in self.catalog.stocks
            ),
        )
        self.dividends = {
            (stock.market, stock.code): (
                CashDividend(date(2025, 8, 28), Decimal("1")),
                CashDividend(date(2025, 8, 29), Decimal("0.2")),
                CashDividend(date(2026, 8, 28), Decimal("0.3")),
                CashDividend(date(2026, 8, 29), Decimal("9")),
            )
            for stock in self.catalog.stocks
        }

    def test_assembles_exact_formulas_and_trailing_dividends(self) -> None:
        document = assemble_latest_document(
            self.catalog,
            self.quotes,
            self.dividends,
            intraday=False,
        )

        self.assertEqual(document.futures[0].discount_points, Decimal("36"))
        self.assertEqual(document.stocks[0].implemented_dividend_per_share, Decimal("0.5"))
        self.assertEqual(document.stocks[0].dividend_yield, Decimal("0.05"))

    def test_publishes_atomically_only_for_changed_values(self) -> None:
        document = assemble_latest_document(
            self.catalog,
            self.quotes,
            self.dividends,
            intraday=False,
        )
        with TemporaryDirectory() as directory:
            output = Path(directory) / "data" / "latest.json"
            self.assertTrue(publish_latest_document(document, self.catalog, output))
            original = output.read_bytes()
            self.assertEqual(load_latest_document(output, self.catalog), document)

            later = replace(
                document,
                fetched_at=datetime(2026, 8, 28, 8, 5, tzinfo=UTC),
            )
            self.assertFalse(publish_latest_document(later, self.catalog, output))
            self.assertEqual(output.read_bytes(), original)

    def test_replaces_data_that_no_longer_matches_the_catalog(self) -> None:
        document = assemble_latest_document(
            self.catalog,
            self.quotes,
            self.dividends,
            intraday=False,
        )
        with TemporaryDirectory() as directory:
            output = Path(directory) / "latest.json"
            output.write_text('{"schemaVersion": 1}', encoding="utf-8")

            self.assertTrue(publish_latest_document(document, self.catalog, output))
            self.assertEqual(load_latest_document(output, self.catalog), document)

    def test_detects_intraday_snapshot_before_market_close(self) -> None:
        market_date = date(2026, 8, 28)
        self.assertTrue(
            is_intraday_snapshot(
                datetime(2026, 8, 28, 6, 59, tzinfo=UTC),
                market_date,
            )
        )
        self.assertFalse(
            is_intraday_snapshot(
                datetime(2026, 8, 28, 7, 0, tzinfo=UTC),
                market_date,
            )
        )


if __name__ == "__main__":
    unittest.main()
