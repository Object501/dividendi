"""Reconstruct the rolling historical metrics from official EOD sources."""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from .archive import (
    DEFAULT_HISTORY_PATH,
    HistoryDocument,
    load_history_document,
    publish_history_document,
)
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
    latest_document_json,
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
from .history import retain_rolling_window
from .instruments import InstrumentCatalog, load_instruments

MAX_INCREMENTAL_SESSIONS = 10
SHANGHAI = ZoneInfo("Asia/Shanghai")
MARKET_CLOSE = time(15)


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
    dividends: Mapping[tuple[str, str], tuple[CashDividend, ...]] | None,
    *,
    dividend_basis: Mapping[tuple[str, str], StockMetric] | None = None,
) -> HistoryDocument:
    """Build deterministic EOD documents for every trading session."""

    sessions = trading_sessions(start, end)
    if not sessions:
        raise ValueError("历史回填区间没有交易日")
    if dividends is None and (len(sessions) != 1 or dividend_basis is None):
        raise ValueError("多交易日历史必须提供完整分红记录")
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
            latest_price = _spot_close_on_or_before(
                spot_closes[key],
                market_date,
                key,
                exact=False,
            )
            if dividends is not None:
                if key not in dividends:
                    raise ValueError(f"巨潮分红缺少股票 {stock.market}:{stock.code}")
                dividend_per_share = implemented_dividend_per_share(dividends[key], market_date)
                completed = latest_completed_fiscal_year_dividend(dividends[key], market_date)
                completed_year = None if completed is None else completed[0]
                completed_dividend = None if completed is None else completed[1]
                dividend_source = CNINFO_SOURCE
            else:
                cached = dividend_basis.get(key) if dividend_basis is not None else None
                if cached is None:
                    raise ValueError(f"缓存分红缺少股票 {stock.market}:{stock.code}")
                dividend_per_share = cached.implemented_dividend_per_share
                completed_year = cached.completed_fiscal_year
                completed_dividend = cached.completed_fiscal_year_dividend_per_share
                dividend_source = cached.dividend_source
            stock_metrics.append(
                StockMetric(
                    market=stock.market,
                    code=stock.code,
                    latest_price=latest_price,
                    implemented_dividend_per_share=dividend_per_share,
                    dividend_yield=trailing_dividend_yield(dividend_per_share, latest_price),
                    price_source=BAOSTOCK_HISTORY_SOURCE,
                    dividend_source=dividend_source,
                    completed_fiscal_year=completed_year,
                    completed_fiscal_year_dividend_per_share=completed_dividend,
                    completed_fiscal_year_dividend_yield=(
                        None
                        if completed_dividend is None
                        else trailing_dividend_yield(completed_dividend, latest_price)
                    ),
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


def _latest_completed_market_date(as_of: datetime) -> date:
    if as_of.tzinfo is None or as_of.utcoffset() is None:
        raise ValueError("当前时间必须包含时区")
    local = as_of.astimezone(SHANGHAI)
    end = local.date() if local.time() >= MARKET_CLOSE else local.date() - timedelta(days=1)
    sessions = trading_sessions(end - timedelta(days=14), end)
    if not sessions:
        raise ValueError("最近 14 天没有可用交易日")
    return sessions[-1]


def backfill_history(
    history_path: Path = DEFAULT_HISTORY_PATH,
    *,
    window_days: int = 365,
    as_of: datetime | None = None,
) -> BackfillResult:
    """Fetch and atomically publish a complete trailing historical window."""

    if window_days <= 0:
        raise ValueError("历史回填窗口必须大于零")
    catalog = load_instruments()
    end = _latest_completed_market_date(datetime.now(UTC) if as_of is None else as_of)
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


def refresh_history(
    history_path: Path = DEFAULT_HISTORY_PATH,
    *,
    as_of: datetime | None = None,
) -> bool:
    """Refresh EOD history and safely catch up a short trailing gap."""

    catalog = load_instruments()
    now = datetime.now(UTC) if as_of is None else as_of
    market_date = _latest_completed_market_date(now)
    existing = (
        load_history_document(history_path, catalog).snapshots if history_path.exists() else ()
    )
    if existing and existing[-1].market_date > market_date:
        raise ValueError("日终历史不能晚于最新行情")
    local_date = now.astimezone(SHANGHAI).date()
    if existing and existing[-1].market_date == market_date and local_date != market_date:
        return False
    missing_sessions = (
        trading_sessions(existing[-1].market_date + timedelta(days=1), market_date)
        if existing
        else ()
    )
    if len(missing_sessions) > MAX_INCREMENTAL_SESSIONS:
        raise ValueError(
            f"缺失 {len(missing_sessions)} 个交易日: 超过自动补齐上限 "
            f"{MAX_INCREMENTAL_SESSIONS}; 请运行 just backfill"
        )
    start = missing_sessions[0] if missing_sessions else market_date
    product_codes = tuple(product.code for product in catalog.futures_products)
    daily = assemble_backfilled_history(
        catalog,
        start,
        market_date,
        fetch_cffex_closes(start, market_date, product_codes),
        fetch_baostock_closes(
            catalog,
            start - timedelta(days=31),
            market_date,
        ),
        fetch_catalog_dividends(catalog),
    )
    replacement_dates = {*missing_sessions, market_date}
    replacements = tuple(
        snapshot for snapshot in daily.snapshots if snapshot.market_date in replacement_dates
    )
    snapshots = retain_rolling_window(
        (
            *(item for item in existing if item.market_date not in replacement_dates),
            *replacements,
        ),
        lambda item: item.market_date,
    )
    return publish_history_document(HistoryDocument(1, snapshots), catalog, history_path)
