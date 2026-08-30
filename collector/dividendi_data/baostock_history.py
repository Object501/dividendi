"""BaoStock adapter for historical unadjusted index and stock closes."""

from __future__ import annotations

from contextlib import redirect_stdout
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from io import StringIO

import baostock as bs

from .instruments import InstrumentCatalog, MarketInstrument
from .throttle import polite_delay

BAOSTOCK_HISTORY_SOURCE = "baostock"


@dataclass(frozen=True, slots=True)
class HistoricalSpotClose:
    market: str
    code: str
    market_date: date
    close: Decimal


def baostock_code(instrument: MarketInstrument) -> str:
    prefix = {"BJ": "bj", "SH": "sh", "SZ": "sz"}.get(instrument.market)
    if prefix is None:
        raise ValueError(f"BaoStock 不支持市场 {instrument.market}")
    return f"{prefix}.{instrument.code}"


def parse_baostock_rows(
    rows: list[list[str]],
    instrument: MarketInstrument,
) -> tuple[HistoricalSpotClose, ...]:
    """Parse ``date,code,close,tradestatus`` query rows."""

    expected_code = baostock_code(instrument)
    closes: list[HistoricalSpotClose] = []
    for index, row in enumerate(rows):
        if len(row) != 4:
            raise ValueError(f"BaoStock {expected_code}[{index}] 字段数量无效")
        raw_date, returned_code, raw_close, trade_status = row
        if returned_code != expected_code:
            raise ValueError(f"BaoStock 返回了意外代码 {returned_code}")
        if trade_status == "0":
            continue
        if trade_status != "1":
            raise ValueError(f"BaoStock {expected_code}[{index}] 交易状态无效")
        try:
            market_date = date.fromisoformat(raw_date)
            close = Decimal(raw_close)
        except (ValueError, InvalidOperation) as error:
            raise ValueError(f"BaoStock {expected_code}[{index}] 日期或收盘价无效") from error
        if not close.is_finite() or close <= 0:
            raise ValueError(f"BaoStock {expected_code}[{index}] 收盘价必须是有限正数")
        closes.append(HistoricalSpotClose(instrument.market, instrument.code, market_date, close))

    dates = tuple(item.market_date for item in closes)
    if len(set(dates)) != len(dates):
        raise ValueError(f"BaoStock {expected_code} 包含重复交易日")
    return tuple(sorted(closes, key=lambda item: item.market_date))


def _quiet_call(function, *args, **kwargs):
    with redirect_stdout(StringIO()):
        return function(*args, **kwargs)


def _query_instrument(
    instrument: MarketInstrument,
    start: date,
    end: date,
) -> tuple[HistoricalSpotClose, ...]:
    result = bs.query_history_k_data_plus(
        baostock_code(instrument),
        "date,code,close,tradestatus",
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        frequency="d",
        adjustflag="3",
    )
    if result.error_code != "0":
        raise ValueError(f"BaoStock {baostock_code(instrument)}: {result.error_msg}")
    rows: list[list[str]] = []
    while result.next():
        rows.append(result.get_row_data())
    if result.error_code != "0":
        raise ValueError(f"BaoStock {baostock_code(instrument)}: {result.error_msg}")
    return parse_baostock_rows(rows, instrument)


def fetch_baostock_closes(
    catalog: InstrumentCatalog,
    start: date,
    end: date,
) -> dict[tuple[str, str], tuple[HistoricalSpotClose, ...]]:
    """Fetch all configured underlying and stock closes in one session."""

    if end < start:
        raise ValueError("BaoStock 历史区间结束日不能早于开始日")
    instruments = {
        (instrument.market, instrument.code): instrument
        for instrument in (
            *(product.underlying for product in catalog.futures_products),
            *catalog.stocks,
        )
    }
    login = _quiet_call(bs.login)
    if login.error_code != "0":
        raise ValueError(f"BaoStock 登录失败: {login.error_msg}")
    try:
        closes: dict[tuple[str, str], tuple[HistoricalSpotClose, ...]] = {}
        for index, (key, instrument) in enumerate(instruments.items()):
            if index > 0:
                polite_delay()
            closes[key] = _query_instrument(instrument, start, end)
        return closes
    finally:
        _quiet_call(bs.logout)
