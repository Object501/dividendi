from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from collector.dividendi_data.formulas import (
    CashDividend,
    daily_discount_points,
    discount_points,
    implemented_dividend_per_share,
    trailing_dividend_yield,
)


class DiscountFormulaTest(unittest.TestCase):
    def test_positive_discount_and_negative_premium(self) -> None:
        self.assertEqual(discount_points(Decimal("6000"), Decimal("5955.2")), Decimal("44.8"))
        self.assertEqual(discount_points(Decimal("6000"), Decimal("6012")), Decimal("-12"))

    def test_daily_discount_uses_trading_days(self) -> None:
        self.assertEqual(daily_discount_points(Decimal("44.8"), 8), Decimal("5.6"))

    def test_daily_discount_rejects_expired_contract(self) -> None:
        with self.assertRaisesRegex(ValueError, "剩余交易日数必须大于零"):
            daily_discount_points(Decimal("10"), 0)


class DividendFormulaTest(unittest.TestCase):
    def test_uses_exact_trailing_365_day_window(self) -> None:
        dividends = (
            CashDividend(date(2025, 8, 30), Decimal("0.10")),
            CashDividend(date(2025, 8, 31), Decimal("0.20")),
            CashDividend(date(2026, 8, 30), Decimal("0.30")),
            CashDividend(date(2026, 8, 31), Decimal("0.40")),
        )

        self.assertEqual(
            implemented_dividend_per_share(dividends, date(2026, 8, 30)),
            Decimal("0.50"),
        )

    def test_trailing_yield_is_dividend_over_latest_price(self) -> None:
        self.assertEqual(
            trailing_dividend_yield(Decimal("0.50"), Decimal("10")),
            Decimal("0.05"),
        )

    def test_trailing_yield_rejects_nonpositive_price(self) -> None:
        with self.assertRaisesRegex(ValueError, "最近价格必须大于零"):
            trailing_dividend_yield(Decimal("0.50"), Decimal(0))


if __name__ == "__main__":
    unittest.main()
