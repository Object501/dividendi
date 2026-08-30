"""Chinese exchange sessions and CFFEX stock-index futures contract dates."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from functools import cache

import pandas_market_calendars as market_calendars

QUARTER_MONTHS = frozenset({3, 6, 9, 12})


@dataclass(frozen=True, order=True, slots=True)
class ContractMonth:
    year: int
    month: int

    def code(self, product_code: str) -> str:
        return f"{product_code}{self.year % 100:02d}{self.month:02d}"


@cache
def _sse_calendar():
    return market_calendars.get_calendar("SSE")


def trading_sessions(start: date, end: date) -> tuple[date, ...]:
    """Return Chinese stock-market sessions in an inclusive date interval."""

    if end < start:
        return ()
    return tuple(session.date() for session in _sse_calendar().valid_days(start, end))


def third_friday(year: int, month: int) -> date:
    """Return the calendar month's third Friday without holiday adjustment."""

    fridays = [
        week[calendar.FRIDAY]
        for week in calendar.monthcalendar(year, month)
        if week[calendar.FRIDAY] != 0
    ]
    return date(year, month, fridays[2])


def cffex_expiry(year: int, month: int) -> date:
    """Return CFFEX expiry, postponing a closed third Friday to the next session."""

    nominal_expiry = third_friday(year, month)
    sessions = trading_sessions(nominal_expiry, nominal_expiry + timedelta(days=14))
    if not sessions:
        raise ValueError("无法在第三个星期五后找到交易日")
    return sessions[0]


def _next_month(contract_month: ContractMonth) -> ContractMonth:
    if contract_month.month == 12:
        return ContractMonth(contract_month.year + 1, 1)
    return ContractMonth(contract_month.year, contract_month.month + 1)


def active_contract_months(as_of: date) -> tuple[ContractMonth, ...]:
    """Return current, next, and following two quarter months under CFFEX rules."""

    front = ContractMonth(as_of.year, as_of.month)
    if as_of > cffex_expiry(front.year, front.month):
        front = _next_month(front)

    following = _next_month(front)
    months = [front, following]
    candidate = _next_month(following)
    while len(months) < 4:
        if candidate.month in QUARTER_MONTHS:
            months.append(candidate)
        candidate = _next_month(candidate)
    return tuple(months)


def active_contract_codes(product_code: str, as_of: date) -> tuple[str, ...]:
    """Return active contract identifiers for a configured futures product."""

    return tuple(month.code(product_code) for month in active_contract_months(as_of))


def remaining_trading_days(snapshot_date: date, expiry_date: date, *, intraday: bool) -> int:
    """Count sessions through expiry using intraday or end-of-day semantics."""

    start = snapshot_date if intraday else snapshot_date + timedelta(days=1)
    return len(trading_sessions(start, expiry_date))
