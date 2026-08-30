"""Deterministic financial calculations independent of data providers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

REGULAR_DISTRIBUTION_TYPES = frozenset({"年度分红", "中期分红", "季度分红"})


@dataclass(frozen=True, slots=True)
class CashDividend:
    implementation_date: date
    per_share: Decimal
    fiscal_year: int | None = None
    distribution_type: str | None = None

    def __post_init__(self) -> None:
        if self.per_share < 0:
            raise ValueError("每股现金分红不能为负数")
        if self.fiscal_year is not None and self.fiscal_year <= 0:
            raise ValueError("分红所属财年必须为正整数")


def discount_points(index_level: Decimal, futures_price: Decimal) -> Decimal:
    """Return positive points for discount and negative points for premium."""

    return index_level - futures_price


def daily_discount_points(points: Decimal, remaining_trading_days: int) -> Decimal:
    """Spread discount points evenly across the remaining trading sessions."""

    if remaining_trading_days <= 0:
        raise ValueError("剩余交易日数必须大于零")
    return points / Decimal(remaining_trading_days)


def implemented_dividend_per_share(
    dividends: tuple[CashDividend, ...],
    as_of: date,
    window_days: int = 365,
) -> Decimal:
    """Sum dividends implemented in the trailing calendar-day window.

    The interval is ``(as_of - window_days, as_of]`` so it contains exactly
    ``window_days`` calendar dates.
    """

    if window_days <= 0:
        raise ValueError("分红统计窗口必须大于零")

    cutoff = as_of - timedelta(days=window_days)
    return sum(
        (
            dividend.per_share
            for dividend in dividends
            if cutoff < dividend.implementation_date <= as_of
        ),
        start=Decimal(0),
    )


def trailing_dividend_yield(dividend_per_share: Decimal, latest_price: Decimal) -> Decimal:
    """Return the trailing gross dividend yield as a decimal fraction."""

    if dividend_per_share < 0:
        raise ValueError("每股现金分红不能为负数")
    if latest_price <= 0:
        raise ValueError("最近价格必须大于零")
    return dividend_per_share / latest_price


def latest_completed_fiscal_year_dividend(
    dividends: tuple[CashDividend, ...],
    as_of: date,
) -> tuple[int, Decimal] | None:
    """Return regular DPS for the latest fiscal year with a paid annual dividend."""

    implemented = tuple(dividend for dividend in dividends if dividend.implementation_date <= as_of)
    completed_years = tuple(
        dividend.fiscal_year
        for dividend in implemented
        if dividend.fiscal_year is not None and dividend.distribution_type == "年度分红"
    )
    if not completed_years:
        return None

    fiscal_year = max(completed_years)
    per_share = sum(
        (
            dividend.per_share
            for dividend in implemented
            if dividend.fiscal_year == fiscal_year
            and dividend.distribution_type in REGULAR_DISTRIBUTION_TYPES
        ),
        start=Decimal(0),
    )
    return fiscal_year, per_share
