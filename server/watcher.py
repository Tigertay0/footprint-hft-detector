"""Always-on watcher.

Follows a watchlist during US market hours and pushes a notification the moment the model flags a
ticker. It reuses the notebook's LiveMonitor, so an early warning fires on the first minute that
looks wrong, and a confirmation or a clear follows about five minutes later.

The one thing it must never do is look healthy while it is not. Every failure it can detect (dead or
stale feed, a ticker that cannot be scored, a phone that cannot be reached, a paused computer) is
announced, and the status it records says "degraded" instead of "watching".

Run:  python server/watcher.py            (settings in watcher.json and watcher.env)
Try:  python server/watcher.py --dry-run  (prints notifications instead of sending them)
      python server/watcher.py --test-notify
"""
from __future__ import annotations

import argparse
import json
import logging
import logging.handlers
import os
import signal
import sys
import threading
import time
import urllib.request
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import date, time as dtime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import holidays
import pandas as pd

import analysis as A
import engine as E
from errors import UserError
from notify import DEFAULT_SERVER, DryRunNotifier, Message, Notifier, NtfyNotifier
from store import AlertStore, data_dir
from validation import MAX_WATCHLIST, normalize_ticker

log = logging.getLogger("footprint.watcher")
ROOT = Path(__file__).resolve().parent.parent

PREP_START = dtime(9, 15)             # models are trained before the bell
OPEN = dtime(9, 30)
CLOSE = dtime(16, 0)
EARLY_CLOSE = dtime(13, 0)            # half days: day after Thanksgiving, Dec 24, July 3
CLOSE_GRACE = timedelta(minutes=2)    # the last minute's bar is published just after the close
IDLE_SLEEP_SECONDS = 60
PREP_SLEEP_SECONDS = 30
RETRY_TRAIN_AFTER = timedelta(minutes=5)
RENOTIFY_EVERY = timedelta(hours=1)
FEED_FAILURES_BEFORE_NOTICE = 5
FIRST_DATA_DEADLINE = dtime(9, 45)    # silence before this is normal, after it is worth mentioning
EMPTY_FEED_FROM = dtime(9, 35)        # from here on, an answer with no bars for anyone counts as a failed feed
STALE_AFTER = timedelta(minutes=10)   # no new bar for this long during the session is reported
GAP_AFTER = timedelta(minutes=3)      # a longer pause between checks means the computer was asleep or stalled
STEP_FAILURES_BEFORE_NOTICE = 3
TICK_FAILURES_BEFORE_NOTICE = 3
MAX_DELIVERY_ATTEMPTS = 10
DIGEST_LINES = 5
PING_EVERY = timedelta(minutes=1)
MIN_TRAINING_SESSIONS = 3
QUIET, NORMAL, HIGH, URGENT = 2, 3, 4, 5
SETUP_PROBLEM_EXIT = 2                # the supervisor stops restarting on this code

CONFIG_KEYS = {"tickers", "sensitivity", "poll_seconds", "history_days", "notify_cleared", "daily_summary",
               "max_alerts_per_hour", "app_url", "heartbeat_url"}


# ---------------------------------------------------------------- settings
@dataclass(frozen=True)
class WatcherConfig:
    tickers: tuple[str, ...]
    sensitivity: str = "balanced"
    poll_seconds: int = 20
    history_days: int = 10
    notify_cleared: bool = True
    daily_summary: bool = True
    max_alerts_per_hour: int = 20
    app_url: str | None = None
    heartbeat_url: str | None = None     # pinged while healthy, so a dead-man's-switch service can warn you if pings stop


def _int_in(raw: dict[str, Any], key: str, default: int, low: int, high: int) -> int:
    value = raw.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise UserError(f"watcher.json: '{key}' must be a whole number from {low} to {high}.")
    return value


def _url(raw: dict[str, Any], key: str, schemes: tuple[str, ...]) -> str | None:
    value = raw.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.startswith(schemes):
        raise UserError(f"watcher.json: '{key}' must start with {' or '.join(schemes)}.")
    return value.rstrip("/")


