"""Watcher, notifier and alert-store checks. Nothing here touches the network or a real clock."""
import http.client
import json
import logging
import sqlite3
import sys
import threading
import urllib.error
from datetime import date
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

import engine as E  # noqa: E402
import market_hours as MH  # noqa: E402
import notify as N  # noqa: E402
import store as S  # noqa: E402
import supervisor as SV  # noqa: E402
import watcher as W  # noqa: E402
from errors import UserError  # noqa: E402

NY = E.NY
TOPIC = "secret_topic_123456"


def ts(text: str) -> pd.Timestamp:
    return pd.Timestamp(text, tz=NY)


@pytest.fixture(autouse=True)
def _no_wake_lock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(W, "_keep_awake", lambda on: None)


# ---------------------------------------------------------------- settings
def test_config_defaults_and_ticker_cleanup() -> None:
    cfg = W.parse_config({"tickers": ["tsla", " aapl ", "TSLA"]})
    assert cfg.tickers == ("TSLA", "AAPL")
    assert (cfg.sensitivity, cfg.poll_seconds, cfg.notify_cleared, cfg.max_alerts_per_hour) == ("balanced", 20, True, 20)


@pytest.mark.parametrize("raw, message", [
    ({}, "tickers"),
    ({"tickers": []}, "tickers"),
    ({"tickers": ["TSLA"], "sensitivty": "strict"}, "unknown"),
    ({"tickers": ["TS LA"]}, "not a valid ticker"),
    ({"tickers": ["TSLA"], "sensitivity": "wild"}, "sensitivity"),
    ({"tickers": ["TSLA"], "poll_seconds": 2}, "poll_seconds"),
    ({"tickers": ["TSLA"], "poll_seconds": True}, "poll_seconds"),
    ({"tickers": ["TSLA"], "app_url": "ftp://x"}, "app_url"),
    ({"tickers": ["TSLA"], "heartbeat_url": "http://insecure.example"}, "heartbeat_url"),
    ({"tickers": ["TSLA"], "notify_cleared": "yes"}, "notify_cleared"),
    ({"tickers": [f"T{i}" for i in range(W.MAX_WATCHLIST + 1)]}, "at most"),
    ([], "JSON object"),
])
def test_bad_config_is_explained(raw: object, message: str) -> None:
    with pytest.raises(UserError, match=message):
        W.parse_config(raw)


def test_config_file_errors_name_the_problem(tmp_path: Path) -> None:
    with pytest.raises(UserError, match="Copy watcher.example.json"):
        W.load_config(tmp_path / "watcher.json")
    bad = tmp_path / "watcher.json"
    bad.write_text("{not json")
    with pytest.raises(UserError, match="not valid JSON"):
        W.load_config(bad)
    bad.write_bytes(b"\xff\xfe{\x00}")                         # saved as UTF-16 by a Windows editor
    with pytest.raises(UserError, match="plain text"):
        W.load_config(bad)


def test_files_saved_with_a_byte_order_mark_still_load(tmp_path: Path) -> None:
    path = tmp_path / "watcher.json"
    path.write_text(json.dumps({"tickers": ["TSLA"]}), encoding="utf-8-sig")
    assert W.load_config(path).tickers == ("TSLA",)


