from __future__ import annotations

import json
import unittest
from copy import deepcopy

from collector.dividendi_data import load_instruments, parse_instruments
from collector.dividendi_data.instruments import CATALOG_PATH


class InstrumentCatalogTest(unittest.TestCase):
    def setUp(self) -> None:
        with CATALOG_PATH.open(encoding="utf-8") as source:
            self.raw_catalog = json.load(source)

    def test_loads_repository_catalog(self) -> None:
        catalog = load_instruments()

        self.assertEqual(catalog.schema_version, self.raw_catalog["schemaVersion"])
        self.assertEqual(len(catalog.futures_products), len(self.raw_catalog["futuresProducts"]))
        self.assertEqual(len(catalog.stocks), len(self.raw_catalog["stocks"]))

    def test_rejects_duplicate_stocks(self) -> None:
        raw_catalog = deepcopy(self.raw_catalog)
        raw_catalog["stocks"] = [raw_catalog["stocks"][0], raw_catalog["stocks"][0]]

        with self.assertRaisesRegex(ValueError, "stocks 中存在重复标的"):
            parse_instruments(raw_catalog)

    def test_rejects_unknown_schema_version(self) -> None:
        raw_catalog = {**self.raw_catalog, "schemaVersion": 2}

        with self.assertRaisesRegex(ValueError, "不支持的标的配置版本"):
            parse_instruments(raw_catalog)


if __name__ == "__main__":
    unittest.main()