def parse_config(raw: Any) -> WatcherConfig:
    if not isinstance(raw, dict):
        raise UserError("watcher.json must contain a JSON object.")
    unknown = sorted(set(raw) - CONFIG_KEYS)
    if unknown:
        raise UserError(f"watcher.json: unknown setting(s) {', '.join(unknown)}. Check the spelling.")
    tickers_raw = raw.get("tickers")
    if not isinstance(tickers_raw, list) or not tickers_raw or not all(isinstance(t, str) for t in tickers_raw):
        raise UserError("watcher.json: 'tickers' must be a list such as [\"TSLA\", \"AAPL\"].")
    tickers = tuple(dict.fromkeys(normalize_ticker(t) for t in tickers_raw))
    if len(tickers) > MAX_WATCHLIST:
        raise UserError(f"watcher.json: at most {MAX_WATCHLIST} tickers, so Yahoo is not asked for too much at once.")
    sensitivity = raw.get("sensitivity", "balanced")
    if sensitivity not in A.SENSITIVITY:
        raise UserError("watcher.json: 'sensitivity' must be strict, balanced or sensitive.")
    for flag in ("notify_cleared", "daily_summary"):
        if not isinstance(raw.get(flag, True), bool):
            raise UserError(f"watcher.json: '{flag}' must be true or false.")
    return WatcherConfig(
        tickers=tickers, sensitivity=sensitivity,
        poll_seconds=_int_in(raw, "poll_seconds", 20, 10, 300),
        history_days=_int_in(raw, "history_days", 10, 7, 29),
        notify_cleared=raw.get("notify_cleared", True), daily_summary=raw.get("daily_summary", True),
        max_alerts_per_hour=_int_in(raw, "max_alerts_per_hour", 20, 1, 200),
        app_url=_url(raw, "app_url", ("http://", "https://")), heartbeat_url=_url(raw, "heartbeat_url", ("https://",)))


def load_config(path: Path) -> WatcherConfig:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        raise UserError(f"No {path.name} found. Copy watcher.example.json to {path.name} and list your tickers.") from None
    except UnicodeDecodeError:
        raise UserError(f"{path.name} must be saved as plain text (UTF-8).") from None
    try:
        return parse_config(json.loads(text))
    except json.JSONDecodeError as exc:
        raise UserError(f"{path.name} is not valid JSON ({exc.msg} on line {exc.lineno}).") from exc


def load_env_file(path: Path) -> dict[str, str]:
    """KEY=VALUE lines, # comments allowed. Real environment variables take precedence."""
    values: dict[str, str] = {}
    if path.exists():
        try:
            text = path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            raise UserError(f"{path.name} must be saved as plain text (UTF-8 or ASCII).") from None
        for line in text.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip("\"'")
    return {**values, **{k: v for k, v in os.environ.items() if k.startswith("NTFY_")}}


# ---------------------------------------------------------------- market calendar
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


def session_phase(now: pd.Timestamp) -> Literal["closed", "prep", "open"]:
    """'prep' is the quarter hour before the bell, when models are trained. 'open' includes the close grace."""
    if not is_trading_day(now.date()):
        return "closed"
    clock = now.time()
    if clock < PREP_START:
        return "closed"
    if clock < OPEN:
        return "prep"
    close = (pd.Timestamp.combine(now.date(), close_time(now.date())) + CLOSE_GRACE).time()
    return "open" if clock < close else "closed"


def next_session_start(now: pd.Timestamp) -> pd.Timestamp:
    """Calendar dates are stepped as dates, never as 24-hour blocks, so clock changes cannot shift the answer."""
    day = now.date()
    while True:
        start = pd.Timestamp.combine(day, PREP_START).tz_localize(E.NY)
        if is_trading_day(day) and start > now:
            return start
        day += timedelta(days=1)


def session_open(now: pd.Timestamp) -> pd.Timestamp:
    return pd.Timestamp.combine(now.date(), OPEN).tz_localize(E.NY)


def now_et() -> pd.Timestamp:
    return pd.Timestamp.now(tz=E.NY)


