"""Turns engine output into the JSON the web interface draws.

Everything numeric that the page shows comes from engine.py. This module only reshapes it
(columnar arrays per session, structured reasons per alert) and adds no detection logic.
"""
from __future__ import annotations

import math
import secrets
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

import engine as E
from errors import UserError

MIN_SESSIONS = 5
MIN_FEATURE_ROWS = 200
MIN_BARS_PER_SESSION = 92     # the planted-event test places events 70 or more bars after the open and 21 or more before the close

# Alert threshold pairs (ELEVATED, HIGH). "balanced" is the notebook's own setting.
SENSITIVITY: dict[str, tuple[int, int]] = {
    "strict": (60, 80),
    "balanced": (50, 70),
    "sensitive": (40, 60),
}
LEVEL_CODE = {"Normal": 0, "Elevated": 1, "High": 2}


@dataclass
class Scan:
    id: str
    ticker: str
    source: str
    sensitivity: str
    cfg: dict[str, Any]
    bars: pd.DataFrame
    scored: pd.DataFrame
    eps: list[pd.DataFrame]
    cut_day: pd.Timestamp
    dropped_sessions: int
    created: float


def make_cfg(sensitivity: str, ticker: str, days: int, source: str) -> dict[str, Any]:
    elevated, high = SENSITIVITY[sensitivity]
    return {**E.DEFAULT_CONFIG, "TICKER": ticker, "DAYS": days, "SOURCE": source,
            "ELEVATED": elevated, "HIGH": high}


def run_scan(bars: pd.DataFrame, cfg: dict[str, Any], ticker: str, source: str, sensitivity: str) -> Scan:
    # Sessions that have only just started (or are mostly missing) cannot support the tests, so leave them out.
    per_row = bars.groupby(bars.index.normalize())["close"].transform("size")
    total_sessions = bars.index.normalize().nunique()
    bars = bars[per_row >= MIN_BARS_PER_SESSION]
    sessions = bars.index.normalize().nunique()
    dropped = total_sessions - sessions
    if sessions < MIN_SESSIONS:
        raise UserError(f"Found {sessions} usable trading sessions. At least {MIN_SESSIONS} are needed "
                        "so the model has a baseline to learn from.")
    feat = E.build_features(bars, cfg)
    if len(feat) < MIN_FEATURE_ROWS:
        raise UserError("Not enough minute bars to build a baseline. Try a longer window.")
    train_feat, _ = E.split_by_session(feat, cfg["TRAIN_FRACTION"])
    detector = E.HFTDetector(cfg).fit(train_feat)
    scored = detector.score(feat)
    days = feat.index.normalize().unique()
    cut_day = days[int(len(days) * cfg["TRAIN_FRACTION"])]
    return Scan(id=secrets.token_urlsafe(16), ticker=ticker, source=source, sensitivity=sensitivity, cfg=cfg,
                bars=bars, scored=scored, eps=E.episodes(scored, cfg),
                cut_day=cut_day, dropped_sessions=dropped, created=time.time())


# ---------------------------------------------------------------- helpers
def _col(series: pd.Series, digits: int | None = None) -> list:
    """Series to a JSON-safe list (NaN becomes null)."""
    out: list = []
    for v in series.tolist():
        if v is None or (isinstance(v, float) and np.isnan(v)):
            out.append(None)
        elif digits is None:
            out.append(int(v))
        else:
            out.append(round(float(v), digits))
    return out


def minute_of_session(index: pd.DatetimeIndex) -> list[int]:
    return [int(h) * 60 + int(m) - 570 for h, m in zip(index.hour, index.minute)]


