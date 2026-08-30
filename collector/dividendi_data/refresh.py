"""Assemble and publish the current website data document."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from contextlib import suppress
from dataclasses import replace
from datetime import UTC, date, datetime, time
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from .calendar import cffex_expiry, remaining_trading_days
from .cninfo import CNINFO_SOURCE, fetch_catalog_dividends
from .documents import (
    FuturesMetric,
    LatestDocument,
    StockMetric,
    atomic_write_json,
    load_latest_document,
    parse_latest_document,
)
from .formulas import (
    CashDividend,
    daily_discount_points,
    discount_points,
    implemented_dividend_per_share,
    latest_completed_fiscal_year_dividend,
    trailing_dividend_yield,
)
from .instruments import InstrumentCatalog, load_instruments
from .sina import SINA_SOURCE, CurrentQuotes, fetch_current_quotes

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = Path(os.environ.get("DIVIDENDI_DATA_DIR", REPOSITORY_ROOT / ".data"))
DEFAULT_LATEST_PATH = DEFAULT_DATA_DIR / "latest.json"
SHANGHAI = ZoneInfo("Asia/Shanghai")
MARKET_CLOSE = time(15)


def _contract_expiry(product_code: str, contract_code: str) -> date:
    suffix = contract_code.removeprefix(product_code)
    if len(suffix) != 4 or not suffix.isdigit():
        raise ValueError(f"期货合约代码 {contract_code} 无法解析到期月份")
    year = 2000 + int(suffix[:2])
    month = int(suffix[2:])
    if not 1 <= month <= 12:
        raise ValueError(f"期货合约代码 {contract_code} 的月份无效")
    return cffex_expiry(year, month)


def assemble_latest_document(
    catalog: InstrumentCatalog,
    quotes: CurrentQuotes,
    dividends: Mapping[tuple[str, str], tuple[CashDividend, ...]] | None,
    *,
    intraday: bool,
    previous: LatestDocument | None = None,
) -> LatestDocument:
    """Combine provider results into one deterministic, validated document."""

    market_dates = {
        *(quote.market_date for quote in quotes.futures),
        *(quote.market_date for quote in quotes.underlyings),
        *(quote.market_date for quote in quotes.stocks),
    }
    if len(market_dates) != 1:
        raise ValueError("组装行情的市场日期不一致")
    if quotes.fetched_at.tzinfo is None or quotes.fetched_at.utcoffset() is None:
        raise ValueError("抓取时间必须包含时区")
    market_date = market_dates.pop()

    underlyings = {(quote.market, quote.code): quote for quote in quotes.underlyings}
    products = {product.code: product for product in catalog.futures_products}
    futures: list[FuturesMetric] = []
    for quote in quotes.futures:
        product = products.get(quote.product_code)
        if product is None:
            raise ValueError(f"行情包含未配置期货品种 {quote.product_code}")
        underlying = underlyings.get((product.underlying.market, product.underlying.code))
        if underlying is None:
            raise ValueError(f"行情缺少 {quote.product_code} 的标的指数")
        expiry = _contract_expiry(product.code, quote.contract_code)
        remaining = remaining_trading_days(market_date, expiry, intraday=intraday)
        if remaining == 0:
            continue
        points = discount_points(underlying.price, quote.price)
        futures.append(
            FuturesMetric(
                product_code=product.code,
                contract_code=quote.contract_code,
                expiry_date=expiry,
                index_level=underlying.price,
                futures_price=quote.price,
                discount_points=points,
                remaining_trading_days=remaining,
                daily_discount_points=daily_discount_points(points, remaining),
                source=SINA_SOURCE,
            )
        )

    stock_quotes = {(quote.market, quote.code): quote for quote in quotes.stocks}
    previous_stocks = (
        {(metric.market, metric.code): metric for metric in previous.stocks}
        if previous is not None and previous.market_date == market_date
        else {}
    )
    stocks: list[StockMetric] = []
    for stock in catalog.stocks:
        key = (stock.market, stock.code)
        quote = stock_quotes.get(key)
        if quote is None:
            raise ValueError(f"行情缺少股票 {stock.market}:{stock.code}")
        if dividends is not None:
            if key not in dividends:
                raise ValueError(f"分红数据缺少股票 {stock.market}:{stock.code}")
            dividend_per_share = implemented_dividend_per_share(dividends[key], market_date)
            completed = latest_completed_fiscal_year_dividend(dividends[key], market_date)
            completed_year = None if completed is None else completed[0]
            completed_dividend = None if completed is None else completed[1]
            dividend_source = CNINFO_SOURCE
        else:
            cached = previous_stocks.get(key)
            if cached is None:
                raise ValueError(f"缓存分红缺少股票 {stock.market}:{stock.code}")
            dividend_per_share = cached.implemented_dividend_per_share
            completed_year = cached.completed_fiscal_year
            completed_dividend = cached.completed_fiscal_year_dividend_per_share
            dividend_source = cached.dividend_source
        stocks.append(
            StockMetric(
                market=stock.market,
                code=stock.code,
                latest_price=quote.price,
                implemented_dividend_per_share=dividend_per_share,
                dividend_yield=trailing_dividend_yield(dividend_per_share, quote.price),
                price_source=SINA_SOURCE,
                dividend_source=dividend_source,
                completed_fiscal_year=completed_year,
                completed_fiscal_year_dividend_per_share=completed_dividend,
                completed_fiscal_year_dividend_yield=(
                    None
                    if completed_dividend is None
                    else trailing_dividend_yield(completed_dividend, quote.price)
                ),
            )
        )

    document = LatestDocument(
        schema_version=1,
        market_date=market_date,
        fetched_at=quotes.fetched_at,
        futures=tuple(futures),
        stocks=tuple(stocks),
    )
    parse_latest_document(latest_document_json(document), catalog)
    return document


def _decimal_string(value: Decimal) -> str:
    return format(value, "f")


def _completed_fiscal_year_json(metric: StockMetric) -> dict[str, object]:
    if metric.completed_fiscal_year is None:
        return {}
    if (
        metric.completed_fiscal_year_dividend_per_share is None
        or metric.completed_fiscal_year_dividend_yield is None
    ):
        raise ValueError("完整财年分红字段必须同时提供")
    return {
        "completedFiscalYear": metric.completed_fiscal_year,
        "completedFiscalYearDividendPerShare": _decimal_string(
            metric.completed_fiscal_year_dividend_per_share
        ),
        "completedFiscalYearDividendYield": _decimal_string(
            metric.completed_fiscal_year_dividend_yield
        ),
    }


def latest_document_json(document: LatestDocument) -> dict[str, object]:
    """Convert a latest document to its stable public JSON representation."""

    if document.fetched_at.tzinfo is None or document.fetched_at.utcoffset() is None:
        raise ValueError("抓取时间必须包含时区")
    fetched_at = document.fetched_at.astimezone(UTC).isoformat().replace("+00:00", "Z")
    return {
        "schemaVersion": document.schema_version,
        "marketDate": document.market_date.isoformat(),
        "fetchedAt": fetched_at,
        "futures": [
            {
                "productCode": metric.product_code,
                "contractCode": metric.contract_code,
                "expiryDate": metric.expiry_date.isoformat(),
                "indexLevel": _decimal_string(metric.index_level),
                "futuresPrice": _decimal_string(metric.futures_price),
                "discountPoints": _decimal_string(metric.discount_points),
                "remainingTradingDays": metric.remaining_trading_days,
                "dailyDiscountPoints": _decimal_string(metric.daily_discount_points),
                "source": metric.source,
            }
            for metric in document.futures
        ],
        "stocks": [
            {
                "market": metric.market,
                "code": metric.code,
                "latestPrice": _decimal_string(metric.latest_price),
                "implementedDividendPerShare": _decimal_string(
                    metric.implemented_dividend_per_share
                ),
                "dividendYield": _decimal_string(metric.dividend_yield),
                "priceSource": metric.price_source,
                "dividendSource": metric.dividend_source,
                **_completed_fiscal_year_json(metric),
            }
            for metric in document.stocks
        ],
    }


def publish_latest_document(
    document: LatestDocument,
    catalog: InstrumentCatalog,
    path: Path = DEFAULT_LATEST_PATH,
) -> bool:
    """Validate and atomically replace latest data only when values changed."""

    raw_document = latest_document_json(document)
    parse_latest_document(raw_document, catalog)
    if path.exists():
        try:
            with path.open(encoding="utf-8") as source:
                previous = parse_latest_document(json.load(source), catalog)
        except ValueError:
            previous = None
        if previous is not None and replace(previous, fetched_at=document.fetched_at) == document:
            return False

    return atomic_write_json(raw_document, path)


def is_intraday_snapshot(fetched_at: datetime, market_date: date) -> bool:
    """Return whether the same-day snapshot still has a trading session left."""

    if fetched_at.tzinfo is None or fetched_at.utcoffset() is None:
        raise ValueError("抓取时间必须包含时区")
    local_time = fetched_at.astimezone(SHANGHAI)
    return local_time.date() == market_date and local_time.time() < MARKET_CLOSE


def refresh_latest(
    output: Path = DEFAULT_LATEST_PATH,
    *,
    fetched_at: datetime | None = None,
) -> bool:
    """Refresh quotes, fetching dividends at most once per market date."""

    now = datetime.now(UTC) if fetched_at is None else fetched_at
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("抓取时间必须包含时区")
    catalog = load_instruments()
    previous = None
    if output.exists():
        with suppress(OSError, ValueError):
            previous = load_latest_document(output, catalog)
    quotes = fetch_current_quotes(catalog, now.astimezone(SHANGHAI).date(), now)
    market_dates = {
        *(quote.market_date for quote in quotes.futures),
        *(quote.market_date for quote in quotes.underlyings),
        *(quote.market_date for quote in quotes.stocks),
    }
    reuse_dividends = (
        previous is not None and len(market_dates) == 1 and previous.market_date in market_dates
    )
    dividends = None if reuse_dividends else fetch_catalog_dividends(catalog)
    market_date = quotes.futures[0].market_date
    document = assemble_latest_document(
        catalog,
        quotes,
        dividends,
        intraday=is_intraday_snapshot(now, market_date),
        previous=previous if reuse_dividends else None,
    )
    return publish_latest_document(document, catalog, output)