# ---------------------------------------------------------------- data feed
def fetch_batch(tickers: list[str]) -> dict[str, pd.DataFrame | None]:
    """Today's completed one-minute bars for every ticker, in one Yahoo request."""
    import yfinance as yf
    raw = yf.download(tickers, period="1d", interval="1m", group_by="ticker", auto_adjust=False,
                      progress=False, threads=False)
    out: dict[str, pd.DataFrame | None] = {t: None for t in tickers}
    if raw is None or raw.empty:
        return out
    for ticker in tickers:
        try:
            frame = raw[ticker].dropna(how="all")
            out[ticker] = E._completed_only(E._clean(frame)) if len(frame) else None
        except Exception:                             # noqa: BLE001 - one odd ticker must not look like a dead feed
            log.warning("no usable bars for %s in this poll", ticker)
    return out


def ping_url(url: str) -> None:
    """Tells a dead-man's-switch service (for example healthchecks.io) that the watcher is alive."""
    try:
        with urllib.request.urlopen(url, timeout=5):         # noqa: S310 - https is enforced when the setting is read
            pass
    except Exception as exc:                          # noqa: BLE001 - a failed ping must never disturb the watcher
        log.warning("heartbeat ping failed (%s)", type(exc).__name__)


# ---------------------------------------------------------------- messages
def _cap(text: str) -> str:
    return text[:1].upper() + text[1:]


def build_message(ticker: str, kind: str, about: pd.Timestamp, sent: pd.Timestamp, text: str,
                  cfg: WatcherConfig) -> Message | None:
    """Turns one monitor event into a notification. None means 'record it, do not notify'."""
    click = f"{cfg.app_url}/#/alerts" if cfg.app_url else None
    when = f"{sent:%H:%M} ET"
    if kind == "EARLY WARNING":
        return Message(f"{ticker}: possible HFT activity",
                       f"{when}, minute {about:%H:%M}. {_cap(text)}\nA warning sign, not proof of manipulation.",
                       HIGH, ("warning",), click)
    if kind in ("CONFIRMED", "ALERT"):
        title = f"{ticker}: pattern confirmed" if kind == "CONFIRMED" else f"{ticker}: HFT-like pattern"
        return Message(title, f"{when}. {text}", URGENT, ("rotating_light",), click)
    if kind == "CLEARED" and cfg.notify_cleared:
        return Message(f"{ticker}: warning cleared", f"{when}. The {about:%H:%M} warning cleared. {_cap(text)}",
                       QUIET, ("white_check_mark",), click)
    return None


# ---------------------------------------------------------------- the watcher
@dataclass
class Tracker:
    ticker: str
    monitor: E.LiveMonitor
    last_fresh: pd.Timestamp                # when a new bar last arrived (or the session opened)
    last_bar: pd.Timestamp | None = None    # time of the newest bar seen
    stale: bool = False
    step_failures: int = 0
    scoring_down: bool = False


@dataclass
class Pending:
    alert_id: int
    message: Message
    label: str
    attempts: int = 0