def test_env_file_parsing_and_real_environment_wins(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "watcher.env"
    path.write_text(f"# comment\nNTFY_TOPIC = \"{TOPIC}\"\nNTFY_SERVER=https://ntfy.example\n\nignored line\n")
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    monkeypatch.delenv("NTFY_SERVER", raising=False)
    assert N.load_env_file(path) == {"NTFY_TOPIC": TOPIC, "NTFY_SERVER": "https://ntfy.example"}
    monkeypatch.setenv("NTFY_TOPIC", "from_env")
    assert N.load_env_file(path)["NTFY_TOPIC"] == "from_env"


def test_env_file_with_a_byte_order_mark_still_names_the_topic(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "watcher.env"
    path.write_text(f"NTFY_TOPIC={TOPIC}\n", encoding="utf-8-sig")       # what Notepad and PowerShell 5 often write
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    assert N.load_env_file(path)["NTFY_TOPIC"] == TOPIC
    path.write_bytes(b"\xff\xfeN\x00")
    with pytest.raises(UserError, match="plain text"):
        N.load_env_file(path)


def test_missing_topic_is_a_setup_problem() -> None:
    with pytest.raises(UserError, match="NTFY_TOPIC"):
        W.build_notifier({}, dry_run=False)
    assert isinstance(W.build_notifier({}, dry_run=True), N.DryRunNotifier)


# ---------------------------------------------------------------- calendar
@pytest.mark.parametrize("when, phase", [
    ("2026-10-13 09:14", "closed"), ("2026-10-13 09:15", "prep"), ("2026-10-13 09:29", "prep"),
    ("2026-10-13 09:30", "open"), ("2026-10-13 16:01", "open"), ("2026-10-13 16:02", "closed"),
    ("2026-10-17 12:00", "closed"),            # Saturday
    ("2026-11-26 12:00", "closed"),            # Thanksgiving
    ("2026-12-25 12:00", "closed"),            # Christmas
    ("2026-11-27 12:59", "open"), ("2026-11-27 13:01", "open"), ("2026-11-27 13:02", "closed"),   # half day
    ("2026-12-24 13:03", "closed"),            # half day
])
def test_session_phase(when: str, phase: str) -> None:
    assert W.session_phase(ts(when)) == phase


def test_half_days_are_recognised() -> None:
    assert MH.is_early_close(date(2026, 11, 27)) and MH.is_early_close(date(2026, 12, 24))
    assert MH.is_early_close(date(2025, 7, 3)), "July 3 is a half day when July 4 is a weekday"
    assert not MH.is_early_close(date(2026, 10, 13)) and not MH.is_early_close(date(2026, 11, 26))


@pytest.mark.parametrize("when, is_open", [
    ("2026-10-13 09:29", False), ("2026-10-13 09:30", True), ("2026-10-13 15:59", True), ("2026-10-13 16:00", False),
    ("2026-11-26 11:00", False),               # Thanksgiving is a weekday, but the market is shut
    ("2026-11-27 12:59", True), ("2026-11-27 13:00", False),             # half day
    ("2026-10-17 11:00", False),               # Saturday
])
def test_the_web_app_knows_holidays_and_half_days(when: str, is_open: bool) -> None:
    assert MH.is_open(ts(when)) is is_open


def test_next_session_skips_weekends_and_holidays() -> None:
    assert W.next_session_start(ts("2026-10-16 17:00")) == ts("2026-10-19 09:15")      # Friday evening
    assert W.next_session_start(ts("2026-11-25 17:00")) == ts("2026-11-27 09:15")      # day before Thanksgiving
    assert W.next_session_start(ts("2026-10-13 08:00")) == ts("2026-10-13 09:15")


@pytest.mark.parametrize("friday", ["2026-03-06 17:00", "2026-10-30 17:00"])           # the Fridays before clocks change
def test_next_session_is_right_across_clock_changes(friday: str) -> None:
    start = W.next_session_start(ts(friday))
    assert (start.hour, start.minute, start.weekday()) == (9, 15, 0)


# ---------------------------------------------------------------- notifier
class _Capture(BaseHTTPRequestHandler):
    seen: list[dict] = []

    def do_POST(self) -> None:                                        # noqa: N802 - http.server API
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        _Capture.seen.append({"body": body, "auth": self.headers.get("Authorization")})
        reply = json.dumps({"id": "abc123", "event": "message", "topic": body["topic"]}).encode()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(reply)

    def log_message(self, *_: object) -> None:
        pass


def test_ntfy_message_reaches_a_real_local_server_as_json() -> None:
    server = HTTPServer(("127.0.0.1", 0), _Capture)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        notifier = N.NtfyNotifier(TOPIC, f"http://127.0.0.1:{server.server_port}", token="tk_abc", retries=1)
        msg = N.Message("TSLA: possible HFT activity", "Volume 5σ. Warning sign, not proof.", 4, ("warning",), "http://nuc:8000/#/alerts")
        assert notifier.send(msg) is True
    finally:
        server.shutdown()
    sent = _Capture.seen[-1]
    assert sent["body"] == {"topic": TOPIC, "title": msg.title, "message": msg.body, "priority": 4,
                            "tags": ["warning"], "click": "http://nuc:8000/#/alerts"}
    assert sent["auth"] == "Bearer tk_abc"


class _Response:
    def __init__(self, status: int, body: bytes) -> None:
        self.status, self._body = status, body

    def read(self, _n: int = -1) -> bytes:
        return self._body

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_: object) -> None:
        return None


RECEIPT = json.dumps({"id": "x1", "event": "message", "topic": TOPIC}).encode()


def _opener(*results: object):
    calls = {"n": 0}
    queue = list(results)

    def opener(request: object, timeout: float) -> _Response:
        calls["n"] += 1
        result = queue.pop(0)
        if isinstance(result, Exception):
            raise result
        return result  # type: ignore[return-value]

    opener.calls = calls  # type: ignore[attr-defined]
    return opener


def _http_error(code: int, headers: dict | None = None) -> urllib.error.HTTPError:
    import email.message
    msg = email.message.Message()
    for k, v in (headers or {}).items():
        msg[k] = v
    return urllib.error.HTTPError("http://x", code, "err", msg, None)  # type: ignore[arg-type]


def _notifier(opener: object, **kw: object) -> N.NtfyNotifier:
    return N.NtfyNotifier(TOPIC, opener=opener, sleep=lambda _s: None, **kw)  # type: ignore[arg-type]


def test_ntfy_retries_server_errors_then_succeeds() -> None:
    opener = _opener(_http_error(503), urllib.error.URLError("down"), _Response(200, RECEIPT))
    assert _notifier(opener).send(N.Message("t", "b")) is True
    assert opener.calls["n"] == 3


def test_ntfy_honours_retry_after_on_429() -> None:
    waits: list[float] = []
    opener = _opener(_http_error(429, {"Retry-After": "7"}), _Response(200, RECEIPT))
    notifier = N.NtfyNotifier(TOPIC, opener=opener, sleep=waits.append)
    assert notifier.send(N.Message("t", "b")) is True
    assert waits == [7.0]


def test_ntfy_does_not_retry_a_rejected_topic_and_reports_failure() -> None:
    opener = _opener(_http_error(403))
    assert _notifier(opener).send(N.Message("t", "b")) is False
    assert opener.calls["n"] == 1


def test_a_redirect_is_a_failure_not_a_delivery() -> None:
    opener = _opener(_http_error(302))
    assert _notifier(opener).send(N.Message("t", "b")) is False
    assert opener.calls["n"] == 1


@pytest.mark.parametrize("body", [b"<html>captive portal</html>", b"{}", json.dumps({"id": "1", "event": "message", "topic": "someone_else_entirely"}).encode()])
def test_a_200_without_the_right_receipt_is_not_counted_as_delivered(body: bytes) -> None:
    opener = _opener(*[_Response(200, body)] * 3)
    assert _notifier(opener).send(N.Message("t", "b")) is False


def test_ntfy_gives_up_after_the_retries() -> None:
    opener = _opener(*[urllib.error.URLError("down")] * 3)
    assert _notifier(opener).send(N.Message("t", "b")) is False
    assert opener.calls["n"] == 3


@pytest.mark.parametrize("error", [UnicodeEncodeError("latin-1", "é", 0, 1, "bad"), http.client.BadStatusLine("x"), ValueError("bad url")])
def test_unexpected_sender_errors_mean_not_delivered_instead_of_crashing(error: Exception) -> None:
    assert _notifier(_opener(*[error] * 3)).send(N.Message("t", "b")) is False


def test_ntfy_rejects_bad_topic_or_server() -> None:
    with pytest.raises(UserError, match="topic"):
        N.NtfyNotifier("short")
    with pytest.raises(UserError, match="topic"):
        N.NtfyNotifier("bad topic with spaces!")
    with pytest.raises(UserError, match="server"):
        N.NtfyNotifier(TOPIC, "file:///etc/passwd")
    with pytest.raises(UserError, match="https"):
        N.NtfyNotifier(TOPIC, "http://ntfy.example.com")
    N.NtfyNotifier(TOPIC, "http://192.168.1.50:8080")             # a self-hosted server on the home network is fine
    N.NtfyNotifier(TOPIC, "http://nuc")


def test_ntfy_topic_never_appears_in_logs(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level("DEBUG"):
        _notifier(_opener(_http_error(403))).send(N.Message(f"t", "b"))
        _notifier(_opener(*[urllib.error.URLError("down")] * 3)).send(N.Message("t", "b"))
    assert TOPIC not in caplog.text


# ---------------------------------------------------------------- store
def test_store_round_trip_dedupe_prune_and_readonly(tmp_path: Path) -> None:
    path = tmp_path / "x" / "alerts.db"
    store = S.AlertStore(path)
    first = store.add_alert("TSLA", "EARLY WARNING", "2026-10-13", "10:01", "10:02", "score 80/100")
    store.add_alert("AAPL", "CLEARED", "2026-10-13", "10:01", "10:09", "held")
    store.mark_notified(first, True)
    rows = store.recent(10)
    assert [r["ticker"] for r in rows] == ["AAPL", "TSLA"]
    assert next(r for r in rows if r["id"] == first)["notified"] == 1
    assert [r["ticker"] for r in store.recent(10, "TSLA")] == ["TSLA"]
    assert len(store.recent(10_000)) == 2
    assert store.count_today("2026-10-13") == {"EARLY WARNING": 1, "CLEARED": 1}
    assert store.has_alert("TSLA", "EARLY WARNING", "2026-10-13", "10:01")
    assert not store.has_alert("TSLA", "EARLY WARNING", "2026-10-13", "10:02")
    assert store.read_heartbeat() is None
    store.heartbeat("watching", ["TSLA"], "ok")
    store.heartbeat("watching", ["TSLA", "AAPL"], "again")
    beat = store.read_heartbeat()
    assert beat["tickers"] == "TSLA,AAPL" and beat["detail"] == "again"
    assert store.prune(keep_days=-1) == 2 and store.recent(10) == []
    reader = S.AlertStore(path, readonly=True)
    assert reader.read_heartbeat()["detail"] == "again"
    with pytest.raises(sqlite3.OperationalError):
        reader.add_alert("TSLA", "CLEARED", "2026-10-13", "10:01", "10:09", "x")
    reader.close()
    store.close()


# ---------------------------------------------------------------- messages
def _cfg(**over: object) -> W.WatcherConfig:
    return W.parse_config({"tickers": ["TSLA"], **over})


def test_message_priorities_follow_the_alert_kind() -> None:
    about, sent = ts("2026-10-13 10:01"), ts("2026-10-13 10:02")
    early = W.build_message("TSLA", "EARLY WARNING", about, sent, "score 88/100: volume spike", _cfg())
    assert early.priority == W.HIGH and "possible HFT activity" in early.title
    assert early.body.startswith("10:02 ET, minute 10:01. Score 88/100")
    assert "not proof of manipulation" in early.body
    assert W.build_message("TSLA", "CONFIRMED", about, sent, "[HIGH] x", _cfg()).priority == W.URGENT
    assert W.build_message("TSLA", "CLEARED", about, sent, "the move held", _cfg()).priority == W.QUIET
    assert W.build_message("TSLA", "CLEARED", about, sent, "the move held", _cfg(notify_cleared=False)) is None
    assert W.build_message("TSLA", "EARLY WARNING", about, sent, "x", _cfg(app_url="http://nuc:8000/")).click == "http://nuc:8000/#/alerts"


# ---------------------------------------------------------------- helpers for the watcher loop
class Clock:
    def __init__(self, start: pd.Timestamp) -> None:
        self.t = start

    def __call__(self) -> pd.Timestamp:
        return self.t

    def advance(self, **kw: float) -> None:
        self.t = self.t + pd.Timedelta(**kw)


class Recorder:
    """A notifier that records every attempt and can be told to fail or raise."""

    def __init__(self, clock: Clock | None = None, ok: bool = True) -> None:
        self.attempts: list[N.Message] = []
        self.times: list[pd.Timestamp] = []
        self.ok, self.fail_next, self.raises, self.clock = ok, 0, False, clock

    @property
    def sent(self) -> list[N.Message]:
        return self.attempts

    def send(self, message: N.Message) -> bool:
        self.attempts.append(message)
        if self.clock:
            self.times.append(self.clock())
        if self.raises:
            raise RuntimeError("sender exploded")
        if self.fail_next > 0:
            self.fail_next -= 1
            return False
        return self.ok

    def titles(self) -> list[str]:
        return [m.title for m in self.attempts]


def event(kind: str = "EARLY WARNING", about: str = "10:01", sent: str = "10:02", text: str = "score 80/100: volume spike", day: str = "2026-10-13") -> dict:
    return {"kind": kind, "minute": ts(f"{day} {about}"), "sent": ts(f"{day} {sent}"), "text": text}


@pytest.fixture(scope="module")
def world():
    """A synthetic session with planted events on a real trading day, plus history before it."""
    bars = E.make_synthetic(days=20, seed=5, start="2026-09-08")
    cfg = dict(E.DEFAULT_CONFIG)
    train, _test, injected, events = E.planted_setup(bars, cfg)
    days = [d for d in injected.index.normalize().unique() if W.is_trading_day(d.date())]
    day = days[0]
    return {"history": train, "day": day, "bars": injected[injected.index.normalize() == day],
            "events": [e for e in events if e.normalize() == day]}


def make(tmp_path: Path, world: dict, start: str = "09:20", cfg: W.WatcherConfig | None = None, **kw: object):
    clock = Clock(world["day"] + pd.Timedelta(hours=int(start[:2]), minutes=int(start[3:])))
    rec = kw.pop("notifier", None) or Recorder(clock)
    store = kw.pop("store", None) or S.AlertStore(tmp_path / "a.db")
    watcher = W.Watcher(cfg or _cfg(max_alerts_per_hour=200), rec, store, clock=clock,
                        load_history=kw.pop("load_history", lambda _t, _d: world["history"]),
                        fetch=kw.pop("fetch", lambda tickers: {t: world["bars"].iloc[:60] for t in tickers}),
                        ping=kw.pop("ping", lambda _u: None))
    return watcher, store, rec, clock


class FakeMonitor:
    def __init__(self) -> None:
        self.events: list[dict] = []
        self.warnings: dict = {}
        self.resolved: set = set()
        self.fetch = None
        self.mode = "ok"

    def step(self) -> None:
        if self.mode == "emit_then_fail":
            self.events.append(event())
            raise RuntimeError("boom")
        if self.mode == "fail":
            raise RuntimeError("boom")


def with_fake_tracker(watcher: W.Watcher, clock: Clock, mode: str = "ok") -> W.Tracker:
    watcher.session_date = f"{clock.t:%Y-%m-%d}"
    tracker = W.Tracker("TSLA", FakeMonitor(), last_fresh=clock.t)           # type: ignore[arg-type]
    tracker.monitor.mode = mode                                              # type: ignore[attr-defined]
    watcher.trackers["TSLA"] = tracker
    return tracker


def run_day(world: dict, tmp_path: Path, cfg: W.WatcherConfig, **kw: object):
    watcher, store, rec, clock = make(tmp_path, world, cfg=cfg, **kw)
    bars = world["bars"]
    holder = {"i": 0}
    watcher.fetch = kw.get("fetch") or (lambda tickers: {t: bars.iloc[: holder["i"]] for t in tickers})   # type: ignore[assignment]
    watcher.tick()                                                   # preparation: trains the models
    for i in range(1, len(bars) + 1):
        holder["i"] = i
        clock.t = bars.index[i - 1] + pd.Timedelta(seconds=61)
        watcher.tick()
    clock.t = world["day"] + pd.Timedelta(hours=16, minutes=3)
    watcher.tick()                                                   # after the close
    return watcher, store, rec


# ---------------------------------------------------------------- a full simulated day
def test_full_day_sends_early_warnings_at_once_and_resolves_them(world: dict, tmp_path: Path) -> None:
    watcher, store, rec = run_day(world, tmp_path, _cfg(max_alerts_per_hour=200))
    kinds = [r["kind"] for r in reversed(store.recent(200))]
    assert "EARLY WARNING" in kinds and set(kinds) <= {"EARLY WARNING", "CONFIRMED", "CLEARED", "ALERT"}
    titles = rec.titles()
    assert titles[0] == "Footprint is watching" and rec.sent[0].priority == W.QUIET
    assert "10 minutes" in rec.sent[0].body, "the first message explains the warm-up"
    assert titles[-1] == "Footprint: market closed" and "early warnings" in rec.sent[-1].body
    early = [m for m in rec.sent if m.priority == W.HIGH]
    assert early and all("possible HFT activity" in m.title for m in early)
    assert any(m.priority == W.URGENT for m in rec.sent), "a planted push should be confirmed"
    assert all(r["notified"] == 1 for r in store.recent(200))
    assert watcher.session_date is None, "the session ends after the close"
    assert store.read_heartbeat()["state"] == "sleeping"


def test_warning_arrives_in_the_minute_it_is_flagged(world: dict, tmp_path: Path) -> None:
    _watcher, _store, rec = run_day(world, tmp_path, _cfg(max_alerts_per_hour=200))
    first_early = next(m for m in rec.sent if m.priority == W.HIGH)
    minute = first_early.body.split("minute ")[1][:5]
    assert pd.Timestamp(f"2026-01-01 {first_early.body[:5]}") - pd.Timestamp(f"2026-01-01 {minute}") <= pd.Timedelta(minutes=1)


def test_cleared_can_be_saved_without_notifying(world: dict, tmp_path: Path) -> None:
    _watcher, store, rec = run_day(world, tmp_path, _cfg(notify_cleared=False, max_alerts_per_hour=200))
    assert not any("cleared" in m.title for m in rec.sent)
    assert any(r["kind"] == "CLEARED" and r["note"] == "saved only (setting)" for r in store.recent(200))


def test_hourly_cap_limits_warnings_but_never_confirmed_alerts(world: dict, tmp_path: Path) -> None:
    _watcher, store, rec = run_day(world, tmp_path, _cfg(max_alerts_per_hour=1))
    high = [t for m, t in zip(rec.sent, rec.times) if m.priority == W.HIGH]
    for now in high:
        assert sum(1 for earlier in high if earlier <= now and now - earlier < pd.Timedelta(hours=1)) <= 1, "cap breached"
    assert any("alert limit reached" in m.title for m in rec.sent)
    rows = store.recent(200)
    assert any(r["note"] in ("held back: hourly limit", "sent in digest") for r in rows)
    confirmed_rows = [r for r in rows if r["kind"] in ("CONFIRMED", "ALERT")]
    assert confirmed_rows and all(r["notified"] == 1 for r in confirmed_rows), "confirmed alerts are never held back"


def test_failed_deliveries_are_recorded_and_retried_not_lost(world: dict, tmp_path: Path) -> None:
    clock = Clock(world["day"] + pd.Timedelta(hours=9, minutes=20))
    rec = Recorder(clock, ok=False)
    _w, store, rec = run_day(world, tmp_path, _cfg(max_alerts_per_hour=200), notifier=rec)
    rows = store.recent(200)
    assert rows and all(r["notified"] == 0 for r in rows)
    assert all((r["note"] or "").startswith(("delivery failed", "gave up")) for r in rows)
    assert any("(delayed)" in m.title for m in rec.sent), "undelivered alerts are retried on later passes"


# ---------------------------------------------------------------- failures must be loud, never silent
def test_events_emitted_before_a_monitor_failure_still_reach_the_phone(world: dict, tmp_path: Path) -> None:
    watcher, store, rec, clock = make(tmp_path, world, start="10:00")
    tracker = with_fake_tracker(watcher, clock, "emit_then_fail")
    watcher._step(tracker, world["bars"].iloc[:30])
    assert any("possible HFT activity" in t for t in rec.titles()), "the alert is not thrown away with the error"
    assert store.recent(5)[0]["notified"] == 1


def test_repeated_scoring_failures_are_announced_once_and_recovery_too(world: dict, tmp_path: Path) -> None:
    watcher, _store, rec, clock = make(tmp_path, world, start="10:00")
    tracker = with_fake_tracker(watcher, clock, "fail")
    for _ in range(W.STEP_FAILURES_BEFORE_NOTICE + 2):
        watcher._step(tracker, world["bars"].iloc[:30])
    assert rec.titles().count("TSLA: not being scored") == 1
    assert "TSLA cannot be scored" in watcher._issues(clock.t)
    tracker.monitor.mode = "ok"                                        # type: ignore[attr-defined]
    watcher._step(tracker, world["bars"].iloc[:30])
    assert "TSLA: scoring recovered" in rec.titles() and not watcher._issues(clock.t)


def test_a_broken_history_store_does_not_stop_the_push(world: dict, tmp_path: Path) -> None:
    class BrokenStore(S.AlertStore):
        def add_alert(self, *a: object, **k: object) -> int:
            raise sqlite3.OperationalError("database is locked")

        def has_alert(self, *a: object, **k: object) -> bool:
            raise sqlite3.OperationalError("database is locked")

    watcher, _s, rec, clock = make(tmp_path, world, start="10:00", store=BrokenStore(tmp_path / "b.db"))
    with_fake_tracker(watcher, clock)
    watcher._handle("TSLA", event())
    assert any("possible HFT activity" in t for t in rec.titles())


def test_a_sender_that_raises_means_not_delivered_and_the_poll_continues(world: dict, tmp_path: Path) -> None:
    clock = Clock(world["day"] + pd.Timedelta(hours=10))
    rec = Recorder(clock)
    rec.raises = True
    watcher, store, _r, _c = make(tmp_path, world, start="10:00", notifier=rec)
    watcher.clock = clock
    with_fake_tracker(watcher, clock)
    watcher._handle("TSLA", event())
    assert store.recent(1)[0]["notified"] == 0 and watcher.notify_failing
    assert len(watcher.pending) == 1


def test_duplicate_alerts_after_a_restart_are_not_announced_twice(world: dict, tmp_path: Path) -> None:
    watcher, store, rec, clock = make(tmp_path, world, start="10:00")
    with_fake_tracker(watcher, clock)
    watcher._handle("TSLA", event())
    watcher._handle("TSLA", event())
    assert len([m for m in rec.sent if "possible HFT activity" in m.title]) == 1
    assert len(store.recent(10)) == 1


def test_urgent_alerts_ignore_the_cap_and_held_warnings_go_out_as_a_digest(world: dict, tmp_path: Path) -> None:
    watcher, store, rec, clock = make(tmp_path, world, start="10:00", cfg=_cfg(max_alerts_per_hour=1))
    with_fake_tracker(watcher, clock)
    watcher._handle("TSLA", event(about="10:01", sent="10:02"))
    watcher._handle("TSLA", event(about="10:10", sent="10:11"))               # held back: over the cap
    watcher._handle("TSLA", event(kind="CONFIRMED", about="10:01", sent="10:09", text="[HIGH | score 90/100] x"))
    assert [m.priority for m in rec.sent if "limit" not in m.title] == [W.HIGH, W.URGENT]
    assert len(watcher.held) == 1
    clock.advance(hours=1, minutes=5)
    watcher._flush(clock.t)
    digest = rec.sent[-1]
    assert "held back earlier" in digest.title and "TSLA 10:10" in digest.body
    assert not watcher.held
    assert any(r["note"] == "sent in digest" for r in store.recent(10))


def test_a_failed_delivery_is_retried_later_and_marked_delivered_late(world: dict, tmp_path: Path) -> None:
    watcher, store, rec, clock = make(tmp_path, world, start="10:00")
    with_fake_tracker(watcher, clock)
    rec.fail_next = 1
    watcher._handle("TSLA", event())
    assert len(watcher.pending) == 1 and store.recent(1)[0]["notified"] == 0
    clock.advance(minutes=1)
    watcher._flush(clock.t)
    assert "(delayed)" in rec.sent[-1].title and not watcher.pending
    row = store.recent(1)[0]
    assert row["notified"] == 1 and row["note"] == "delivered late"


def test_an_alert_that_is_given_up_on_is_named_once_messages_get_through(world: dict, tmp_path: Path) -> None:
    watcher, store, rec, clock = make(tmp_path, world, start="10:00")
    with_fake_tracker(watcher, clock)
    rec.ok = False
    watcher._handle("TSLA", event())
    for _ in range(W.MAX_DELIVERY_ATTEMPTS):
        watcher._flush(clock.t)
    assert not watcher.pending and watcher.undelivered == ["TSLA 10:01"]
    assert store.recent(1)[0]["note"].startswith("gave up")
    rec.ok = True                                                      # the phone is reachable again
    watcher._flush(clock.t)
    assert rec.sent[-1].title == "Footprint: alerts were not delivered" and "TSLA 10:01" in rec.sent[-1].body
    assert not watcher.undelivered


def test_a_late_warning_counts_against_the_hourly_cap(world: dict, tmp_path: Path) -> None:
    watcher, _store, rec, clock = make(tmp_path, world, start="10:00", cfg=_cfg(max_alerts_per_hour=1))
    with_fake_tracker(watcher, clock)
    rec.fail_next = 1
    watcher._handle("TSLA", event(about="10:01", sent="10:02"))
    watcher._flush(clock.t)                                            # delivered late
    watcher._handle("TSLA", event(about="10:10", sent="10:11"))
    assert len(watcher.held) == 1, "the late warning used up this hour's allowance"


# ---------------------------------------------------------------- the feed
def test_an_empty_answer_during_trading_hours_counts_as_a_dead_feed(world: dict, tmp_path: Path) -> None:
    watcher, store, rec, clock = make(tmp_path, world, start="10:00", fetch=lambda tickers: {t: None for t in tickers})
    for _ in range(W.FEED_FAILURES_BEFORE_NOTICE + 2):
        watcher.tick()
        clock.advance(seconds=20)
    assert rec.titles().count("Footprint cannot reach the data feed") == 1
    beat = store.read_heartbeat()
    assert beat["state"] == "degraded" and "data feed failed" in beat["detail"]


def test_an_empty_answer_before_the_open_is_normal(world: dict, tmp_path: Path) -> None:
    watcher, _store, _rec, _clock = make(tmp_path, world, start="09:31", fetch=lambda tickers: {t: None for t in tickers})
    watcher.tick()
    assert watcher.feed_failures == 0


def test_feed_outage_is_announced_once_and_recovery_too(world: dict, tmp_path: Path) -> None:
    state = {"fail": True}

    def fetch(tickers: list[str]) -> dict:
        if state["fail"]:
            raise ConnectionError("down")
        return {t: world["bars"].iloc[:60] for t in tickers}

    watcher, _s, rec, _c = make(tmp_path, world, start="10:00", fetch=fetch)
    for _ in range(W.FEED_FAILURES_BEFORE_NOTICE + 3):
        watcher.tick()
    assert rec.titles().count("Footprint cannot reach the data feed") == 1
    state["fail"] = False
    watcher.tick()
    assert rec.titles().count("Footprint data feed is back") == 1


def test_a_feed_notice_that_does_not_go_through_is_tried_again(world: dict, tmp_path: Path) -> None:
    notice = "Footprint cannot reach the data feed"

    class FirstNoticeFails(Recorder):
        def send(self, message: N.Message) -> bool:
            ok = super().send(message)
            return ok and not (message.title == notice and self.titles().count(notice) == 1)

    def fetch(_tickers: list[str]) -> dict:
        raise ConnectionError("down")

    clock = Clock(world["day"] + pd.Timedelta(hours=10))
    watcher, _s, rec, _c = make(tmp_path, world, start="10:00", fetch=fetch, notifier=FirstNoticeFails(clock))
    for _ in range(W.FEED_FAILURES_BEFORE_NOTICE + 3):
        watcher.tick()
    assert rec.titles().count(notice) == 2 and watcher.feed_alerted


def test_data_that_stops_updating_is_reported_by_time_and_recovery_too(world: dict, tmp_path: Path) -> None:
    state = {"n": 60}
    watcher, store, rec, clock = make(tmp_path, world, start="10:00", fetch=lambda tickers: {t: world["bars"].iloc[: state["n"]] for t in tickers})
    watcher.tick()                                                  # new bar seen at 10:00
    for _ in range(12):
        clock.advance(minutes=1)
        watcher.tick()                                              # the same bars keep coming back
    assert rec.titles().count("TSLA: no fresh data") == 1
    assert store.read_heartbeat()["state"] == "degraded"
    state["n"] = 80
    clock.advance(minutes=1)
    watcher.tick()
    assert "TSLA: data is back" in rec.titles()
    assert store.read_heartbeat()["state"] == "watching"
    clock.advance(minutes=1)
    assert not watcher._issues(clock.t)


def test_yesterdays_bars_are_ignored(world: dict, tmp_path: Path) -> None:
    old = world["history"].iloc[-390:]                                # a full earlier session
    watcher, store, _rec, _clock = make(tmp_path, world, start="09:50", fetch=lambda tickers: {t: old for t in tickers})
    for _ in range(3):
        watcher.tick()
    assert store.recent(10) == [], "old bars must never raise alerts"
    assert watcher.trackers["TSLA"].last_bar is None


def test_healthy_heartbeat_names_the_latest_bar(world: dict, tmp_path: Path) -> None:
    watcher, store, _rec, _clock = make(tmp_path, world, start="10:00")
    watcher.tick()
    beat = store.read_heartbeat()
    assert beat["state"] == "watching" and "latest bar" in beat["detail"]


def test_dead_mans_switch_is_pinged_only_while_healthy_and_not_more_than_once_a_minute(world: dict, tmp_path: Path) -> None:
    pings: list[str] = []
    cfg = _cfg(max_alerts_per_hour=200, heartbeat_url="https://hc.example/abc")
    watcher, _s, _r, clock = make(tmp_path, world, start="10:00", cfg=cfg, ping=pings.append)
    watcher.tick()
    clock.advance(seconds=20)
    watcher.tick()
    assert pings == ["https://hc.example/abc"]
    clock.advance(minutes=2)
    watcher.retry_at["AAPL"] = clock.t + pd.Timedelta(hours=1)        # degraded: pings must stop so the service can warn you
    watcher.tick()
    assert pings == ["https://hc.example/abc"]


def test_a_pause_between_checks_is_announced(world: dict, tmp_path: Path) -> None:
    watcher, _s, rec, clock = make(tmp_path, world, start="10:00")
    watcher.tick()
    clock.advance(minutes=25)                                         # the computer slept
    watcher.tick()
    paused = [m for m in rec.sent if m.title == "Footprint was paused"]
    assert len(paused) == 1 and "10:00 to 10:25" in paused[0].body


def test_slow_morning_training_is_not_reported_as_a_pause(world: dict, tmp_path: Path) -> None:
    clocks: list[Clock] = []

    def slow_load(_t: str, _d: int) -> pd.DataFrame:
        clocks[0].advance(minutes=4)                                  # longer than GAP_AFTER, as on an old PC
        return world["history"]

    watcher, _s, rec, clock = make(tmp_path, world, start="09:15", load_history=slow_load)
    clocks.append(clock)
    watcher.tick()                                                    # preparation: trains the model
    clock.advance(seconds=30)
    watcher.tick()
    assert "Footprint was paused" not in rec.titles()


# ---------------------------------------------------------------- startup problems
def test_a_ticker_that_cannot_train_is_announced_even_without_daily_summaries_and_retried(world: dict, tmp_path: Path) -> None:
    attempts = {"n": 0}

    def load(_t: str, _d: int) -> pd.DataFrame:
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise ConnectionError("down")
        return world["history"]

    watcher, _s, rec, clock = make(tmp_path, world, cfg=_cfg(daily_summary=False), load_history=load)
    watcher.tick()
    assert rec.sent and "could not start" in rec.sent[0].title.lower() and not watcher.trackers
    clock.advance(minutes=6)
    watcher.tick()
    assert "TSLA" in watcher.trackers and "TSLA: now being watched" in rec.titles()


def test_a_ticker_that_stays_down_is_renotified_hourly(world: dict, tmp_path: Path) -> None:
    def load(_t: str, _d: int) -> pd.DataFrame:
        raise ConnectionError("down")

    watcher, _s, rec, clock = make(tmp_path, world, load_history=load)
    watcher.tick()
    for _ in range(14):
        clock.advance(minutes=5)
        watcher.tick()
    assert rec.titles().count("TSLA: still not watched") >= 1


def test_nothing_happens_on_a_holiday_or_weekend(tmp_path: Path) -> None:
    for stamp in ("2026-11-26 11:00", "2026-10-17 11:00"):
        clock = Clock(ts(stamp))
        rec = Recorder(clock)
        store = S.AlertStore(tmp_path / f"{stamp[:10]}.db")
        watcher = W.Watcher(_cfg(), rec, store, clock=clock, fetch=lambda t: pytest.fail("must not fetch"),
                            load_history=lambda _t, _d: pytest.fail("must not train"))
        assert watcher.tick() == W.IDLE_SLEEP_SECONDS
        assert rec.sent == [] and store.read_heartbeat()["state"] == "sleeping"


def test_unresolved_warnings_are_named_in_the_closing_summary(world: dict, tmp_path: Path) -> None:
    watcher, _s, rec, clock = make(tmp_path, world, start="16:03")
    tracker = with_fake_tracker(watcher, clock)
    tracker.monitor.warnings = {ts("2026-10-13 15:55"): object()}      # type: ignore[attr-defined]
    watcher._end_session()
    assert "Never confirmed or cleared" in rec.sent[-1].body and "TSLA 15:55" in rec.sent[-1].body


def test_the_loop_survives_crashing_passes_and_says_so(world: dict, tmp_path: Path) -> None:
    class FastStop(threading.Event):
        def wait(self, timeout: float | None = None) -> bool:      # do not really sleep between passes
            return self.is_set()

    stop = FastStop()
    calls = {"n": 0}

    class Boom(W.Watcher):
        def tick(self) -> float:
            calls["n"] += 1
            if calls["n"] <= W.TICK_FAILURES_BEFORE_NOTICE:
                raise RuntimeError("bad minute")
            stop.set()
            return 0.0

    clock = Clock(world["day"] + pd.Timedelta(hours=10))
    rec = Recorder(clock)
    store = S.AlertStore(tmp_path / "a.db")
    watcher = Boom(_cfg(poll_seconds=10), rec, store, clock=clock)
    watcher.run_forever(stop)
    assert calls["n"] == W.TICK_FAILURES_BEFORE_NOTICE + 1
    assert "Footprint watcher is having trouble" in rec.titles()
    assert store.read_heartbeat()["state"] == "stopped"


# ---------------------------------------------------------------- logging
def test_repeated_errors_are_collapsed_in_the_log(monkeypatch: pytest.MonkeyPatch) -> None:
    now = {"t": 1000.0}
    monkeypatch.setattr(W.time, "monotonic", lambda: now["t"])
    flt = W.RepeatFilter()

    def record() -> logging.LogRecord:
        return logging.LogRecord("x", logging.ERROR, __file__, 1, "feed down", (), None)

    assert flt.filter(record()) is True
    now["t"] += 20
    assert flt.filter(record()) is False and flt.filter(record()) is False
    now["t"] += W.RepeatFilter.WINDOW_SECONDS
    last = record()
    assert flt.filter(last) is True and "repeated 2 more times" in last.getMessage()
    assert flt.filter(logging.LogRecord("x", logging.INFO, __file__, 1, "fine", (), None)) is True

    def failure(exc: Exception) -> logging.LogRecord:
        return logging.LogRecord("x", logging.ERROR, __file__, 1, "tick failed", (), (type(exc), exc, None))

    assert flt.filter(failure(ValueError())) is True
    assert flt.filter(failure(KeyError())) is True, "a different failure behind the same message is shown at once"
    assert flt.filter(failure(ValueError())) is False


def test_the_log_file_and_the_console_both_get_each_error(monkeypatch: pytest.MonkeyPatch) -> None:
    now = {"t": 1000.0}
    monkeypatch.setattr(W.time, "monotonic", lambda: now["t"])
    flt = W.RepeatFilter()                                             # one filter shared by both handlers, as in setup_logging
    outputs: list[list[str]] = [[], []]
    logger = logging.getLogger("footprint.test.repeat")
    monkeypatch.setattr(logger, "propagate", False)
    for out in outputs:
        handler = logging.Handler()
        handler.emit = lambda record, out=out: out.append(record.getMessage())   # type: ignore[method-assign]
        handler.addFilter(flt)
        logger.addHandler(handler)
    try:
        logger.error("feed down")
        now["t"] += 20
        logger.error("feed down")
        now["t"] += W.RepeatFilter.WINDOW_SECONDS
        logger.error("feed down")
    finally:
        logger.handlers.clear()
    expected = ["feed down", "feed down (repeated 1 more times since the last note)"]
    assert outputs == [expected, expected]


# ---------------------------------------------------------------- supervisor
class RecordingNotifier:
    def __init__(self) -> None:
        self.sent: list[N.Message] = []

    def send(self, message: N.Message) -> bool:
        self.sent.append(message)
        return True


def _supervise(codes: list[int], durations: list[float] | None = None):
    notifier, sleeps, ticks = RecordingNotifier(), [], {"t": 0.0}
    queue, lasts = list(codes), list(durations or [1.0] * len(codes))

    def run() -> int:
        ticks["t"] += lasts.pop(0)
        return queue.pop(0)

    result = SV.supervise(run, notifier, sleep=sleeps.append, clock=lambda: ticks["t"], max_runs=len(codes))
    return result, notifier, sleeps


def test_supervisor_stops_quietly_when_asked_to() -> None:
    assert _supervise([0])[0] == 0


def test_supervisor_reports_a_setup_problem_and_stops_restarting() -> None:
    code, notifier, sleeps = _supervise([2])
    assert code == 2 and sleeps == [] and "cannot start" in notifier.sent[0].title


def test_supervisor_warns_the_phone_after_repeated_quick_crashes_then_backs_off() -> None:
    _code, notifier, sleeps = _supervise([1] * 5)
    assert len([m for m in notifier.sent if "keeps crashing" in m.title]) == 1
    assert sleeps == [15.0, 30.0, 60.0, 120.0, 240.0]


def test_supervisor_warns_when_the_watcher_dies_a_few_minutes_after_each_start() -> None:
    _code, notifier, sleeps = _supervise([1] * 4, [90.0] * 4)
    assert len([m for m in notifier.sent if "keeps crashing" in m.title]) == 1
    assert sleeps == [15.0] * 4


def test_supervisor_resets_after_a_long_healthy_run() -> None:
    _code, notifier, sleeps = _supervise([1, 1, 1, 1, 1], [1, 1, 1, SV.STABLE_SECONDS + 1, 1])
    assert len(notifier.sent) == 1
    assert sleeps[-2] == 15.0, "a stable run resets the back-off"


# ---------------------------------------------------------------- web app side
def test_alert_history_and_watcher_status_endpoints(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient
    import main
    monkeypatch.setenv("FOOTPRINT_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(main, "_alert_store", None)
    client = TestClient(main.app)
    assert client.get("/api/watcher").json()["seen"] is False, "no history file yet"
    assert client.get("/api/alerts").json() == {"alerts": []}
    writer = S.AlertStore(tmp_path / "alerts.db")
    writer.add_alert("TSLA", "EARLY WARNING", "2026-10-13", "10:01", "10:02", "score 80/100")
    writer.heartbeat("watching", ["TSLA", "AAPL"], "Checked")
    status = client.get("/api/watcher").json()
    assert status["running"] is True and status["tickers"] == ["TSLA", "AAPL"]
    assert client.get("/api/alerts").json()["alerts"][0]["ticker"] == "TSLA"
    assert client.get("/api/alerts?ticker=aapl").json()["alerts"] == []
    assert client.get("/api/alerts?ticker=bad%20one").status_code == 422
    assert client.get("/api/alerts?limit=0").status_code == 422
    monkeypatch.setattr(main, "WATCHER_STALE_SECONDS", -1)
    assert client.get("/api/watcher").json()["running"] is False
    writer.heartbeat("degraded", ["TSLA"], "TSLA has had no new data since 10:05")
    monkeypatch.setattr(main, "WATCHER_STALE_SECONDS", 420)
    assert client.get("/api/watcher").json()["state"] == "degraded"
    writer.close()
    if main._alert_store:
        main._alert_store.close()
    monkeypatch.setattr(main, "_alert_store", None)


def test_an_unreadable_history_is_reported_not_shown_as_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient
    import main
    monkeypatch.setenv("FOOTPRINT_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(main, "_alert_store", None)
    main._post_times.clear()
    (tmp_path / "alerts.db").write_bytes(b"not a database " * 200)
    client = TestClient(main.app)
    try:
        assert client.get("/api/alerts").status_code == 503
        assert client.get("/api/watcher").status_code == 503, "a broken history is not 'no watcher yet'"
    finally:
        if main._alert_store:
            main._alert_store.close()
        main._post_times.clear()


def test_a_relative_data_folder_still_opens_read_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("FOOTPRINT_DATA_DIR", "data")
    assert S.data_dir() == (tmp_path / "data").resolve()
    writer = S.AlertStore(S.data_dir() / "alerts.db")
    writer.heartbeat("watching", ["TSLA"], "ok")
    reader = S.AlertStore(S.data_dir() / "alerts.db", readonly=True)    # needs an absolute path for its file: URI
    assert reader.read_heartbeat()["detail"] == "ok"
    reader.close()
    writer.close()


def test_alert_history_reads_are_rate_limited(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient
    import main
    monkeypatch.setenv("FOOTPRINT_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(main, "_alert_store", None)
    monkeypatch.setattr(main, "READS_PER_MINUTE", 3)
    main._post_times.clear()
    client = TestClient(main.app)
    codes = [client.get("/api/alerts").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3:] == [429, 429]
    main._post_times.clear()
