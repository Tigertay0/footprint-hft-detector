"""Alert history and watcher heartbeat, kept in one small SQLite file.

The watcher writes. The web app only reads, so the history is visible even when the watcher is
running on another machine's copy of the same data folder.
"""
from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def data_dir() -> Path:
    """Where the alert history and logs live. Override with FOOTPRINT_DATA_DIR."""
    return Path(os.environ.get("FOOTPRINT_DATA_DIR") or ROOT / "data")

SCHEMA = """
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_utc TEXT NOT NULL,
    ticker TEXT NOT NULL,
    kind TEXT NOT NULL,
    session_date TEXT NOT NULL,
    about_et TEXT NOT NULL,
    sent_et TEXT NOT NULL,
    text TEXT NOT NULL,
    notified INTEGER NOT NULL DEFAULT 0,
    note TEXT
);
CREATE INDEX IF NOT EXISTS alerts_created ON alerts (created_utc DESC);
CREATE TABLE IF NOT EXISTS heartbeat (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    updated_utc TEXT NOT NULL,
    state TEXT NOT NULL,
    tickers TEXT NOT NULL,
    detail TEXT NOT NULL
);
"""
MAX_LIMIT = 200


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class AlertStore:
    def __init__(self, path: Path, *, readonly: bool = False) -> None:
        """The watcher opens the file for writing. The web app opens it read-only, so it can never change history."""
        if readonly:
            self._db = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True, check_same_thread=False, timeout=10)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._db = sqlite3.connect(path, check_same_thread=False, timeout=10)
        self._db.row_factory = sqlite3.Row
        if not readonly:
            self._db.execute("PRAGMA journal_mode=WAL")
            self._db.executescript(SCHEMA)
        self._lock = threading.Lock()

    def prune(self, keep_days: int = 180) -> int:
        """Deletes alerts older than `keep_days`. Returns how many were removed."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_days)).isoformat(timespec="seconds")
        with self._lock, self._db:
            return self._db.execute("DELETE FROM alerts WHERE created_utc < ?", (cutoff,)).rowcount

    def add_alert(self, ticker: str, kind: str, session_date: str, about_et: str, sent_et: str, text: str) -> int:
        with self._lock, self._db:
            cur = self._db.execute(
                "INSERT INTO alerts (created_utc, ticker, kind, session_date, about_et, sent_et, text) VALUES (?,?,?,?,?,?,?)",
                (_now(), ticker, kind, session_date, about_et, sent_et, text))
            return int(cur.lastrowid)

    def has_alert(self, ticker: str, kind: str, session_date: str, about_et: str) -> bool:
        """True if this exact alert was already recorded (a restart must not announce it twice)."""
        with self._lock:
            row = self._db.execute(
                "SELECT 1 FROM alerts WHERE ticker = ? AND kind = ? AND session_date = ? AND about_et = ? LIMIT 1",
                (ticker, kind, session_date, about_et)).fetchone()
        return row is not None

    def mark_notified(self, alert_id: int, delivered: bool, note: str | None = None) -> None:
        with self._lock, self._db:
            self._db.execute("UPDATE alerts SET notified = ?, note = ? WHERE id = ?", (int(delivered), note, alert_id))

    def recent(self, limit: int = 100, ticker: str | None = None) -> list[dict[str, Any]]:
        limit = max(1, min(limit, MAX_LIMIT))
        sql, args = "SELECT * FROM alerts", []
        if ticker:
            sql += " WHERE ticker = ?"
            args.append(ticker)
        sql += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            return [dict(r) for r in self._db.execute(sql, args)]

    def count_today(self, session_date: str) -> dict[str, int]:
        with self._lock:
            rows = self._db.execute(
                "SELECT kind, COUNT(*) AS n FROM alerts WHERE session_date = ? GROUP BY kind", (session_date,)).fetchall()
        return {r["kind"]: int(r["n"]) for r in rows}

    def heartbeat(self, state: str, tickers: list[str], detail: str = "") -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO heartbeat (id, updated_utc, state, tickers, detail) VALUES (1,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET updated_utc=excluded.updated_utc, state=excluded.state, "
                "tickers=excluded.tickers, detail=excluded.detail",
                (_now(), state, ",".join(tickers), detail))

    def read_heartbeat(self) -> dict[str, Any] | None:
        with self._lock:
            row = self._db.execute("SELECT * FROM heartbeat WHERE id = 1").fetchone()
        return dict(row) if row else None

    def close(self) -> None:
        with self._lock:
            self._db.close()