class Watcher:
    def __init__(self, cfg: WatcherConfig, notifier: Notifier, store: AlertStore, *,
                 load_history: Callable[[str, int], pd.DataFrame] = E.load_yfinance,
                 fetch: Callable[[list[str]], dict[str, pd.DataFrame | None]] = fetch_batch,
                 clock: Callable[[], pd.Timestamp] = now_et,
                 ping: Callable[[str], None] = ping_url) -> None:
        self.cfg, self.notifier, self.store = cfg, notifier, store
        self.load_history, self.fetch, self.clock, self.ping = load_history, fetch, clock, ping
        self.engine_cfg = A.make_cfg(cfg.sensitivity, "watch", cfg.history_days, "yfinance")
        self.session_date: str | None = None
        self.trackers: dict[str, Tracker] = {}
        self.retry_at: dict[str, pd.Timestamp] = {}
        self.retry_notified: dict[str, pd.Timestamp] = {}
        self.feed_failures = 0
        self.feed_alerted = False
        self.notify_failing = False
        self.tick_failures = 0
        self.last_tick: pd.Timestamp | None = None
        self.last_ping: pd.Timestamp | None = None
        self.sent_times: deque[pd.Timestamp] = deque()
        self.limit_notice_sent = False
        self.pending: list[Pending] = []
        self.held: list[Pending] = []

    # -------------------------------------------------------- main loop
    def run_forever(self, stop: threading.Event) -> None:
        log.info("watching %s (%s)", ", ".join(self.cfg.tickers), self.cfg.sensitivity)
        _keep_awake(True)
        try:
            while not stop.is_set():
                try:
                    delay = self.tick()
                    self.tick_failures = 0
                except Exception:                     # noqa: BLE001 - the watcher must outlive any single bad pass
                    log.exception("tick failed")
                    self.tick_failures += 1
                    if self.tick_failures == TICK_FAILURES_BEFORE_NOTICE:
                        self._send(Message("Footprint watcher is having trouble",
                                           "Its checks keep failing. Alerts may be missed. See data\\logs\\watcher.log.", NORMAL, ("warning",)))
                    self._beat("degraded", f"{self.tick_failures} failed checks in a row. See data\\logs\\watcher.log.")
                    delay = float(self.cfg.poll_seconds)
                stop.wait(delay)
        finally:
            _keep_awake(False)
            self._beat("stopped", "The watcher was stopped.")
            log.info("stopped")

    def tick(self) -> float:
        """One pass. Returns how many seconds to wait before the next one."""
        now = self.clock()
        phase = session_phase(now)
        if phase == "closed":
            if self.session_date is not None:
                self._end_session()
            self.last_tick = None
            self._flush(now)
            nxt = next_session_start(now)
            self._beat("sleeping", f"Next session prepares {nxt:%a %d %b %H:%M} ET")
            return IDLE_SLEEP_SECONDS
        today = f"{now:%Y-%m-%d}"
        if self.session_date != today:
            self._start_session(today, now)
        self._check_gap(now)
        self._retry_training(now)
        if phase == "prep":
            self.last_tick = now
            self._beat("preparing", "Models are trained. Waiting for the bell.")
            return PREP_SLEEP_SECONDS
        self._poll(now)
        self._check_stale(now)
        self._flush(now)
        self.last_tick = now
        self._beat_session(now)
        return float(self.cfg.poll_seconds)

    # -------------------------------------------------------- status
    def _issues(self, now: pd.Timestamp) -> list[str]:
        issues = []
        if self.feed_failures:
            issues.append(f"the data feed failed {self.feed_failures} times in a row")
        issues += [f"{t} has had no new data since {tr.last_bar:%H:%M}" if tr.last_bar is not None else f"{t} has had no data today"
                   for t, tr in self.trackers.items() if tr.stale]
        issues += [f"{t} cannot be scored" for t, tr in self.trackers.items() if tr.scoring_down]
        if self.retry_at:
            issues.append(f"not watching {', '.join(self.retry_at)}")
        if self.notify_failing:
            issues.append("notifications are failing")
        if self.pending:
            issues.append(f"{len(self.pending)} alert(s) not delivered yet")
        return issues

    def _beat_session(self, now: pd.Timestamp) -> None:
        issues = self._issues(now)
        newest = max((tr.last_bar for tr in self.trackers.values() if tr.last_bar is not None), default=None)
        seen = f"latest bar {newest:%H:%M} ET" if newest is not None else "no bars yet"
        if issues:
            self._beat("degraded", f"{'; '.join(issues)}. Checked {now:%H:%M:%S} ET, {seen}.")
        else:
            self._beat("watching", f"Checked at {now:%H:%M:%S} ET, {seen}")

    def _beat(self, state: str, detail: str) -> None:
        try:
            self.store.heartbeat(state, list(self.trackers) or list(self.cfg.tickers), detail)
        except Exception:                             # noqa: BLE001 - a full disk must not stop the alerts themselves
            log.exception("could not record the heartbeat")
        now = self.clock()
        if (self.cfg.heartbeat_url and state not in ("degraded", "stopped")
                and (self.last_ping is None or now - self.last_ping >= PING_EVERY)):
            self.last_ping = now
            self.ping(self.cfg.heartbeat_url)

    # -------------------------------------------------------- session
    def _start_session(self, today: str, now: pd.Timestamp) -> None:
        self.session_date, self.trackers, self.retry_at, self.retry_notified = today, {}, {}, {}
        self.feed_failures, self.feed_alerted, self.limit_notice_sent = 0, False, False
        self.sent_times.clear()
        for ticker in self.cfg.tickers:
            if not self._train(ticker, now):
                self.retry_at[ticker] = now + RETRY_TRAIN_AFTER
                self.retry_notified[ticker] = now
        ready = ", ".join(self.trackers) or "nothing yet"
        body = f"Watching {ready} today. The model needs about 10 minutes of the session before it can flag anything."
        if self.retry_at:
            body += f" Could not start {', '.join(self.retry_at)}. Retrying every 5 minutes."
        if self.cfg.daily_summary or self.retry_at:      # a ticker that is not being watched is never optional news
            self._send(Message("Footprint is watching" if not self.retry_at else "Footprint could not start every ticker",
                               body, QUIET if not self.retry_at else NORMAL, ("eyes",) if not self.retry_at else ("warning",)))

    def _train(self, ticker: str, now: pd.Timestamp) -> bool:
        try:
            history = self.load_history(ticker, self.cfg.history_days)
            history = history[history.index.normalize() < now.normalize()]
            sessions = history.index.normalize().nunique()
            if sessions < MIN_TRAINING_SESSIONS:
                raise UserError(f"only {sessions} past sessions are available")
            detector = E.HFTDetector(self.engine_cfg).fit(E.build_features(history, self.engine_cfg))
        except Exception:                             # noqa: BLE001 - one bad ticker must not stop the others
            log.exception("could not train %s", ticker)
            return False
        monitor = E.LiveMonitor(detector, lambda: None, self.engine_cfg, log=lambda *_: None)
        self.trackers[ticker] = Tracker(ticker, monitor, last_fresh=max(now, session_open(now)))
        log.info("trained %s on %s past sessions", ticker, sessions)
        return True

    def _retry_training(self, now: pd.Timestamp) -> None:
        """At most one retry per pass, so a slow download cannot stall the tickers that are working."""
        for ticker, due in sorted(self.retry_at.items(), key=lambda item: item[1]):
            if now < due:
                continue
            if self._train(ticker, now):
                del self.retry_at[ticker]
                self.retry_notified.pop(ticker, None)
                self._send(Message(f"{ticker}: now being watched", f"{ticker} is being watched again.", QUIET, ("white_check_mark",)))
            else:
                self.retry_at[ticker] = now + RETRY_TRAIN_AFTER
                if now - self.retry_notified.get(ticker, now) >= RENOTIFY_EVERY:
                    self.retry_notified[ticker] = now
                    self._send(Message(f"{ticker}: still not watched", f"{ticker} still cannot be started. Retrying every 5 minutes.", NORMAL, ("warning",)))
            return

    def _end_session(self) -> None:
        counts = self.store_counts()
        unresolved = [f"{t} {w:%H:%M}" for t, tr in self.trackers.items()
                      for w in sorted(set(tr.monitor.warnings) - tr.monitor.resolved)]
        if self.cfg.daily_summary:
            body = (f"Market closed. Today: {counts.get('EARLY WARNING', 0)} early warnings, "
                    f"{counts.get('CONFIRMED', 0) + counts.get('ALERT', 0)} confirmed, {counts.get('CLEARED', 0)} cleared.")
            if unresolved:
                body += f" Never confirmed or cleared before the close: {', '.join(unresolved)}."
            self._send(Message("Footprint: market closed", body, QUIET, ("zzz",)))
        self.session_date, self.trackers, self.retry_at, self.retry_notified = None, {}, {}, {}

    def store_counts(self) -> dict[str, int]:
        try:
            return self.store.count_today(self.session_date or "")
        except Exception:                             # noqa: BLE001
            log.exception("could not read today's alert counts")
            return {}

    def _check_gap(self, now: pd.Timestamp) -> None:
        """A long pause between checks (sleep, hibernation, a stall) means minutes went unchecked."""
        if self.last_tick is None or now - self.last_tick <= GAP_AFTER:
            return
        self._send(Message("Footprint was paused",
                           f"No checks ran from {self.last_tick:%H:%M} to {now:%H:%M} ET. Those minutes were not checked, "
                           "and warnings that were pending then will not be confirmed or cleared.", NORMAL, ("warning",)))
        for tracker in self.trackers.values():
            tracker.last_fresh = now

    # -------------------------------------------------------- polling
    def _poll(self, now: pd.Timestamp) -> None:
        active = list(self.trackers)
        if not active:
            return
        try:
            frames = self.fetch(active)
        except Exception:                             # noqa: BLE001 - network and Yahoo errors vary widely
            log.exception("data feed request failed")
            self._feed_failed()
            return
        today = now.normalize()
        usable: dict[str, pd.DataFrame] = {}
        for ticker in active:
            frame = frames.get(ticker)
            if frame is not None and len(frame):
                frame = frame[frame.index.normalize() == today]    # before the bell Yahoo still serves yesterday
            if frame is not None and not frame.empty:
                usable[ticker] = frame
        if not usable and now.time() >= EMPTY_FEED_FROM:
            log.error("the data feed answered with no bars for any ticker")
            self._feed_failed()                       # an empty answer is not proof that the feed works
            return
        if usable:
            self._feed_ok()
        for ticker, frame in usable.items():
            tracker = self.trackers[ticker]
            last = frame.index[-1]
            if tracker.last_bar is not None and last <= tracker.last_bar:
                continue
            tracker.last_bar, tracker.last_fresh = last, now
            if tracker.stale:
                tracker.stale = False
                self._send(Message(f"{ticker}: data is back", f"{ticker} is receiving data again.", QUIET, ("white_check_mark",)))
            self._step(tracker, frame)

    def _check_stale(self, now: pd.Timestamp) -> None:
        """Time-based, so it works for any poll interval and catches data that keeps returning the same bars."""
        if now.time() < FIRST_DATA_DEADLINE:
            return
        for ticker, tracker in self.trackers.items():
            if tracker.stale or now - tracker.last_fresh <= STALE_AFTER:
                continue
            tracker.stale = True
            since = f"since {tracker.last_bar:%H:%M} ET" if tracker.last_bar is not None else "today"
            self._send(Message(f"{ticker}: no fresh data", f"No new minute bars for {ticker} {since}. "
                               "It is not being checked until data arrives.", NORMAL, ("warning",)))

    def _step(self, tracker: Tracker, frame: pd.DataFrame) -> None:
        monitor = tracker.monitor
        monitor.fetch = lambda: frame
        before = len(monitor.events)
        try:
            monitor.step()
        except Exception:                             # noqa: BLE001 - keep watching the other tickers
            log.exception("monitor step failed for %s", tracker.ticker)
            tracker.step_failures += 1
            if tracker.step_failures >= STEP_FAILURES_BEFORE_NOTICE and not tracker.scoring_down:
                tracker.scoring_down = True
                self._send(Message(f"{tracker.ticker}: not being scored",
                                   f"The model keeps failing on {tracker.ticker}. It is not being checked.", NORMAL, ("warning",)))
        else:
            tracker.step_failures = 0
            if tracker.scoring_down:
                tracker.scoring_down = False
                self._send(Message(f"{tracker.ticker}: scoring recovered", f"{tracker.ticker} is being checked again.", QUIET, ("white_check_mark",)))
        finally:                                      # events emitted before a failure must still reach the phone
            for event in monitor.events[before:]:
                self._handle(tracker.ticker, event)

    def _feed_failed(self) -> None:
        self.feed_failures += 1
        log.error("data feed failed (%s in a row)", self.feed_failures)
        if self.feed_failures >= FEED_FAILURES_BEFORE_NOTICE and not self.feed_alerted:
            self.feed_alerted = True
            self._send(Message("Footprint cannot reach the data feed",
                               "Alerts are paused until it recovers. Silence now does not mean the market is quiet.",
                               NORMAL, ("warning",)))

    def _feed_ok(self) -> None:
        if self.feed_alerted:
            self._send(Message("Footprint data feed is back", "Watching again.", QUIET, ("white_check_mark",)))
        self.feed_failures, self.feed_alerted = 0, False

    # -------------------------------------------------------- alerts
    def _handle(self, ticker: str, event: dict[str, Any]) -> None:
        kind, about, sent, text = event["kind"], event["minute"], event["sent"], event["text"]
        day = self.session_date or f"{sent:%Y-%m-%d}"
        about_text, sent_text = f"{about:%H:%M}", f"{sent:%H:%M}"
        try:
            if self.store.has_alert(ticker, kind, day, about_text):
                log.info("%s %s about %s was already recorded, skipping", ticker, kind, about_text)
                return
        except Exception:                             # noqa: BLE001 - better a repeat than a missed alert
            log.exception("could not check the alert history")
        log.info("%s %s about %s", ticker, kind, about_text)
        message = build_message(ticker, kind, about, sent, text, self.cfg)
        if message is None:
            delivered, note = False, "saved only (setting)"
        else:
            delivered, note = self._deliver(message)           # the phone comes first, the history second
        alert_id = self._record(ticker, kind, day, about_text, sent_text, text, delivered, note)
        label = f"{ticker} {about_text}"
        if message is not None and note == "delivery failed":
            self.pending.append(Pending(alert_id, message, label))
        elif note == "held back: hourly limit" and message is not None:
            self.held.append(Pending(alert_id, message, label))

    def _record(self, ticker: str, kind: str, day: str, about: str, sent: str, text: str, delivered: bool, note: str | None) -> int:
        try:
            alert_id = self.store.add_alert(ticker, kind, day, about, sent, text)
            self.store.mark_notified(alert_id, delivered, note)
            return alert_id
        except Exception:                             # noqa: BLE001 - the push already went out or was queued
            log.exception("could not save the alert to the history")
            return -1

    def _window_room(self, now: pd.Timestamp) -> bool:
        while self.sent_times and now - self.sent_times[0] > timedelta(hours=1):
            self.sent_times.popleft()
        room = len(self.sent_times) < self.cfg.max_alerts_per_hour
        if room:
            self.limit_notice_sent = False
        return room

    def _deliver(self, message: Message) -> tuple[bool, str | None]:
        """Sends one alert. Urgent (confirmed) alerts are never held back. Early warnings share an hourly cap."""
        now = self.clock()
        capped = message.priority == HIGH
        if capped and not self._window_room(now):
            if not self.limit_notice_sent:
                self.limit_notice_sent = self._push(Message(
                    "Footprint: alert limit reached",
                    f"More than {self.cfg.max_alerts_per_hour} warnings in an hour. Further ones are saved and sent "
                    "together as a digest when the hour allows. Confirmed alerts still come through.", NORMAL, ("warning",)))
            return False, "held back: hourly limit"
        ok = self._push(message)
        if ok and capped:
            self.sent_times.append(now)               # only deliveries count against the cap
        return ok, None if ok else "delivery failed"

    def _push(self, message: Message) -> bool:
        try:
            ok = bool(self.notifier.send(message))
        except Exception:                             # noqa: BLE001 - treat any sender error as 'not delivered'
            log.exception("notifier raised while sending")
            ok = False
        self.notify_failing = not ok
        if not ok:
            log.error("notification was NOT delivered: %s", message.title)
        return ok

    def _send(self, message: Message) -> None:
        self._push(message)

    def _flush(self, now: pd.Timestamp) -> None:
        """Retries alerts that could not be delivered, and sends held-back warnings as one digest."""
        for item in list(self.pending)[: 1 if self.notify_failing else len(self.pending)]:
            item.attempts += 1
            if self._push(replace(item.message, title=f"{item.message.title} (delayed)")):
                self._mark(item.alert_id, True, "delivered late")
                self.pending.remove(item)
            elif item.attempts >= MAX_DELIVERY_ATTEMPTS:
                log.error("giving up on delivering %s after %s attempts", item.label, item.attempts)
                self._mark(item.alert_id, False, f"gave up after {item.attempts} attempts")
                self.pending.remove(item)
        if self.held and self._window_room(now):
            lines = [p.label for p in self.held[:DIGEST_LINES]]
            if len(self.held) > DIGEST_LINES:
                lines.append(f"and {len(self.held) - DIGEST_LINES} more")
            digest = Message("Footprint: warnings held back earlier", "Held back by the hourly limit:\n" + "\n".join(lines),
                             HIGH, ("warning",), f"{self.cfg.app_url}/#/alerts" if self.cfg.app_url else None)
            if self._push(digest):
                self.sent_times.append(now)
                for item in self.held:
                    self._mark(item.alert_id, True, "sent in digest")
                self.held.clear()

    def _mark(self, alert_id: int, delivered: bool, note: str) -> None:
        if alert_id < 0:
            return
        try:
            self.store.mark_notified(alert_id, delivered, note)
        except Exception:                             # noqa: BLE001
            log.exception("could not update the alert history")


