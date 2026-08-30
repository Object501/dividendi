"""Command-line entry point for repository data collection."""

from __future__ import annotations

import argparse
from pathlib import Path

from .dividendi_data.archive import DEFAULT_HISTORY_PATH
from .dividendi_data.backfill import backfill_history, refresh_history
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


if __name__ == "__main__":
    main()
