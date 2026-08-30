"""Command-line entry point for repository data collection."""

from __future__ import annotations

import argparse
from pathlib import Path

from .dividendi_data.archive import DEFAULT_HISTORY_PATH, load_history_document
from .dividendi_data.backfill import backfill_history, refresh_history
from .dividendi_data.documents import load_latest_document
from .dividendi_data.instruments import load_instruments
from .dividendi_data.refresh import DEFAULT_LATEST_PATH, refresh_latest


def main() -> None:
    parser = argparse.ArgumentParser(description="更新 dividendi 网站数据")
    subparsers = parser.add_subparsers(dest="command", required=True)
    latest = subparsers.add_parser("refresh-latest", help="抓取并发布最新行情")
    latest.add_argument("--output", type=Path, default=DEFAULT_LATEST_PATH)
    history = subparsers.add_parser("update-history", help="抓取官方收盘并更新滚动历史")
    history.add_argument("--latest", type=Path, default=DEFAULT_LATEST_PATH)
    history.add_argument("--output", type=Path, default=DEFAULT_HISTORY_PATH)
    backfill = subparsers.add_parser("backfill-history", help="回填完整滚动历史")
    backfill.add_argument("--latest", type=Path, default=DEFAULT_LATEST_PATH)
    backfill.add_argument("--output", type=Path, default=DEFAULT_HISTORY_PATH)
    validate = subparsers.add_parser("validate-data", help="校验待发布的完整数据集")
    validate.add_argument("--latest", type=Path, default=DEFAULT_LATEST_PATH)
    validate.add_argument("--history", type=Path, default=DEFAULT_HISTORY_PATH)
    arguments = parser.parse_args()

    if arguments.command == "refresh-latest":
        changed = refresh_latest(arguments.output)
        print("最新行情已更新" if changed else "行情数值未变化。无需更新")
    elif arguments.command == "update-history":
        changed = refresh_history(arguments.latest, arguments.output)
        print("日终历史已更新" if changed else "日终历史未变化。无需更新")
    elif arguments.command == "backfill-history":
        result = backfill_history(arguments.latest, arguments.output)
        state = "已更新" if result.changed else "未变化"
        interval = f"{result.start} 至 {result.end}"
        print(f"历史回填{state}: {interval}。共 {result.snapshot_count} 个交易日")
    elif arguments.command == "validate-data":
        catalog = load_instruments()
        load_latest_document(arguments.latest, catalog)
        load_history_document(arguments.history, catalog)
        print("待发布数据格式有效")


if __name__ == "__main__":
    main()
