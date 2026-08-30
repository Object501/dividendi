"""Shared data collection and validation code."""

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
    "FuturesMetric",
    "FuturesProduct",
    "InstrumentCatalog",
    "LatestDocument",
    "MarketInstrument",
    "StockMetric",
    "daily_discount_points",
    "discount_points",
    "implemented_dividend_per_share",
    "load_instruments",
    "load_latest_document",
    "parse_instruments",
    "parse_latest_document",
    "retain_rolling_window",
    "trailing_dividend_yield",
]
