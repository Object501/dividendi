from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from collector.dividendi_data.baostock_history import (
    baostock_code,
    parse_baostock_rows,
)
from collector.dividendi_data.instruments import MarketInstrument


class BaoStockHistoryParserTest(unittest.TestCase):
    def setUp(self) -> None:
        self.instrument = MarketInstrument("600000", "测试股票", "SH")

    def test_derives_provider_code(self) -> None:
        self.assertEqual(baostock_code(self.instrument), "sh.600000")

    def test_parses_unadjusted_trading_closes(self) -> None:
        closes = parse_baostock_rows(
            [
                ["2026-08-27", "sh.600000", "9.95", "1"],
                ["2026-08-28", "sh.600000", "10.00", "1"],
            ],
            self.instrument,
        )

        self.assertEqual(len(closes), 2)
        self.assertEqual(closes[-1].market_date, date(2026, 8, 28))
        self.assertEqual(closes[-1].close, Decimal("10.00"))

    def test_ignores_suspended_rows_for_carry_forward(self) -> None:
        closes = parse_baostock_rows(
            [
                ["2026-08-27", "sh.600000", "9.95", "1"],
                ["2026-08-28", "sh.600000", "", "0"],
            ],
            self.instrument,
        )

        self.assertEqual(len(closes), 1)

    def test_rejects_unexpected_symbol(self) -> None:
        with self.assertRaisesRegex(ValueError, "意外代码"):
            parse_baostock_rows(
                [["2026-08-28", "sh.600001", "10", "1"]],
                self.instrument,
            )


if __name__ == "__main__":
    unittest.main()
