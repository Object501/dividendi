"""Minimal Sina quote adapter using only the Python standard library."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from urllib.parse import quote
from urllib.request import Request, urlopen

from .calendar import active_contract_codes
from .instruments import InstrumentCatalog, MarketInstrument

SINA_QUOTE_URL = "https://hq.sinajs.cn/list="
SINA_REFERER = "https://finance.sina.com.cn/"
SINA_SOURCE = "sina"
QUOTE_LINE = re.compile(r'^var hq_str_(?P<symbol>[A-Za-z0-9_]+)="(?P<payload>.*)";$')


@dataclass(frozen=True, slots=True)
class FuturesQuote:
    product_code: str
    contract_code: str
    price: Decimal
    market_date: date
    quote_time: time


@dataclass(frozen=True, slots=True)
class SpotQuote:
    market: str
    code: str
    name: str
    price: Decimal
    market_date: date
    quote_time: time


@dataclass(frozen=True, slots=True)
class CurrentQuotes:
    fetched_at: datetime
    futures: tuple[FuturesQuote, ...]
    underlyings: tuple[SpotQuote, ...]
    stocks: tuple[SpotQuote, ...]


def provider_symbol(instrument: MarketInstrument) -> str:
    """Derive a Sina symbol from the canonical market and code."""

    market_prefix = {
        "BJ": "bj",
        "SH": "sh",
        "SZ": "sz",
    }.get(instrument.market)
    if market_prefix is None:
        raise ValueError(f"Sina 不支持市场 {instrument.market}")
    return f"{market_prefix}{instrument.code}"


def futures_provider_symbol(contract_code: str) -> str:
    return f"nf_{contract_code}"


def requested_symbols(catalog: InstrumentCatalog, as_of: date) -> tuple[str, ...]:
    """Return all provider symbols required for one catalog refresh."""

    futures = tuple(
        futures_provider_symbol(contract_code)
        for product in catalog.futures_products
        for contract_code in active_contract_codes(product.code, as_of)
    )
    underlyings = tuple(
        dict.fromkeys(provider_symbol(product.underlying) for product in catalog.futures_products)
    )
    stocks = tuple(provider_symbol(stock) for stock in catalog.stocks)
    return futures + underlyings + stocks


def parse_quote_payload(payload: str) -> dict[str, tuple[str, ...]]:
    """Parse decoded Sina JavaScript assignments into symbol field tuples."""

    quotes: dict[str, tuple[str, ...]] = {}
    for line_number, raw_line in enumerate(payload.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        match = QUOTE_LINE.fullmatch(line)
        if match is None:
            raise ValueError(f"Sina 行情第 {line_number} 行格式无效")
        symbol = match.group("symbol")
        if symbol in quotes:
            raise ValueError(f"Sina 行情包含重复代码 {symbol}")
        fields = tuple(match.group("payload").split(","))
        if not any(fields):
            raise ValueError(f"Sina 行情未返回代码 {symbol}")
        quotes[symbol] = fields
    return quotes


def _decimal(value: str, path: str) -> Decimal:
    try:
        number = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"{path} 不是十进制数值") from error
    if not number.is_finite():
        raise ValueError(f"{path} 不是有限数值")
    return number


def _date_time(fields: tuple[str, ...], date_index: int, time_index: int, path: str):
    try:
        market_date = date.fromisoformat(fields[date_index])
        quote_time = time.fromisoformat(fields[time_index])
    except (IndexError, ValueError) as error:
        raise ValueError(f"{path} 缺少有效行情日期时间") from error
    return market_date, quote_time


def parse_futures_quote(
    symbol: str,
    fields: tuple[str, ...],
    product_code: str,
    contract_code: str,
) -> FuturesQuote:
    """Parse one ``nf_`` stock-index futures quote."""

    if len(fields) < 38:
        raise ValueError(f"{symbol} 期货行情字段不足")
    market_date, quote_time = _date_time(fields, 36, 37, symbol)
    price = _decimal(fields[3], f"{symbol}.price")
    if price <= 0:
        raise ValueError(f"{symbol}.price 必须大于零")
    return FuturesQuote(product_code, contract_code, price, market_date, quote_time)


def parse_spot_quote(
    symbol: str,
    fields: tuple[str, ...],
    instrument: MarketInstrument,
) -> SpotQuote:
    """Parse one index or A-share quote."""

    if len(fields) < 32:
        raise ValueError(f"{symbol} 现货行情字段不足")
    market_date, quote_time = _date_time(fields, 30, 31, symbol)
    price = _decimal(fields[3], f"{symbol}.price")
    if price <= 0:
        raise ValueError(f"{symbol}.price 必须大于零")
    return SpotQuote(
        market=instrument.market,
        code=instrument.code,
        name=fields[0],
        price=price,
        market_date=market_date,
        quote_time=quote_time,
    )


def fetch_quote_payload(symbols: tuple[str, ...], timeout: float = 15) -> str:
    """Fetch and decode one batched Sina quote request."""

    if not symbols:
        raise ValueError("Sina 行情请求不能为空")
    url = f"{SINA_QUOTE_URL}{quote(','.join(symbols), safe=',_')}"
    request = Request(
        url,
        headers={
            "Referer": SINA_REFERER,
            "User-Agent": "dividendi/0.1 (+https://github.com/object501/dividendi)",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("gb18030")


def fetch_current_quotes(
    catalog: InstrumentCatalog,
    as_of: date,
    fetched_at: datetime,
) -> CurrentQuotes:
    """Fetch every configured current quote and require complete coverage."""

    symbols = requested_symbols(catalog, as_of)
    raw_quotes = parse_quote_payload(fetch_quote_payload(symbols))
    missing = tuple(symbol for symbol in symbols if symbol not in raw_quotes)
    if missing:
        raise ValueError(f"Sina 行情缺少代码: {', '.join(missing)}")

    futures = tuple(
        parse_futures_quote(
            futures_provider_symbol(contract_code),
            raw_quotes[futures_provider_symbol(contract_code)],
            product.code,
            contract_code,
        )
        for product in catalog.futures_products
        for contract_code in active_contract_codes(product.code, as_of)
    )
    underlyings_by_symbol = {
        provider_symbol(product.underlying): product.underlying
        for product in catalog.futures_products
    }
    underlyings = tuple(
        parse_spot_quote(symbol, raw_quotes[symbol], instrument)
        for symbol, instrument in underlyings_by_symbol.items()
    )
    stocks = tuple(
        parse_spot_quote(provider_symbol(stock), raw_quotes[provider_symbol(stock)], stock)
        for stock in catalog.stocks
    )

    market_dates = {
        *(quote.market_date for quote in futures),
        *(quote.market_date for quote in underlyings),
        *(quote.market_date for quote in stocks),
    }
    if len(market_dates) != 1:
        raise ValueError("Sina 行情的市场日期不一致")

    return CurrentQuotes(
        fetched_at=fetched_at,
        futures=futures,
        underlyings=underlyings,
        stocks=stocks,
    )
