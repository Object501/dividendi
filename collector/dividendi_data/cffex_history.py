"""Official CFFEX monthly archive adapter for historical futures closes."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO
from urllib.request import Request, urlopen
from zipfile import BadZipFile, ZipFile

from .throttle import polite_delay

CFFEX_ARCHIVE_URL = "http://www.cffex.com.cn/sj/historysj/{month}/zip/{month}.zip"
CFFEX_HISTORY_SOURCE = "cffex"
_DAILY_FILE = re.compile(r"(?P<date>\d{8})_1\.csv$")


@dataclass(frozen=True, slots=True)
class HistoricalFuturesClose:
    product_code: str
    contract_code: str
    market_date: date
    close: Decimal


def archive_months(start: date, end: date) -> tuple[str, ...]:
    if end < start:
        raise ValueError("中金所历史区间结束日不能早于开始日")
    months: list[str] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append(f"{year:04d}{month:02d}")
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1
    return tuple(months)


def _decimal(value: object, path: str) -> Decimal | None:
    if not isinstance(value, str) or value.strip() in {"", "--"}:
        return None
    try:
        number = Decimal(value.strip())
    except InvalidOperation as error:
        raise ValueError(f"{path} 不是十进制数值") from error
    if not number.is_finite() or number <= 0:
        raise ValueError(f"{path} 必须是有限正数")
    return number


def _product_for_contract(contract_code: str, product_codes: tuple[str, ...]) -> str | None:
    for product_code in product_codes:
        suffix = contract_code.removeprefix(product_code)
        if len(suffix) == 4 and suffix.isdigit():
            return product_code
    return None


def parse_cffex_archive(
    payload: bytes,
    start: date,
    end: date,
    product_codes: tuple[str, ...],
) -> tuple[HistoricalFuturesClose, ...]:
    """Parse configured futures closes from one official monthly ZIP."""

    if not product_codes or len(set(product_codes)) != len(product_codes):
        raise ValueError("中金所历史品种必须非空且唯一")
    closes: list[HistoricalFuturesClose] = []
    try:
        archive = ZipFile(BytesIO(payload))
    except BadZipFile as error:
        raise ValueError("中金所月度历史文件不是有效 ZIP") from error

    with archive:
        for filename in sorted(archive.namelist()):
            match = _DAILY_FILE.search(filename)
            if match is None:
                continue
            raw_date = match.group("date")
            try:
                market_date = date.fromisoformat(f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}")
            except ValueError as error:
                raise ValueError(f"中金所历史文件名日期无效: {filename}") from error
            if not start <= market_date <= end:
                continue

            content = archive.read(filename).decode("gb18030")
            for row_number, row in enumerate(csv.DictReader(StringIO(content)), start=2):
                contract = row.get("合约代码")
                if not isinstance(contract, str):
                    raise ValueError(f"{filename}:{row_number} 缺少合约代码")
                contract = contract.strip()
                product = _product_for_contract(contract, product_codes)
                if product is None:
                    continue
                close = _decimal(row.get("今收盘"), f"{filename}:{row_number}.今收盘")
                if close is None:
                    continue
                closes.append(HistoricalFuturesClose(product, contract, market_date, close))

    keys = tuple((item.market_date, item.contract_code) for item in closes)
    if len(set(keys)) != len(keys):
        raise ValueError("中金所历史文件包含重复合约日期")
    return tuple(sorted(closes, key=lambda item: (item.market_date, item.contract_code)))


def fetch_cffex_archive(month: str, timeout: float = 30) -> bytes:
    request = Request(
        CFFEX_ARCHIVE_URL.format(month=month),
        headers={"User-Agent": "dividendi/0.1 (+https://github.com/object501/dividendi)"},
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def fetch_cffex_closes(
    start: date,
    end: date,
    product_codes: tuple[str, ...],
) -> tuple[HistoricalFuturesClose, ...]:
    """Fetch configured futures closes across an inclusive date interval."""

    closes: list[HistoricalFuturesClose] = []
    months = archive_months(start, end)
    for index, month in enumerate(months):
        if index > 0:
            polite_delay()
        closes.extend(
            parse_cffex_archive(
                fetch_cffex_archive(month),
                start,
                end,
                product_codes,
            )
        )
    return tuple(closes)
