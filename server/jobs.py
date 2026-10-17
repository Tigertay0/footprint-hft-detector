"""Background jobs: replay, accuracy test and live monitoring.

Each job runs in its own thread and writes progress into a Job object that the API polls.
"""
from __future__ import annotations

import logging
import secrets
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

import pandas as pd

import analysis as A
import engine as E
from errors import UserError

log = logging.getLogger("footprint")

MAX_ACTIVE_JOBS = 4
MAX_JOBS_PER_OWNER = 2
MAX_LIVE_JOBS = 1
MAX_STORED_JOBS = 40
MIN_REPLAY_HISTORY_SESSIONS = 3
LIVE_POLL_SECONDS = 60
LIVE_IDLE_SECONDS = 300          # stop a live job when nobody has polled it for this long
LIVE_MAX_SECONDS = 2 * 3600
LIVE_MAX_FEED_FAILURES = 5
LIVE_EMPTY_POLLS_BEFORE_WARNING = 3

JobStatus = Literal["running", "done", "error", "stopped"]


class TooBusy(RuntimeError):
    """Raised when too many jobs are already running."""


class _Stopped(Exception):
    """Raised inside a job when the client asked it to stop."""


@dataclass
class Job:
    id: str
    kind: str                           # replay | evaluate | live
    owner: str = "local"
    status: JobStatus = "running"
    progress: dict[str, Any] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)
    bars: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    stop: threading.Event = field(default_factory=threading.Event)
    created: float = field(default_factory=time.time)
    last_poll: float = field(default_factory=time.time)


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def start(self, kind: str, target: Callable[..., None], *args: Any, owner: str = "local") -> Job:
        with self._lock:
            running = [j for j in self._jobs.values() if j.status == "running"]
            if len(running) >= MAX_ACTIVE_JOBS:
                raise TooBusy("Too many tests are running. Wait for one to finish and try again.")
            if sum(1 for j in running if j.owner == owner) >= MAX_JOBS_PER_OWNER:
                raise TooBusy("You already have two tests running. Stop one or wait for it to finish.")
            if kind == "live" and sum(1 for j in running if j.kind == "live") >= MAX_LIVE_JOBS:
                raise TooBusy("A live session is already running. Stop it before starting another.")
            job = Job(id=secrets.token_urlsafe(16), kind=kind, owner=owner)
            self._jobs[job.id] = job
            for old in sorted(self._jobs.values(), key=lambda j: j.created)[:-MAX_STORED_JOBS]:
                if old.status != "running":
                    self._jobs.pop(old.id, None)

        def runner() -> None:
            try:
                target(job, *args)
            except _Stopped:
                pass
            except UserError as exc:        # problems the user can act on
                job.error, job.status = str(exc), "error"
            except Exception as exc:        # noqa: BLE001 - shown generically, full trace goes to the log
                log.exception("job %s failed", job.id)
                job.error, job.status = f"Something went wrong: {type(exc).__name__}.", "error"
            finally:
                if job.status == "running":
                    job.status = "stopped" if job.stop.is_set() else "done"

        thread = threading.Thread(target=runner, name=f"job-{job.id}", daemon=True)
        try:
            thread.start()
        except RuntimeError:
            job.error, job.status = "The server could not start that job.", "error"
            raise TooBusy(job.error) from None
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)


# ---------------------------------------------------------------- replay
def replay_job(job: Job, scan: A.Scan, mode: str, date: str | None) -> None:
    cfg = scan.cfg
    planted: list[pd.Timestamp] = []
    if mode == "planted":
        train_bars, _test, test_injected, event_times = E.planted_setup(scan.bars, cfg)
        days = test_injected.index.normalize().unique()
        day = pd.Timestamp(date, tz=E.NY) if date else days[0]
        if day not in days:
            raise UserError("Pick one of the later sessions for the planted-event replay.")
        day_bars = test_injected[test_injected.index.normalize() == day]
        history = train_bars
        planted = [t for t in event_times if t.normalize() == day]
    else:
        if not date:
            raise UserError("Choose a session to replay.")
        day = pd.Timestamp(date, tz=E.NY)
        day_bars = scan.bars[scan.bars.index.normalize() == day]
        if day_bars.empty:
            raise UserError("That session is not in this scan.")
        history = scan.bars[scan.bars.index.normalize() < day]
        if history.index.normalize().nunique() < MIN_REPLAY_HISTORY_SESSIONS:
            raise UserError(f"Pick a later session. At least {MIN_REPLAY_HISTORY_SESSIONS} earlier sessions "
                            "are needed to learn what normal looks like.")

    job.bars = A.bars_payload(day_bars)
    job.progress = {"step": 0, "total": int(len(day_bars)), "planted_m": A.minute_of_session(pd.DatetimeIndex(planted))}

    def on_step(i: int, new_events: list[dict[str, Any]], _mon: E.LiveMonitor) -> None:
        if new_events:
            job.events.extend([A.event_payload(ev, i) for ev in new_events])
        job.progress["step"] = i
        if job.stop.is_set():
            raise _Stopped()

    mon = E.run_replay(day_bars, history, cfg, log=lambda *_: None, on_step=on_step)
    job.result = A.py({"planted": _planted_outcome(mon.events, planted)}) if planted else {}


