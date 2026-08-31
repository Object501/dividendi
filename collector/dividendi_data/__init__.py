"""Shared data collection and validation code."""

from .archive import (
    HistoryDocument,
    load_history_document,
    parse_history_document,
    publish_history_document,
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
from .instruments import (
    FuturesProduct,
    InstrumentCatalog,
    MarketInstrument,
    load_instruments,
    parse_instruments,
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
    "cffex_expiry",
    "daily_discount_points",
    "discount_points",
    "fetch_catalog_dividends",
    "fetch_current_quotes",
    "fetch_stock_dividends",
    "implemented_dividend_per_share",
    "latest_completed_fiscal_year_dividend",
    "latest_document_json",
    "load_history_document",
    "load_instruments",
    "parse_history_document",
    "parse_instruments",
    "parse_latest_document",
    "publish_history_document",
    "refresh_history",
    "remaining_trading_days",
    "retain_rolling_window",
    "trading_sessions",
    "trailing_dividend_yield",
]
