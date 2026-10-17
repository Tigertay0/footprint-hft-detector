"""Footprint web app: serves the interface and the JSON API around engine.py.

Run:  python -m uvicorn main:app --app-dir server --port 8000
"""
from __future__ import annotations

import datetime as dt
import io
import logging
import mimetypes
import os
import sqlite3
import threading
import time
from collections import OrderedDict, defaultdict, deque
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.datastructures import Headers
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

import analysis as A
import engine as E
import jobs as J
from errors import UserError
from store import MAX_LIMIT, AlertStore, data_dir
from validation import normalize_ticker

log = logging.getLogger("footprint")
WEB_DIR = Path(__file__).resolve().parent.parent / "web"

ID_PATTERN = r"^[A-Za-z0-9_-]{16,32}$"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024
MAX_CSV_ROWS = 400_000
MAX_DAYS = 29                      # Yahoo serves roughly 30 days of 1-minute bars
MAX_SCANS_KEPT = 8
MAX_CACHED_DOWNLOADS = 8
MAX_CONCURRENT_SCANS = 2
DATA_TTL_SECONDS = 15 * 60
POSTS_PER_MINUTE = 30

# Hosts the app answers to. Add your own domain when deploying: FOOTPRINT_ALLOWED_HOSTS="app.example.com"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "testserver"] + [
    h.strip() for h in os.environ.get("FOOTPRINT_ALLOWED_HOSTS", "").split(",") if h.strip()]

mimetypes.add_type("font/woff2", ".woff2")
TOO_LARGE_TEXT = "That upload is larger than 25 MB."


class BodyLimit:
    """Caps request bodies while they stream in. A Content-Length check alone misses chunked uploads,
    which the form parser would otherwise spool to disk without limit before any endpoint runs."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        length = Headers(scope=scope).get("content-length", "")
        if length.isdigit() and int(length) > self.max_bytes:
            await JSONResponse({"detail": TOO_LARGE_TEXT}, status_code=413)(scope, receive, send)
            return
        received = 0

        async def capped_receive() -> Message:
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.max_bytes:
                raise HTTPException(413, TOO_LARGE_TEXT)    # FastAPI passes this through from body parsing
            return message

        await self.app(scope, capped_receive, send)


app = FastAPI(title="Footprint", docs_url=None, redoc_url=None)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
app.add_middleware(BodyLimit, max_bytes=MAX_BODY_BYTES)

SECURITY_HEADERS = {
    # Scripts and styles only from this server. The front end sets styles through the CSSOM, never inline markup.
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; "
                               "form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}

jobs = J.JobStore()
_scans: OrderedDict[str, A.Scan] = OrderedDict()
_data_cache: OrderedDict[tuple[str, int], tuple[float, pd.DataFrame]] = OrderedDict()
_download_locks: dict[tuple[str, int], threading.Lock] = {}
_lock = threading.Lock()
_scan_slots = threading.BoundedSemaphore(MAX_CONCURRENT_SCANS)
_limit_lock = threading.Lock()
_post_times: dict[tuple[str, str], deque[float]] = defaultdict(deque)


@app.middleware("http")
async def guard(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Reject cross-site writes, then add the security headers (to refusals too)."""
    origin = request.headers.get("origin")
    if request.method in ("POST", "DELETE") and origin and urlparse(origin).netloc != request.headers.get("host"):
        response: Response = JSONResponse({"detail": "Cross-site requests are not allowed."}, status_code=403)
    else:
        response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ---------------------------------------------------------------- guards