def _planted_outcome(events: list[dict[str, Any]], planted: list[pd.Timestamp]) -> list[dict[str, Any]]:
    out = []
    for t in planted:
        near = [e for e in events if t - pd.Timedelta(minutes=1) <= e["minute"] <= t + pd.Timedelta(minutes=6)]
        early = [e for e in near if e["kind"] == "EARLY WARNING"]
        final = [e for e in near if e["kind"] in ("CONFIRMED", "ALERT")]
        out.append({
            "m": A.minute_of_session(pd.DatetimeIndex([t]))[0],
            "early": bool(early), "confirmed": bool(final),
            "early_delay": (min(e["sent"] for e in early) - t).total_seconds() / 60 if early else None,
            "confirm_delay": (min(e["sent"] for e in final) - t).total_seconds() / 60 if final else None,
        })
    return out


# ---------------------------------------------------------------- accuracy test
def evaluate_job(job: Job, scan: A.Scan, include_live: bool) -> None:
    cfg = scan.cfg
    job.progress = {"stage": "methods", "done": 0, "total": 1}
    setup = E.planted_setup(scan.bars, cfg)
    if job.stop.is_set():
        raise _Stopped()
    result = E.run_method_comparison(scan.bars, cfg, setup)
    job.result = A.py({**result, "live": None})
    if not include_live or job.stop.is_set():
        return

    train_bars, _test, test_injected, event_times = setup
    n_days = int(test_injected.index.normalize().nunique())
    job.progress = {"stage": "live", "done": 0, "total": n_days}

    def progress(done: int, total: int) -> None:
        job.progress = {"stage": "live", "done": done, "total": total}
        if job.stop.is_set():
            raise _Stopped()

    live = E.replay_evaluation(test_injected, train_bars, event_times, cfg, progress)
    job.result = A.py({**result, "live": live})


# ---------------------------------------------------------------- live monitoring
def live_job(job: Job, ticker: str, cfg: dict[str, Any],
             fetch_factory: Callable[[str], Callable[[], pd.DataFrame | None]] = E.yfinance_feed,
             history_loader: Callable[[str, int], pd.DataFrame] = E.load_yfinance,
             poll_seconds: float = LIVE_POLL_SECONDS,
             is_open: Callable[[], bool] = E.market_is_open,
             idle_seconds: float = LIVE_IDLE_SECONDS,
             max_seconds: float = LIVE_MAX_SECONDS) -> None:
    today = pd.Timestamp.now(tz=E.NY).normalize()
    history = history_loader(ticker, 7)
    history = history[history.index.normalize() < today]
    if history.index.normalize().nunique() < MIN_REPLAY_HISTORY_SESSIONS:
        raise UserError("Could not load enough recent sessions to learn what normal looks like.")
    det = E.HFTDetector(cfg).fit(E.build_features(history, cfg))
    base_fetch = fetch_factory(ticker)
    latest: dict[str, pd.DataFrame | None] = {"bars": None}

    def fetch() -> pd.DataFrame | None:
        df = base_fetch()
        latest["bars"] = df
        return df

    mon = E.LiveMonitor(det, fetch, cfg, log=lambda *_: None)
    job.progress = {"trained_on": int(history.index.normalize().nunique()), "step": 0}
    started = time.time()
    failures = empty_polls = 0
    while not job.stop.is_set():
        if time.time() - job.last_poll > idle_seconds:
            break                                   # the page was closed, so stop polling the data provider
        before = len(mon.events)
        try:
            mon.step()
            failures = 0
            job.progress.pop("feed_error", None)
        except Exception:                           # noqa: BLE001 - a network blip should not end the session
            failures += 1
            log.exception("live feed failed (%s in a row)", failures)
            job.progress["feed_error"] = True
            if failures >= LIVE_MAX_FEED_FAILURES:
                raise UserError("The data feed keeps failing. Try again in a few minutes.") from None
        new = [A.event_payload(ev, job.progress["step"]) for ev in mon.events[before:]]
        if new:
            job.events.extend(new)
        bars = latest["bars"]
        if bars is not None and len(bars):
            empty_polls = 0
            job.progress["no_data"] = False
            job.bars = A.bars_payload(bars[bars.index.normalize() == bars.index[-1].normalize()])
        else:
            empty_polls += 1
            job.progress["no_data"] = empty_polls >= LIVE_EMPTY_POLLS_BEFORE_WARNING
        job.progress["step"] += 1
        if not is_open() or time.time() - started > max_seconds:
            break
        job.stop.wait(poll_seconds)
