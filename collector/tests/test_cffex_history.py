from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from io import BytesIO
from zipfile import ZipFile

from collector.dividendi_data.cffex_history import archive_months, parse_cffex_archive


def archive_fixture() -> bytes:
    output = BytesIO()
    with ZipFile(output, "w") as archive:
        archive.writestr(
            "20260828_1.csv",
            "合约代码,今收盘\nIM2609,7666.6\nIM2610,7605.6\nIO2609,100\n小计,--\n".encode(
                "gb18030"
            ),
        )
        archive.writestr(
            "20260831_1.csv",
            "合约代码,今收盘\nIM2609,7700\n".encode("gb18030"),
        )
    return output.getvalue()


class CffexHistoryParserTest(unittest.TestCase):
    def test_lists_inclusive_archive_months(self) -> None:
        self.assertEqual(
            archive_months(date(2025, 12, 1), date(2026, 2, 1)),
            ("202512", "202601", "202602"),
        )

    def test_parses_only_configured_products_and_dates(self) -> None:
        closes = parse_cffex_archive(
            archive_fixture(),
            date(2026, 8, 28),
            date(2026, 8, 28),
            ("IM",),
        )

        self.assertEqual(len(closes), 2)
        self.assertEqual(closes[0].contract_code, "IM2609")
        self.assertEqual(closes[0].close, Decimal("7666.6"))

    def test_rejects_invalid_zip(self) -> None:
        with self.assertRaisesRegex(ValueError, "有效 ZIP"):
            parse_cffex_archive(
                b"invalid",
                date(2026, 8, 1),
                date(2026, 8, 31),
                ("IM",),
            )


if __name__ == "__main__":
    unittest.main()