def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _limit(request: Request, bucket: str = "write", per_minute: int = POSTS_PER_MINUTE) -> None:
    """Small per-client limit. Writes (scans, jobs) and reads (alert history) are counted separately."""
    key, now = (_client(request), bucket), time.time()
    with _limit_lock:
        window = _post_times[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= per_minute:
            raise HTTPException(429, "Too many requests. Wait a minute and try again.")
        window.append(now)
        for stale in [k for k, v in _post_times.items() if k != key and (not v or now - v[-1] > 60)]:
            del _post_times[stale]


def _ticker(raw: str) -> str:
    try:
        return normalize_ticker(raw)
    except UserError:
        raise HTTPException(422, "Enter a ticker symbol such as TSLA or AAPL.") from None


def _scan(scan_id: str) -> A.Scan:
    with _lock:
        scan = _scans.get(scan_id)
        if scan is not None:
            _scans.move_to_end(scan_id)
    if scan is None:
        raise HTTPException(404, "That scan has expired. Run the scan again.")
    return scan


def _market_bars(ticker: str, days: int) -> pd.DataFrame:
    key = (ticker, days)
    with _lock:
        lock = _download_locks.setdefault(key, threading.Lock())
    with lock:                                  # one download per ticker at a time
        with _lock:
            hit = _data_cache.get(key)
            if hit and time.time() - hit[0] < DATA_TTL_SECONDS:
                _data_cache.move_to_end(key)
                return hit[1]
        try:
            bars = E.load_yfinance(ticker, days)
        except Exception:
            with _lock:
                _download_locks.pop(key, None)  # failed lookups (often mistyped tickers) must not pile up locks
            raise
        with _lock:
            _data_cache[key] = (time.time(), bars)
            while len(_data_cache) > MAX_CACHED_DOWNLOADS:
                old, _ = _data_cache.popitem(last=False)
                _download_locks.pop(old, None)
    return bars


# ---------------------------------------------------------------- API
@app.get("/api/market")
def market() -> dict[str, Any]:
    now = pd.Timestamp.now(tz=E.NY)
    return {"open": E.market_is_open(), "now_et": now.isoformat(), "opens": "09:30", "closes": "16:00"}


@app.post("/api/scan")
def scan(request: Request,
         source: Literal["market", "sample", "csv"] = Form("market"),
         ticker: str = Form("TSLA"),
         days: int = Form(MAX_DAYS),
         sensitivity: Literal["strict", "balanced", "sensitive"] = Form("balanced"),
         file: UploadFile | None = File(None)) -> dict[str, Any]:
    _limit(request)
    days = max(5, min(days, MAX_DAYS))
    if not _scan_slots.acquire(blocking=False):
        raise HTTPException(429, "Two scans are already running. Try again in a few seconds.")
    try:
        if source == "csv":
            if file is None:
                raise HTTPException(422, "Choose a CSV file with minute bars.")
            raw = file.file.read(MAX_UPLOAD_BYTES + 1)
            if len(raw) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "That file is larger than 25 MB.")
            display = Path(file.filename or "upload.csv").name[:40]
            cfg = A.make_cfg(sensitivity, display, days, "csv")
            bars = E.load_csv(io.BytesIO(raw), max_rows=MAX_CSV_ROWS)
        elif source == "sample":
            display = "Sample data"
            cfg = A.make_cfg(sensitivity, display, days, "synthetic")
            bars = E.make_synthetic()
        else:
            display = _ticker(ticker)
            cfg = A.make_cfg(sensitivity, display, days, "yfinance")
            bars = _market_bars(display, days)
        result = A.run_scan(bars, cfg, display, source, sensitivity)
    except HTTPException:
        raise
    except UserError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - data providers raise many different errors
        log.exception("scan failed")
        raise HTTPException(502, "Could not load or read that data. Check the ticker or file and try again.") from exc
    finally:
        _scan_slots.release()

    with _lock:
        _scans[result.id] = result
        while len(_scans) > MAX_SCANS_KEPT:
            _scans.popitem(last=False)
    return A.py(A.scan_to_json(result))


class ReplayRequest(BaseModel):
    scan_id: str = Field(pattern=ID_PATTERN)
    mode: Literal["planted", "session"]
    date: dt.date | None = None


class EvaluateRequest(BaseModel):
    scan_id: str = Field(pattern=ID_PATTERN)
    include_live: bool = False


class LiveRequest(BaseModel):
    ticker: str = Field(max_length=12)
    sensitivity: Literal["strict", "balanced", "sensitive"] = "balanced"


def _start(request: Request, kind: str, target: Callable[..., None], *args: Any) -> dict[str, str]:
    try:
        job = jobs.start(kind, target, *args, owner=_client(request))
    except J.TooBusy as exc:
        raise HTTPException(429, str(exc)) from exc
    return {"job_id": job.id}


