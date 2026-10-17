"""NYSE trading calendar: regular hours, holidays and half days. Shared by the web app and the watcher."""
from __future__ import annotations

from datetime import date, time as dtime
from functools import lru_cache

import holidays
import pandas as pd

OPEN = dtime(9, 30)
CLOSE = dtime(16, 0)
EARLY_CLOSE = dtime(13, 0)            # half days: day after Thanksgiving, Dec 24, July 3


@lru_cache(maxsize=8)
def _nyse(year: int) -> holidays.HolidayBase:
    return holidays.NYSE(years=year)


def is_trading_day(day: date) -> bool:
    return day.weekday() < 5 and day not in _nyse(day.year)


def is_early_close(day: date) -> bool:
    """NYSE half days. Not every one is listed by the holidays package, so the rules are spelled out here."""
    if not is_trading_day(day):
        return False
    if day.month == 11 and day.weekday() == 4 and 23 <= day.day <= 29:      # Friday after Thanksgiving
        return True
    if day.month == 12 and day.day == 24:
        return True
    return day.month == 7 and day.day == 3 and date(day.year, 7, 4).weekday() < 5


def close_time(day: date) -> dtime:
    return EARLY_CLOSE if is_early_close(day) else CLOSE


def is_open(now: pd.Timestamp) -> bool:
    """True during regular trading hours. `now` must be New York time."""
    return is_trading_day(now.date()) and OPEN <= now.time() < close_time(now.date())
