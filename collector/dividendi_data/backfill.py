"""Reconstruct the rolling historical metrics from official EOD sources."""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from .archive import DEFAULT_HISTORY_PATH, HistoryDocument, publish_history_document
from .baostock_history import (
    BAOSTOCK_HISTORY_SOURCE,
    HistoricalSpotClose,
    fetch_baostock_closes,
)
from .calendar import active_contract_codes, cffex_expiry, remaining_trading_days, trading_sessions
from .cffex_history import (
    CFFEX_HISTORY_SOURCE,
    HistoricalFuturesClose,
    fetch_cffex_closes,
)
from .cninfo import CNINFO_SOURCE, fetch_catalog_dividends
from .documents import (
    FuturesMetric,
    LatestDocument,
    StockMetric,
    load_latest_document,
    parse_latest_document,
)
from .formulas import (
    CashDividend,
    daily_discount_points,
    discount_points,
    implemented_dividend_per_share,
    trailing_dividend_yield,
)
from .instruments import InstrumentCatalog, load_instruments
from .refresh import DEFAULT_LATEST_PATH, SHANGHAI, latest_document_json


@dataclass(frozen=True, slots=True)
class BackfillResult:
    changed: bool
    snapshot_count: int
    start: date
    end: date


def _contract_expiry(product_code: str, contract_code: str) -> date:
    suffix = contract_code.removeprefix(product_code)
    if len(suffix) != 4 or not suffix.isdigit():
        raise ValueError(f"期货合约代码 {contract_code} 无法解析到期月份")
    month = int(suffix[2:])
    if not 1 <= month <= 12:
        raise ValueError(f"期货合约代码 {contract_code} 的月份无效")
    return cffex_expiry(2000 + int(suffix[:2]), month)


def _spot_close_on_or_before(
    closes: tuple[HistoricalSpotClose, ...],
    market_date: date,
    key: tuple[str, str],
    *,
    exact: bool,
) -> Decimal:
    dates = tuple(item.market_date for item in closes)
    index = bisect_right(dates, market_date) - 1
    if index < 0 or (exact and dates[index] != market_date):
        qualifier = "当日" if exact else "此前"
        raise ValueError(f"BaoStock 缺少 {key[0]}:{key[1]} {market_date} {qualifier}收盘价")
    return closes[index].close


def assemble_backfilled_history(
    catalog: InstrumentCatalog,
    start: date,
    end: date,
    futures_closes: tuple[HistoricalFuturesClose, ...],
    spot_closes: Mapping[tuple[str, str], tuple[HistoricalSpotClose, ...]],
    dividends: Mapping[tuple[str, str], tuple[CashDividend, ...]],
) -> HistoryDocument:
    """Build deterministic EOD documents for every trading session."""

    sessions = trading_sessions(start, end)
    if not sessions:
        raise ValueError("历史回填区间没有交易日")
    futures_by_key = {(item.market_date, item.contract_code): item for item in futures_closes}
    if len(futures_by_key) != len(futures_closes):
        raise ValueError("中金所历史收盘包含重复合约日期")

    snapshots: list[LatestDocument] = []
    for market_date in sessions:
        futures_metrics: list[FuturesMetric] = []
        for product in catalog.futures_products:
            underlying_key = (product.underlying.market, product.underlying.code)
            if underlying_key not in spot_closes:
                raise ValueError(f"BaoStock 缺少标的指数 {underlying_key}")
            index_level = _spot_close_on_or_before(
                spot_closes[underlying_key],
                market_date,
                underlying_key,
                exact=True,
            )
            for contract_code in active_contract_codes(product.code, market_date):
                close = futures_by_key.get((market_date, contract_code))
                if close is None:
                    raise ValueError(f"中金所缺少 {contract_code} 在 {market_date} 的收盘价")
                expiry = _contract_expiry(product.code, contract_code)
                remaining = remaining_trading_days(market_date, expiry, intraday=False)
                if remaining == 0:
                    continue
                points = discount_points(index_level, close.close)
                futures_metrics.append(
                    FuturesMetric(
                        product_code=product.code,
                        contract_code=contract_code,
                        expiry_date=expiry,
                        index_level=index_level,
                        futures_price=close.close,
                        discount_points=points,
                        remaining_trading_days=remaining,
                        daily_discount_points=daily_discount_points(points, remaining),
                        source=CFFEX_HISTORY_SOURCE,
                    )
                )

        stock_metrics: list[StockMetric] = []
        for stock in catalog.stocks:
            key = (stock.market, stock.code)
            if key not in spot_closes:
                raise ValueError(f"BaoStock 缺少股票 {stock.market}:{stock.code}")
            if key not in dividends:
                raise ValueError(f"巨潮分红缺少股票 {stock.market}:{stock.code}")
            latest_price = _spot_close_on_or_before(
                spot_closes[key],
                market_date,
                key,
                exact=False,
            )
            dividend_per_share = implemented_dividend_per_share(dividends[key], market_date)
            stock_metrics.append(
                StockMetric(
                    market=stock.market,
                    code=stock.code,
                    latest_price=latest_price,
                    implemented_dividend_per_share=dividend_per_share,
                    dividend_yield=trailing_dividend_yield(dividend_per_share, latest_price),
                    price_source=BAOSTOCK_HISTORY_SOURCE,
                    dividend_source=CNINFO_SOURCE,
                )
            )

        snapshot = LatestDocument(
            schema_version=1,
            market_date=market_date,
            fetched_at=datetime.combine(market_date, time(15), SHANGHAI),
            futures=tuple(futures_metrics),
            stocks=tuple(stock_metrics),
        )
        parse_latest_document(latest_document_json(snapshot), catalog)
        snapshots.append(snapshot)
    return HistoryDocument(schema_version=1, snapshots=tuple(snapshots))


def backfill_history(
    latest_path: Path = DEFAULT_LATEST_PATH,
    history_path: Path = DEFAULT_HISTORY_PATH,
    *,
    window_days: int = 365,
) -> BackfillResult:
    """Fetch and atomically publish a complete trailing historical window."""

    if window_days <= 0:
        raise ValueError("历史回填窗口必须大于零")
    catalog = load_instruments()
    end = load_latest_document(latest_path, catalog).market_date
    cutoff = end - timedelta(days=window_days)
    start = cutoff + timedelta(days=1)
    product_codes = tuple(product.code for product in catalog.futures_products)
    futures_closes = fetch_cffex_closes(start, end, product_codes)
    spot_closes = fetch_baostock_closes(catalog, start - timedelta(days=31), end)
    dividends = fetch_catalog_dividends(catalog)
    document = assemble_backfilled_history(
        catalog,
        start,
        end,
        futures_closes,
        spot_closes,
        dividends,
    )
    changed = publish_history_document(document, catalog, history_path)
    return BackfillResult(changed, len(document.snapshots), start, end)
