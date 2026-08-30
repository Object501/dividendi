"""Validate JSON documents exchanged between the collector and website."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from .formulas import daily_discount_points, discount_points, trailing_dividend_yield
from .instruments import InstrumentCatalog


@dataclass(frozen=True, slots=True)
class FuturesMetric:
    product_code: str
    contract_code: str
    expiry_date: date
    index_level: Decimal
    futures_price: Decimal
    discount_points: Decimal
    remaining_trading_days: int
    daily_discount_points: Decimal
    source: str


@dataclass(frozen=True, slots=True)
class StockMetric:
    market: str
    code: str
    latest_price: Decimal
    implemented_dividend_per_share: Decimal
    dividend_yield: Decimal
    price_source: str
    dividend_source: str


@dataclass(frozen=True, slots=True)
class LatestDocument:
    schema_version: int
    market_date: date
    fetched_at: datetime
    futures: tuple[FuturesMetric, ...]
    stocks: tuple[StockMetric, ...]


def _mapping(value: object, path: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{path} 必须是对象")
    return value


def _list(value: object, path: str) -> list[object]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{path} 必须是非空数组")
    return value


def _string(record: Mapping[str, object], key: str, path: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{path}.{key} 必须是非空字符串")
    return value


def _date(record: Mapping[str, object], key: str, path: str) -> date:
    value = _string(record, key, path)
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{path}.{key} 必须是 ISO 日期") from error


def _timestamp(record: Mapping[str, object], key: str, path: str) -> datetime:
    value = _string(record, key, path)
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{path}.{key} 必须是 ISO 时间") from error
    if timestamp.tzinfo is None:
        raise ValueError(f"{path}.{key} 必须包含时区")
    return timestamp


def _decimal(record: Mapping[str, object], key: str, path: str) -> Decimal:
    value = record.get(key)
    if not isinstance(value, str):
        raise ValueError(f"{path}.{key} 必须是十进制字符串")
    try:
        number = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"{path}.{key} 必须是十进制字符串") from error
    if not number.is_finite():
        raise ValueError(f"{path}.{key} 必须是有限数值")
    return number


def _positive_integer(record: Mapping[str, object], key: str, path: str) -> int:
    value = record.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ValueError(f"{path}.{key} 必须是正整数")
    return value


def _futures_metric(value: object, path: str, market_date: date) -> FuturesMetric:
    record = _mapping(value, path)
    metric = FuturesMetric(
        product_code=_string(record, "productCode", path),
        contract_code=_string(record, "contractCode", path),
        expiry_date=_date(record, "expiryDate", path),
        index_level=_decimal(record, "indexLevel", path),
        futures_price=_decimal(record, "futuresPrice", path),
        discount_points=_decimal(record, "discountPoints", path),
        remaining_trading_days=_positive_integer(record, "remainingTradingDays", path),
        daily_discount_points=_decimal(record, "dailyDiscountPoints", path),
        source=_string(record, "source", path),
    )
    if metric.expiry_date < market_date:
        raise ValueError(f"{path}.expiryDate 不能早于行情日期")
    if metric.index_level <= 0 or metric.futures_price <= 0:
        raise ValueError(f"{path} 的指数和期货价格必须大于零")
    if metric.discount_points != discount_points(metric.index_level, metric.futures_price):
        raise ValueError(f"{path}.discountPoints 与原始行情不一致")
    if metric.daily_discount_points != daily_discount_points(
        metric.discount_points, metric.remaining_trading_days
    ):
        raise ValueError(f"{path}.dailyDiscountPoints 与贴水和剩余交易日不一致")
    return metric


def _stock_metric(value: object, path: str) -> StockMetric:
    record = _mapping(value, path)
    metric = StockMetric(
        market=_string(record, "market", path),
        code=_string(record, "code", path),
        latest_price=_decimal(record, "latestPrice", path),
        implemented_dividend_per_share=_decimal(record, "implementedDividendPerShare", path),
        dividend_yield=_decimal(record, "dividendYield", path),
        price_source=_string(record, "priceSource", path),
        dividend_source=_string(record, "dividendSource", path),
    )
    if metric.latest_price <= 0:
        raise ValueError(f"{path}.latestPrice 必须大于零")
    if metric.implemented_dividend_per_share < 0:
        raise ValueError(f"{path}.implementedDividendPerShare 不能为负数")
    if metric.dividend_yield != trailing_dividend_yield(
        metric.implemented_dividend_per_share, metric.latest_price
    ):
        raise ValueError(f"{path}.dividendYield 与分红和价格不一致")
    return metric


def parse_latest_document(value: object, catalog: InstrumentCatalog) -> LatestDocument:
    """Validate a decoded latest-data document against the instrument catalog."""

    record = _mapping(value, "latest")
    if record.get("schemaVersion") != 1:
        raise ValueError("不支持的行情数据版本")

    market_date = _date(record, "marketDate", "latest")
    futures = tuple(
        _futures_metric(metric, f"futures[{index}]", market_date)
        for index, metric in enumerate(_list(record.get("futures"), "futures"))
    )
    stocks = tuple(
        _stock_metric(metric, f"stocks[{index}]")
        for index, metric in enumerate(_list(record.get("stocks"), "stocks"))
    )

    configured_products = {product.code for product in catalog.futures_products}
    if {metric.product_code for metric in futures} != configured_products:
        raise ValueError("期货行情没有完整覆盖配置品种")
    contract_codes = tuple(metric.contract_code for metric in futures)
    if len(set(contract_codes)) != len(contract_codes):
        raise ValueError("期货行情中存在重复合约")

    configured_stocks = tuple((stock.market, stock.code) for stock in catalog.stocks)
    document_stocks = tuple((stock.market, stock.code) for stock in stocks)
    if document_stocks != configured_stocks:
        raise ValueError("股票行情必须完整覆盖配置并保持相同顺序")

    return LatestDocument(
        schema_version=1,
        market_date=market_date,
        fetched_at=_timestamp(record, "fetchedAt", "latest"),
        futures=futures,
        stocks=stocks,
    )


def load_latest_document(path: Path, catalog: InstrumentCatalog) -> LatestDocument:
    """Read and validate a latest-data JSON document."""

    with path.open(encoding="utf-8") as source:
        return parse_latest_document(json.load(source), catalog)
