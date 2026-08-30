"""Validate and maintain the rolling end-of-day history document."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from .documents import (
    LatestDocument,
    atomic_write_json,
    load_latest_document,
    parse_latest_document,
)
from .history import retain_rolling_window
from .instruments import InstrumentCatalog, load_instruments
from .refresh import (
    DEFAULT_DATA_DIR,
    DEFAULT_LATEST_PATH,
    is_intraday_snapshot,
    latest_document_json,
)
from .schema import validate_history_schema

DEFAULT_HISTORY_PATH = DEFAULT_DATA_DIR / "history.json"


@dataclass(frozen=True, slots=True)
class HistoryDocument:
    schema_version: int
    snapshots: tuple[LatestDocument, ...]


def parse_history_document(value: object, catalog: InstrumentCatalog) -> HistoryDocument:
    """Validate chronological, unique snapshots inside the rolling window."""

    validate_history_schema(value)
    if not isinstance(value, Mapping):
        raise ValueError("history 必须是对象")
    if value.get("schemaVersion") != 1:
        raise ValueError("不支持的历史数据版本")
    raw_snapshots = value.get("snapshots")
    if not isinstance(raw_snapshots, list):
        raise ValueError("history.snapshots 必须是数组")

    snapshots = tuple(
        parse_latest_document(snapshot, catalog, validate_schema=False)
        for snapshot in raw_snapshots
    )
    dates = tuple(snapshot.market_date for snapshot in snapshots)
    if dates != tuple(sorted(dates)):
        raise ValueError("历史快照必须按交易日升序排列")
    if len(set(dates)) != len(dates):
        raise ValueError("历史快照中存在重复交易日")
    retained = retain_rolling_window(snapshots, lambda snapshot: snapshot.market_date)
    if retained != snapshots:
        raise ValueError("历史快照超出 365 天滚动窗口")
    return HistoryDocument(schema_version=1, snapshots=snapshots)


def history_document_json(document: HistoryDocument) -> dict[str, object]:
    return {
        "schemaVersion": document.schema_version,
        "snapshots": [latest_document_json(snapshot) for snapshot in document.snapshots],
    }


def load_history_document(path: Path, catalog: InstrumentCatalog) -> HistoryDocument:
    with path.open(encoding="utf-8") as source:
        return parse_history_document(json.load(source), catalog)


def publish_history_document(
    document: HistoryDocument,
    catalog: InstrumentCatalog,
    path: Path = DEFAULT_HISTORY_PATH,
) -> bool:
    raw_document = history_document_json(document)
    parse_history_document(raw_document, catalog)
    return atomic_write_json(raw_document, path)


def update_history(
    latest_path: Path = DEFAULT_LATEST_PATH,
    history_path: Path = DEFAULT_HISTORY_PATH,
) -> bool:
    """Insert the latest EOD snapshot, replace its date, and prune old dates."""

    catalog = load_instruments()
    latest = load_latest_document(latest_path, catalog)
    if is_intraday_snapshot(latest.fetched_at, latest.market_date):
        raise ValueError("盘中行情不能写入日终历史")

    existing = (
        load_history_document(history_path, catalog).snapshots if history_path.exists() else ()
    )
    snapshots = retain_rolling_window(
        (
            *(snapshot for snapshot in existing if snapshot.market_date != latest.market_date),
            latest,
        ),
        lambda snapshot: snapshot.market_date,
    )
    return publish_history_document(HistoryDocument(1, snapshots), catalog, history_path)
