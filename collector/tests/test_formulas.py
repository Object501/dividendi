from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from collector.dividendi_data.formulas import (
    CashDividend,
    daily_discount_points,
    discount_points,
    implemented_dividend_per_share,
    latest_completed_fiscal_year_dividend,
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

    def test_completed_year_uses_latest_paid_annual_dividend_and_regular_payouts(self) -> None:
        dividends = (
            CashDividend(date(2025, 7, 1), Decimal("0.30"), 2024, "年度分红"),
            CashDividend(date(2025, 12, 1), Decimal("0.10"), 2025, "中期分红"),
            CashDividend(date(2026, 1, 1), Decimal("0.05"), 2025, "特别分红"),
            CashDividend(date(2026, 2, 1), Decimal("0.07"), 2025, None),
            CashDividend(date(2026, 7, 1), Decimal("0.35"), 2025, "年度分红"),
            CashDividend(date(2026, 12, 1), Decimal("0.12"), 2026, "中期分红"),
        )

        self.assertEqual(
            latest_completed_fiscal_year_dividend(dividends, date(2026, 8, 30)),
            (2025, Decimal("0.45")),
        )

    def test_completed_year_does_not_look_ahead_to_unpaid_annual_dividend(self) -> None:
        dividends = (
            CashDividend(date(2025, 7, 1), Decimal("0.30"), 2024, "年度分红"),
            CashDividend(date(2026, 7, 1), Decimal("0.35"), 2025, "年度分红"),
        )

        self.assertEqual(
            latest_completed_fiscal_year_dividend(dividends, date(2026, 6, 30)),
            (2024, Decimal("0.30")),
        )


if __name__ == "__main__":
    unittest.main()
