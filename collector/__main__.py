"""Command-line entry point for repository data collection."""

from __future__ import annotations

import argparse
from pathlib import Path

from .dividendi_data.refresh import DEFAULT_LATEST_PATH, refresh_latest


def main() -> None:
    parser = argparse.ArgumentParser(description="更新 dividendi 网站数据")
    subparsers = parser.add_subparsers(dest="command", required=True)
    latest = subparsers.add_parser("refresh-latest", help="抓取并发布最新行情")
    latest.add_argument("--output", type=Path, default=DEFAULT_LATEST_PATH)
    arguments = parser.parse_args()

    if arguments.command == "refresh-latest":
        changed = refresh_latest(arguments.output)
        print("最新行情已更新" if changed else "行情数值未变化。无需更新")


if __name__ == "__main__":
    main()