@app.post("/api/replay")
def replay(body: ReplayRequest, request: Request) -> dict[str, str]:
    _limit(request)
    when = body.date.isoformat() if body.date else None
    return _start(request, "replay", J.replay_job, _scan(body.scan_id), body.mode, when)


@app.post("/api/evaluate")
def evaluate(body: EvaluateRequest, request: Request) -> dict[str, str]:
    _limit(request)
    return _start(request, "evaluate", J.evaluate_job, _scan(body.scan_id), body.include_live)


@app.post("/api/live")
def live(body: LiveRequest, request: Request) -> dict[str, str]:
    _limit(request)
    if not E.market_is_open():
        raise HTTPException(409, "The US market is closed. It trades 9:30 to 16:00 New York time on weekdays.")
    ticker = _ticker(body.ticker)
    return _start(request, "live", J.live_job, ticker, A.make_cfg(body.sensitivity, ticker, 7, "yfinance"))


def _job(job_id: str) -> J.Job:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "That job no longer exists.")
    return job


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str, since: int = 0) -> dict[str, Any]:
    job = _job(job_id)
    job.last_poll = time.time()
    since = max(0, since)
    status = job.status                       # read the status first, then take one snapshot of the event list
    events = list(job.events)
    payload = {
        "id": job.id, "kind": job.kind, "status": status, "progress": dict(job.progress),
        "events": events[since:], "next": len(events),
        "result": job.result, "error": job.error,
    }
    if job.bars is not None and (since == 0 or job.kind == "live"):
        payload["bars"] = job.bars
    return A.py(payload)


@app.delete("/api/jobs/{job_id}")
def job_stop(job_id: str) -> dict[str, bool]:
    _job(job_id).stop.set()
    return {"ok": True}


# ---------------------------------------------------------------- watcher history (written by watcher.py)
WATCHER_STALE_SECONDS = 420      # polls run every 10 to 300 seconds, and morning training can take a minute or two
_alert_store: AlertStore | None = None


READS_PER_MINUTE = 120


def _alerts() -> AlertStore | None:
    """The watcher's history, opened read-only. None until the watcher has created it.

    Raises sqlite3.Error when the file exists but cannot be opened, so callers never mistake a broken
    history for an empty one."""
    global _alert_store
    path = data_dir() / "alerts.db"
    with _lock:
        if _alert_store is None and path.exists():
            _alert_store = AlertStore(path, readonly=True)
        return _alert_store


@app.get("/api/alerts")
def alert_history(request: Request, limit: int = Query(100, ge=1, le=MAX_LIMIT), ticker: str | None = None) -> dict[str, Any]:
    _limit(request, "read", READS_PER_MINUTE)
    wanted = _ticker(ticker) if ticker else None
    try:
        store = _alerts()
        return {"alerts": store.recent(limit, wanted) if store else []}
    except sqlite3.Error:
        log.exception("could not read the alert history")
        raise HTTPException(503, "The alert history cannot be read right now. Try again in a moment.") from None


@app.get("/api/watcher")
def watcher_status(request: Request) -> dict[str, Any]:
    _limit(request, "read", READS_PER_MINUTE)
    try:
        store = _alerts()
        beat = store.read_heartbeat() if store else None
    except sqlite3.Error:
        log.exception("could not read the watcher heartbeat")
        raise HTTPException(503, "The watcher status cannot be read right now. Try again in a moment.") from None
    market_open = E.market_is_open()
    if beat is None:
        return {"seen": False, "running": False, "market_open": market_open}
    age = (pd.Timestamp.now(tz="UTC") - pd.Timestamp(beat["updated_utc"])).total_seconds()
    return {
        "seen": True, "running": age <= WATCHER_STALE_SECONDS and beat["state"] != "stopped",
        "state": beat["state"], "tickers": [t for t in beat["tickers"].split(",") if t], "detail": beat["detail"],
        "updated_utc": beat["updated_utc"], "age_seconds": int(age), "market_open": market_open,
    }


app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
