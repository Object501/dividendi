"""Shared data collection and validation code."""

from .calendar import (
    ContractMonth,
    active_contract_codes,
    active_contract_months,
    cffex_expiry,
    remaining_trading_days,
    trading_sessions,
)
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

__all__ = [
    "CashDividend",
    "ContractMonth",
    "FuturesMetric",
    "FuturesProduct",
    "InstrumentCatalog",
    "LatestDocument",
    "MarketInstrument",
    "StockMetric",
    "active_contract_codes",
    "active_contract_months",
    "cffex_expiry",
    "daily_discount_points",
    "discount_points",
    "implemented_dividend_per_share",
    "load_instruments",
    "load_latest_document",
    "parse_instruments",
    "parse_latest_document",
    "remaining_trading_days",
    "retain_rolling_window",
    "trading_sessions",
    "trailing_dividend_yield",
]
