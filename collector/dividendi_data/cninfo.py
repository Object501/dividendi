"""Minimal CNInfo cash-dividend adapter."""

from __future__ import annotations

import json
import re
from base64 import b64encode
from collections.abc import Mapping
from datetime import date
from decimal import Decimal, InvalidOperation
from time import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from .formulas import CashDividend
from .instruments import InstrumentCatalog, MarketInstrument
from .throttle import polite_delay

CNINFO_DIVIDEND_URL = "https://webapi.cninfo.com.cn/api/sysapi/p_sysapi1139"
CNINFO_SOURCE = "cninfo"
_ENCRYPTION_KEY = b"1234567887654321"
_REPORT_YEAR = re.compile(r"^(?P<year>\d{4})(?:年报|半年报|一季报|三季报)$")


def create_accept_enckey(timestamp: int | None = None) -> str:
    """Create the request token expected by the public CNInfo web API."""

    unix_seconds = int(time()) if timestamp is None else timestamp
    if unix_seconds < 0:
        raise ValueError("巨潮请求时间戳不能为负数")

    padder = padding.PKCS7(128).padder()
    padded = padder.update(str(unix_seconds).encode()) + padder.finalize()
    encryptor = Cipher(
        algorithms.AES(_ENCRYPTION_KEY),
        modes.CBC(_ENCRYPTION_KEY),
    ).encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()
    return b64encode(ciphertext).decode("ascii")


def _mapping(value: object, path: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{path} 必须是对象")
    return value


def _cash_per_ten(value: object, path: str) -> Decimal | None:
    if value is None:
        return None
    try:
        amount = Decimal(str(value))
    except InvalidOperation as error:
        raise ValueError(f"{path} 不是十进制数值") from error
    if not amount.is_finite() or amount < 0:
        raise ValueError(f"{path} 必须是有限非负数")
    return amount


def parse_dividend_payload(payload: object, code: str) -> tuple[CashDividend, ...]:
    """Parse paid cash dividends, using the payment date as implementation date."""

    document = _mapping(payload, "巨潮分红响应")
    records = document.get("records")
    if not isinstance(records, list):
        raise ValueError("巨潮分红响应.records 必须是数组")

    dividends: list[CashDividend] = []
    for index, value in enumerate(records):
        record = _mapping(value, f"巨潮分红响应.records[{index}]")
        payment_date = record.get("F023D")
        cash_per_ten = _cash_per_ten(record.get("F012N"), f"{code}[{index}].F012N")
        if payment_date is None or cash_per_ten in (None, 0):
            continue
        if not isinstance(payment_date, str):
            raise ValueError(f"{code}[{index}].F023D 必须是日期字符串")
        try:
            implementation_date = date.fromisoformat(payment_date)
        except ValueError as error:
            raise ValueError(f"{code}[{index}].F023D 不是有效日期") from error
        report_period = record.get("F001V")
        distribution_type = record.get("F044V")
        fiscal_year = None
        if isinstance(report_period, str):
            match = _REPORT_YEAR.fullmatch(report_period.strip())
            if match is not None:
                fiscal_year = int(match.group("year"))
        if not isinstance(distribution_type, str) or not distribution_type.strip():
            distribution_type = None
        dividends.append(
            CashDividend(
                implementation_date=implementation_date,
                per_share=cash_per_ten / Decimal(10),
                fiscal_year=fiscal_year,
                distribution_type=distribution_type,
            )
        )

    return tuple(sorted(dividends, key=lambda dividend: dividend.implementation_date))


def fetch_dividend_payload(code: str, timeout: float = 15) -> object:
    """Fetch one stock's dividend records from the public CNInfo web API."""

    url = f"{CNINFO_DIVIDEND_URL}?{urlencode({'scode': code})}"
    request = Request(
        url,
        data=b"",
        method="POST",
        headers={
            "Accept": "*/*",
            "Accept-Enckey": create_accept_enckey(),
            "Origin": "https://webapi.cninfo.com.cn",
            "Referer": "https://webapi.cninfo.com.cn/",
            "User-Agent": "dividendi/0.1 (+https://github.com/object501/dividendi)",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_stock_dividends(stock: MarketInstrument) -> tuple[CashDividend, ...]:
    """Fetch implemented cash dividends for one configured A-share."""

    if stock.market not in {"SH", "SZ", "BJ"}:
        raise ValueError(f"巨潮不支持市场 {stock.market}")
    return parse_dividend_payload(fetch_dividend_payload(stock.code), stock.code)


def fetch_catalog_dividends(
    catalog: InstrumentCatalog,
) -> dict[tuple[str, str], tuple[CashDividend, ...]]:
    """Fetch implemented cash dividends for every configured stock."""

    dividends: dict[tuple[str, str], tuple[CashDividend, ...]] = {}
    for index, stock in enumerate(catalog.stocks):
        if index > 0:
            polite_delay()
        dividends[(stock.market, stock.code)] = fetch_stock_dividends(stock)
    return dividends
