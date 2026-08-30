from __future__ import annotations

import json
import unittest
from copy import deepcopy
from pathlib import Path

from collector.dividendi_data import load_instruments
from collector.dividendi_data.documents import load_latest_document, parse_latest_document

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "latest.json"


class LatestDocumentTest(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = load_instruments()
        with FIXTURE_PATH.open(encoding="utf-8") as source:
            self.raw_document = json.load(source)

    def test_loads_valid_document(self) -> None:
        document = load_latest_document(FIXTURE_PATH, self.catalog)

        self.assertEqual(document.schema_version, 1)
        self.assertEqual(len(document.stocks), len(self.catalog.stocks))
        self.assertEqual(
            {metric.product_code for metric in document.futures},
            {product.code for product in self.catalog.futures_products},
        )

    def test_rejects_inconsistent_discount(self) -> None:
        document = deepcopy(self.raw_document)
        document["futures"][0]["discountPoints"] = "35"

        with self.assertRaisesRegex(ValueError, "discountPoints 与原始行情不一致"):
            parse_latest_document(document, self.catalog)

    def test_rejects_missing_configured_stock(self) -> None:
        document = deepcopy(self.raw_document)
        document["stocks"].pop()

        with self.assertRaisesRegex(ValueError, "股票行情必须完整覆盖配置"):
            parse_latest_document(document, self.catalog)

    def test_rejects_duplicate_contract(self) -> None:
        document = deepcopy(self.raw_document)
        document["futures"].append(document["futures"][0])

        with self.assertRaisesRegex(ValueError, "期货行情中存在重复合约"):
            parse_latest_document(document, self.catalog)

    def test_rejects_fields_outside_the_public_schema(self) -> None:
        document = deepcopy(self.raw_document)
        document["unexpected"] = True

        with self.assertRaisesRegex(ValueError, "public-data-v1 JSON Schema"):
            parse_latest_document(document, self.catalog)

    def test_rejects_financial_numbers_that_are_not_strings(self) -> None:
        document = deepcopy(self.raw_document)
        document["stocks"][0]["latestPrice"] = 8

        with self.assertRaisesRegex(ValueError, "public-data-v1 JSON Schema"):
            parse_latest_document(document, self.catalog)


if __name__ == "__main__":
    unittest.main()
