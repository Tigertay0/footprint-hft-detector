"""Builds the phone feed for the paper site: every ntfy notification the watcher would have sent on one
real session, if it had watched all 20 tickers from the study.

It reuses the study's replay (engine.run_replay, trained on the first 12 sessions, as in the paper) and the
watcher's own build_message, hourly cap and digest rules, so titles, bodies, priorities and tags match what
a phone would have received.

Run from the repo root:
    .venv/Scripts/python site/scripts/build_phone_feed.py 2026-10-08
"""
from __future__ import annotations

import json
import sys
from collections import deque
from datetime import timedelta
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "server"))
sys.path.insert(0, str(ROOT / "research"))

import engine  # noqa: E402
import real_data_study as study  # noqa: E402
import watcher as W  # noqa: E402

OUT = ROOT / "site" / "src" / "data" / "phone-feed.json"
TRAIN_SESSIONS = 12


def ticker_events(ticker: str, day: pd.Timestamp) -> list[dict]:
    bars = study.fetch_bars(ticker, offline=True)
    days = sorted(bars.index.normalize().unique())
    history = bars[bars.index.normalize().isin(days[:TRAIN_SESSIONS])]
    mon = engine.run_replay(bars[bars.index.normalize() == day], history, study.CFG, log=lambda *_: None)
    return [{"ticker": ticker, **ev} for ev in mon.events]


def simulate(events: list[dict], cfg: W.WatcherConfig) -> list[dict]:
    """The watcher's delivery rules: early warnings share an hourly cap, urgent alerts always go through,
    held warnings go out as one digest once the hour allows, and the day ends with a summary."""
    feed, sent_times, held = [], deque(), []
    limit_notice = False
    counts = {"EARLY WARNING": 0, "CONFIRMED": 0, "ALERT": 0, "CLEARED": 0}

    def push(msg: W.Message, at: pd.Timestamp, ticker: str | None, kind: str) -> None:
        feed.append({"at": at.strftime("%H:%M"), "ticker": ticker, "kind": kind, "title": msg.title,
                     "body": msg.body, "priority": msg.priority, "tags": list(msg.tags)})

    def room(now: pd.Timestamp) -> bool:
        nonlocal limit_notice
        while sent_times and now - sent_times[0] > timedelta(hours=1):
            sent_times.popleft()
        ok = len(sent_times) < cfg.max_alerts_per_hour
        if ok:
            limit_notice = False
        return ok

    for ev in sorted(events, key=lambda e: (e["sent"], e["ticker"])):
        now = ev["sent"]
        if held and room(now):
            labels = [h for h in held]
            digest = W.Message("Footprint: warnings held back earlier",
                               "Held back by the hourly limit:\n" + "\n".join(W._digest_lines(labels)),
                               W.HIGH, ("warning",))
            push(digest, now, None, "DIGEST")
            sent_times.append(now)
            held.clear()
        counts[ev["kind"]] = counts.get(ev["kind"], 0) + 1
        msg = W.build_message(ev["ticker"], ev["kind"], ev["minute"], now, ev["text"], cfg)
        if msg is None:
            continue
        if msg.priority == W.HIGH and not room(now):
            if not limit_notice:
                notice = W.Message("Footprint: alert limit reached",
                                   f"More than {cfg.max_alerts_per_hour} warnings in an hour. Further ones are saved and sent "
                                   "together as a digest when the hour allows. Confirmed alerts still come through.",
                                   W.NORMAL, ("warning",))
                push(notice, now, None, "LIMIT")
                limit_notice = True
            held.append(f"{ev['ticker']} {ev['minute']:%H:%M}")
            continue
        push(msg, now, ev["ticker"], ev["kind"])
        if msg.priority == W.HIGH:
            sent_times.append(now)

    close = pd.Timestamp(events[0]["sent"]).normalize() + pd.Timedelta(hours=16)
    summary = (f"Market closed. Today: {counts['EARLY WARNING']} early warnings, "
               f"{counts['CONFIRMED'] + counts['ALERT']} confirmed, {counts['CLEARED']} cleared.")
    push(W.Message("Footprint: market closed", summary, W.QUIET, ("zzz",)), close, None, "SUMMARY")
    return feed


def main() -> None:
    day = pd.Timestamp(sys.argv[1] if len(sys.argv) > 1 else "2026-10-08", tz=engine.NY)
    events = []
    for ticker in study.TICKERS:
        evs = ticker_events(ticker, day)
        print(f"{ticker}: {len(evs)} events", flush=True)
        events += evs
    feed = simulate(events, W.WatcherConfig(tickers=tuple(study.TICKERS)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"date": f"{day:%Y-%m-%d}", "tickers": study.TICKERS, "feed": feed},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    kinds = pd.Series([f["kind"] for f in feed]).value_counts().to_dict()
    print(f"{len(feed)} notifications -> {OUT}\n{kinds}")


if __name__ == "__main__":
    main()
