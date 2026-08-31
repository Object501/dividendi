"""Validate and maintain the rolling end-of-day history document."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from .history import retain_rolling_window
from .instruments import InstrumentCatalog
from .market_snapshot import (
    MarketSnapshot,
    atomic_write_json,
    market_snapshot_json,
    parse_market_snapshot,
)
from .schema import validate_history_schema

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = Path(os.environ.get("DIVIDENDI_DATA_DIR", REPOSITORY_ROOT / ".data"))
DEFAULT_HISTORY_PATH = DEFAULT_DATA_DIR / "history.json"


@dataclass(frozen=True, slots=True)
class HistoryDocument:
    schema_version: int
    snapshots: tuple[MarketSnapshot, ...]


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
        parse_market_snapshot(snapshot, catalog, validate_schema=False)
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
        "snapshots": [market_snapshot_json(snapshot) for snapshot in document.snapshots],
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