def session_open_ms(day: pd.Timestamp) -> int:
    return int((day + pd.Timedelta(hours=9, minutes=30)).value // 10**6)


def bars_payload(day_bars: pd.DataFrame) -> dict[str, Any]:
    """Price bars for one session, columnar."""
    day = day_bars.index[0].normalize()
    return {
        "open_ms": session_open_ms(day),
        "m": minute_of_session(day_bars.index),
        "o": _col(day_bars["open"], 3), "h": _col(day_bars["high"], 3),
        "l": _col(day_bars["low"], 3), "c": _col(day_bars["close"], 3),
        "v": _col(day_bars["volume"]),
    }


def event_payload(ev: dict[str, Any], step: int) -> dict[str, Any]:
    now: pd.Timestamp = ev["sent"]
    return {
        "step": step,
        "kind": ev["kind"],
        "about_m": minute_of_session(pd.DatetimeIndex([ev["minute"]]))[0],
        "sent_m": minute_of_session(pd.DatetimeIndex([now]))[0],
        "text": ev["text"],
    }


def py(obj: Any) -> Any:
    """Recursively convert numpy scalars so the result is JSON-safe."""
    if isinstance(obj, dict):
        return {k: py(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [py(v) for v in obj]
    if isinstance(obj, (np.floating,)):
        return float(obj) if math.isfinite(float(obj)) else None
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


# ---------------------------------------------------------------- alerts
def _episode_json(i: int, ep: pd.DataFrame, cfg: dict[str, Any]) -> dict[str, Any]:
    peak = ep.loc[ep["risk_score"].idxmax()]
    reasons: list[dict[str, Any]] = []
    if ep["r_volume"].any():
        reasons.append({"kind": "volume", "value": float(ep["volume_z"].max())})
    if ep["r_reversal"].any():
        reasons.append({"kind": "reversal", "value": float(ep["reversion"].max()),
                        "direction": "up" if peak["move_z"] > 0 else "down"})
    if ep["r_flow"].any():
        row = ep.loc[ep["imbalance_abs"].idxmax()]
        reasons.append({"kind": "flow", "value": float(row["imbalance"]),
                        "side": "buying" if row["imbalance"] > 0 else "selling"})
    if not reasons:
        reasons.append({"kind": "model", "value": float(peak["model_strength"])})
    return {
        "id": f"ep{i}",
        "date": ep.index[0].strftime("%Y-%m-%d"),
        "level": str(peak["level"]),
        "score": round(float(peak["risk_score"]), 1),
        "start_m": minute_of_session(ep.index[:1])[0],
        "end_m": minute_of_session(ep.index[-1:])[0],
        "peak_m": minute_of_session(pd.DatetimeIndex([peak.name]))[0],
        "open_ms": session_open_ms(ep.index[0].normalize()),
        "reasons": reasons,
        "text": E.explain(ep),
        "score_parts": {
            "model_strength": round(float(peak["model_strength"]), 3),
            "model_points": round(100 * cfg["MODEL_WEIGHT"] * float(peak["model_strength"]), 1),
            "rules_fired": int(peak["rules_fired"]),
            "rule_points": round(100 * cfg["RULE_WEIGHT"] * float(peak["rules_fired"]) / 3, 1),
        },
        "rules": [
            {"id": "volume", "fired": bool(ep["r_volume"].any()), "value": round(float(ep["volume_z"].max()), 2),
             "threshold": cfg["VOL_Z_RULE"]},
            {"id": "reversal", "fired": bool(ep["r_reversal"].any()), "value": round(float(ep["reversion"].max()), 3),
             "threshold": cfg["REVERSION_RULE"]},
            {"id": "flow", "fired": bool(ep["r_flow"].any()),
             "value": round(float(ep["imbalance_abs"].max()), 3), "threshold": cfg["IMBALANCE_RULE"]},
        ],
    }


def _session_json(day: pd.Timestamp, scan: Scan, eps_by_day: dict[str, int]) -> dict[str, Any]:
    cfg = scan.cfg
    dbars = scan.bars[scan.bars.index.normalize() == day]
    dsc = scan.scored.reindex(dbars.index)
    risk = dsc["risk_score"]
    has_score = risk.notna().any()
    peak_idx = risk.idxmax() if has_score else None
    flags = (dsc["r_volume"].astype("float") * 1 + dsc["r_reversal"].astype("float") * 2
             + dsc["r_flow"].astype("float") * 4).where(dsc["risk_score"].notna())
    lvl = dsc["level"].astype("object").map(LEVEL_CODE)
    key = day.strftime("%Y-%m-%d")
    return {
        "date": key,
        "in_training": bool(day < scan.cut_day),
        "peak_score": round(float(risk.max()), 1) if has_score else None,
        "peak_m": minute_of_session(pd.DatetimeIndex([peak_idx]))[0] if peak_idx is not None else None,
        "flagged": int((risk >= cfg["ELEVATED"]).sum()),
        "high": int((risk >= cfg["HIGH"]).sum()),
        "episodes": eps_by_day.get(key, 0),
        "change_pct": round(float(dbars["close"].iloc[-1] / dbars["open"].iloc[0] - 1) * 100, 2),
        **bars_payload(dbars),
        "vz": _col(dsc["volume_z"], 2),
        "rev": _col(dsc["reversion"], 3),
        "imb": _col(dsc["imbalance"], 3),
        "risk": _col(risk, 1),
        "lvl": _col(lvl, None),
        "flags": _col(flags, None),
    }


def scan_to_json(scan: Scan) -> dict[str, Any]:
    cfg = scan.cfg
    episodes_json = [_episode_json(i, ep, cfg) for i, ep in enumerate(scan.eps)]
    eps_by_day: dict[str, int] = {}
    for e in episodes_json:
        eps_by_day[e["date"]] = eps_by_day.get(e["date"], 0) + 1
    days = scan.bars.index.normalize().unique()
    sessions = [_session_json(d, scan, eps_by_day) for d in days]
    scored_days = [s for s in sessions if s["peak_score"] is not None]
    top = max(scored_days, key=lambda s: s["peak_score"]) if scored_days else None
    flagged = int((scan.scored["risk_score"] >= cfg["ELEVATED"]).sum())
    return {
        "id": scan.id,
        "ticker": scan.ticker,
        "source": scan.source,
        "sensitivity": scan.sensitivity,
        "settings": {
            "elevated": cfg["ELEVATED"], "high": cfg["HIGH"],
            "vol_z": cfg["VOL_Z_RULE"], "reversion": cfg["REVERSION_RULE"], "imbalance": cfg["IMBALANCE_RULE"],
            "model_weight": cfg["MODEL_WEIGHT"], "rule_weight": cfg["RULE_WEIGHT"],
            "train_fraction": cfg["TRAIN_FRACTION"],
        },
        "summary": {
            "bars": int(len(scan.bars)),
            "sessions": len(sessions),
            "dropped_sessions": scan.dropped_sessions,
            "training_sessions": sum(1 for s in sessions if s["in_training"]),
            "first": sessions[0]["date"], "last": sessions[-1]["date"],
            "episodes": len(episodes_json),
            "high_episodes": sum(1 for e in episodes_json if e["level"] == "High"),
            "flagged_minutes": flagged,
            "peak": {"score": top["peak_score"], "date": top["date"], "m": top["peak_m"]} if top else None,
        },
        "sessions": sessions,
        "episodes": episodes_json,
    }
