"""Small randomized delays for polite multi-request collection."""

from __future__ import annotations

from random import uniform
from time import sleep


def polite_delay(minimum_seconds: float = 0.6, maximum_seconds: float = 1.8) -> None:
    if minimum_seconds < 0 or maximum_seconds < minimum_seconds:
        raise ValueError("请求延时范围无效")
    sleep(uniform(minimum_seconds, maximum_seconds))