# ---------------------------------------------------------------- keep the PC awake
def _keep_awake(on: bool) -> None:
    """While the watcher runs, ask Windows not to sleep. Released automatically when the process ends."""
    if sys.platform != "win32":
        return
    import ctypes
    es_continuous, es_system_required = 0x80000000, 0x00000001
    ctypes.windll.kernel32.SetThreadExecutionState(es_continuous | es_system_required if on else es_continuous)


# ---------------------------------------------------------------- command line
class RepeatFilter(logging.Filter):
    """Stops one persistent error from filling the log: the same message is shown at most every 10 minutes."""

    WINDOW_SECONDS = 600

    def __init__(self) -> None:
        super().__init__()
        self._seen: dict[tuple[str, int, str], tuple[float, int]] = {}

    def filter(self, record: logging.LogRecord) -> bool:
        if record.levelno < logging.ERROR:
            return True
        key = (record.name, record.levelno, record.getMessage()[:200])
        now = time.monotonic()
        last, skipped = self._seen.get(key, (0.0, 0))
        if now - last < self.WINDOW_SECONDS and last:
            self._seen[key] = (last, skipped + 1)
            return False
        if skipped:
            record.msg = f"{record.getMessage()} (repeated {skipped} more times since the last note)"
            record.args = ()
        self._seen[key] = (now, 0)
        return True


