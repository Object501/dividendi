"""Rolling history retention independent of the storage format."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from datetime import date, timedelta


def retain_rolling_window[Snapshot](
    snapshots: Iterable[Snapshot],
    market_date: Callable[[Snapshot], date],
    window_days: int = 365,
) -> tuple[Snapshot, ...]:
    """Return sorted snapshots in ``(newest - window_days, newest]``."""

    if window_days <= 0:
        raise ValueError("历史数据保留窗口必须大于零")

    ordered = tuple(sorted(snapshots, key=market_date))
    if not ordered:
        return ()

    market_dates = tuple(market_date(snapshot) for snapshot in ordered)
    if len(set(market_dates)) != len(market_dates):
        raise ValueError("历史数据中存在重复交易日")

    cutoff = market_dates[-1] - timedelta(days=window_days)
    return tuple(
        snapshot for snapshot in ordered if cutoff < market_date(snapshot) <= market_dates[-1]
    )
