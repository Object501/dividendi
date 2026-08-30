"""Shared data collection and validation code."""

from .archive import (
    HistoryDocument,
    load_history_document,
    parse_history_document,
    publish_history_document,
    update_history,
)
from .backfill import refresh_history
from .calendar import (
    ContractMonth,
    active_contract_codes,
    active_contract_months,
    cffex_expiry,
    remaining_trading_days,
    trading_sessions,
)
from .cninfo import fetch_catalog_dividends, fetch_stock_dividends
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
from .history import retain_rolling_window
from .instruments import (
    FuturesProduct,
    InstrumentCatalog,
    MarketInstrument,
    load_instruments,
    parse_instruments,
)
from .refresh import (
    assemble_latest_document,
    latest_document_json,
    publish_latest_document,
    refresh_latest,
)
from .sina import CurrentQuotes, FuturesQuote, SpotQuote, fetch_current_quotes

__all__ = [
    "CashDividend",
    "ContractMonth",
    "CurrentQuotes",
    "FuturesMetric",
    "FuturesProduct",
    "FuturesQuote",
    "HistoryDocument",
    "InstrumentCatalog",
    "LatestDocument",
    "MarketInstrument",
    "SpotQuote",
    "StockMetric",
    "active_contract_codes",
    "active_contract_months",
    "assemble_latest_document",
    "cffex_expiry",
    "daily_discount_points",
    "discount_points",
    "fetch_catalog_dividends",
    "fetch_current_quotes",
    "fetch_stock_dividends",
    "implemented_dividend_per_share",
    "latest_document_json",
    "load_history_document",
    "load_instruments",
    "load_latest_document",
    "parse_history_document",
    "parse_instruments",
    "parse_latest_document",
    "publish_history_document",
    "publish_latest_document",
    "refresh_history",
    "refresh_latest",
    "remaining_trading_days",
    "retain_rolling_window",
    "trading_sessions",
    "trailing_dividend_yield",
    "update_history",
]