def setup_logging(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    handlers: list[logging.Handler] = [
        logging.handlers.RotatingFileHandler(folder / "watcher.log", maxBytes=1_000_000, backupCount=5, encoding="utf-8"),
        logging.StreamHandler(sys.stderr)]
    repeat = RepeatFilter()
    for handler in handlers:
        handler.addFilter(repeat)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", handlers=handlers, force=True)


def build_notifier(secrets: dict[str, str], dry_run: bool) -> Notifier:
    if dry_run:
        return DryRunNotifier()
    topic = secrets.get("NTFY_TOPIC", "")
    if not topic:
        raise UserError("No ntfy topic is set. Put NTFY_TOPIC=your-secret-topic in watcher.env, or run install-watcher.ps1.")
    return NtfyNotifier(topic, secrets.get("NTFY_SERVER", DEFAULT_SERVER), secrets.get("NTFY_TOKEN") or None)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Footprint watcher: push a notification when the model flags a stock.")
    parser.add_argument("--config", type=Path, default=ROOT / "watcher.json")
    parser.add_argument("--env", type=Path, default=ROOT / "watcher.env")
    parser.add_argument("--dry-run", action="store_true", help="print notifications instead of sending them (uses a separate history file)")
    parser.add_argument("--test-notify", action="store_true", help="send one test notification and exit")
    args = parser.parse_args(argv)

    folder = data_dir()
    setup_logging(folder / "logs")
    try:
        return _run(args, folder)
    except Exception:                                 # noqa: BLE001 - the log must say why a headless run ended
        log.exception("the watcher crashed")
        raise


def _run(args: argparse.Namespace, folder: Path) -> int:
    try:
        notifier = build_notifier(load_env_file(args.env), args.dry_run)
        if args.test_notify:
            ok = notifier.send(Message("Footprint test", "If you can read this, alerts will reach you.", NORMAL, ("white_check_mark",)))
            print("Sent. Check your phone." if ok else "Could not send. See data/logs/watcher.log.")
            return 0 if ok else 1
        cfg = load_config(args.config)
    except UserError as exc:
        log.error("Setup problem: %s", exc)           # also lands in data/logs/watcher.log for headless runs
        print(f"Setup problem: {exc}", file=sys.stderr)
        return SETUP_PROBLEM_EXIT

    store = AlertStore(folder / ("alerts-dryrun.db" if args.dry_run else "alerts.db"))
    try:
        store.prune()
    except Exception:                                 # noqa: BLE001 - housekeeping must not block startup
        log.exception("could not remove old alerts")
    stop = threading.Event()
    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), lambda *_: stop.set())
    Watcher(cfg, notifier, store).run_forever(stop)
    store.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
