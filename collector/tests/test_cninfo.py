from __future__ import annotations

import json
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

from collector.dividendi_data.cninfo import (
    create_accept_enckey,
    parse_dividend_payload,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "cninfo_dividends.json"


class CNInfoDividendParserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def test_creates_deterministic_request_token(self) -> None:
        self.assertEqual(create_accept_enckey(1_725_000_000), "4WmSKmLaMhHqtJeRLuilMA==")

    def test_parses_paid_cash_dividends_per_share(self) -> None:
        dividends = parse_dividend_payload(self.payload, "600000")

        self.assertEqual(len(dividends), 2)
        self.assertEqual(dividends[0].implementation_date, date(2025, 12, 10))
        self.assertEqual(dividends[0].per_share, Decimal("0.152"))
        self.assertEqual(dividends[0].fiscal_year, 2025)
        self.assertEqual(dividends[0].distribution_type, "中期分红")
        self.assertEqual(dividends[1].per_share, Decimal("0.335"))
        self.assertEqual(dividends[1].fiscal_year, 2025)
        self.assertEqual(dividends[1].distribution_type, "年度分红")

    def test_ignores_non_cash_and_unpaid_plans(self) -> None:
        dividends = parse_dividend_payload(self.payload, "600000")

        self.assertNotIn(date(2025, 9, 1), {item.implementation_date for item in dividends})

    def test_rejects_invalid_records_shape(self) -> None:
        with self.assertRaisesRegex(ValueError, "records 必须是数组"):
            parse_dividend_payload({"records": None}, "600000")


if __name__ == "__main__":
    unittest.main()
