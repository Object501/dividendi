from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

from collector.dividendi_data.instruments import MarketInstrument
from collector.dividendi_data.sina import (
    futures_provider_symbol,
    parse_futures_quote,
    parse_quote_payload,
    parse_spot_quote,
    provider_symbol,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sina_quotes.txt"


class SinaQuoteParserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.quotes = parse_quote_payload(FIXTURE_PATH.read_text(encoding="utf-8"))

    def test_derives_provider_symbols(self) -> None:
        self.assertEqual(provider_symbol(MarketInstrument("000001", "测试", "SH")), "sh000001")
        self.assertEqual(futures_provider_symbol("TEST2609"), "nf_TEST2609")

    def test_parses_futures_quote(self) -> None:
        quote = parse_futures_quote(
            "nf_TEST2609",
            self.quotes["nf_TEST2609"],
            "TEST",
            "TEST2609",
        )

        self.assertEqual(quote.price, Decimal("6464"))
        self.assertEqual(quote.market_date, date(2026, 8, 28))

    def test_parses_spot_quote(self) -> None:
        instrument = MarketInstrument("600000", "测试股票", "SH")
        quote = parse_spot_quote("sh600000", self.quotes["sh600000"], instrument)

        self.assertEqual(quote.price, Decimal("10"))
        self.assertEqual(quote.name, "测试股票")
        self.assertEqual(quote.market_date, date(2026, 8, 28))

    def test_rejects_duplicate_symbols(self) -> None:
        line = 'var hq_str_sh600000="测试,1";'
        with self.assertRaisesRegex(ValueError, "重复代码"):
            parse_quote_payload(f"{line}\n{line}\n")

    def test_rejects_empty_quote(self) -> None:
        with self.assertRaisesRegex(ValueError, "未返回代码"):
            parse_quote_payload('var hq_str_sh600000="";')


if __name__ == "__main__":
    unittest.main()
