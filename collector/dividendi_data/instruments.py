"""Load the instrument catalog shared with the TypeScript application."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

CATALOG_PATH: Final = Path(__file__).resolve().parents[2] / "config" / "instruments.json"


@dataclass(frozen=True, slots=True)
class MarketInstrument:
    code: str
    name: str
    market: str


@dataclass(frozen=True, slots=True)
class FuturesProduct:
    code: str
    name: str
    exchange: str
    underlying: MarketInstrument


@dataclass(frozen=True, slots=True)
class InstrumentCatalog:
    schema_version: int
    futures_products: tuple[FuturesProduct, ...]
    stocks: tuple[MarketInstrument, ...]


def _mapping(value: object, path: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{path} 必须是对象")
    return value


def _required_string(value: Mapping[str, object], key: str, path: str) -> str:
    field = value.get(key)
    if not isinstance(field, str) or not field.strip():
        raise ValueError(f"{path}.{key} 必须是非空字符串")
    return field


def _market_instrument(value: object, path: str) -> MarketInstrument:
    record = _mapping(value, path)
    return MarketInstrument(
        code=_required_string(record, "code", path),
        name=_required_string(record, "name", path),
        market=_required_string(record, "market", path),
    )


def _futures_product(value: object, path: str) -> FuturesProduct:
    record = _mapping(value, path)
    return FuturesProduct(
        code=_required_string(record, "code", path),
        name=_required_string(record, "name", path),
        exchange=_required_string(record, "exchange", path),
        underlying=_market_instrument(record.get("underlying"), f"{path}.underlying"),
    )


def _nonempty_list(value: object, path: str) -> list[object]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{path} 必须包含至少一个标的")
    return value


def _assert_unique(values: tuple[str, ...], path: str) -> None:
    if len(set(values)) != len(values):
        raise ValueError(f"{path} 中存在重复标的")


def parse_instruments(value: object) -> InstrumentCatalog:
    """Validate and convert decoded JSON into the collector's immutable catalog."""

    record = _mapping(value, "标的配置")
    if record.get("schemaVersion") != 1:
        raise ValueError("不支持的标的配置版本")

    futures_products = tuple(
        _futures_product(product, f"futuresProducts[{index}]")
        for index, product in enumerate(
            _nonempty_list(record.get("futuresProducts"), "futuresProducts")
        )
    )
    stocks = tuple(
        _market_instrument(stock, f"stocks[{index}]")
        for index, stock in enumerate(_nonempty_list(record.get("stocks"), "stocks"))
    )

    _assert_unique(
        tuple(f"{product.exchange}:{product.code}" for product in futures_products),
        "futuresProducts",
    )
    _assert_unique(tuple(f"{stock.market}:{stock.code}" for stock in stocks), "stocks")

    return InstrumentCatalog(
        schema_version=1,
        futures_products=futures_products,
        stocks=stocks,
    )


def load_instruments(path: Path = CATALOG_PATH) -> InstrumentCatalog:
    """Read and validate the shared repository instrument catalog."""

    with path.open(encoding="utf-8") as source:
        return parse_instruments(json.load(source))
