"""Detection engine: the model from HFT_Footprint_Detector.ipynb, moved into a module.

The detection logic is unchanged. What differs from the notebook:
  1. No matplotlib. Charts are drawn by the web interface.
  2. Every function takes `cfg` explicitly instead of reading a global CONFIG,
     so each request can use its own thresholds.
  3. Loaders accept uploaded files, and replay results are returned as data
     instead of being printed.
"""
import time

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

import market_hours
from errors import UserError

NY = "America/New_York"

DEFAULT_CONFIG = {
    "SOURCE": "yfinance",       # "yfinance" | "alpaca" | "csv" | "synthetic"
    "TICKER": "TSLA",
    "DAYS": 29,                 # yfinance only serves 1-minute bars for the last ~30 days
    "ALPACA_KEY": "",
    "ALPACA_SECRET": "",

    # Feature settings
    "VOL_WINDOW": 20,           # rolling baseline for the volume Z-score
    "RET_WINDOW": 60,           # rolling baseline for "normal" price movement
    "MOVE_BARS": 3,             # length of the price push we check for reversal
    "REVERT_BARS": 5,           # how many minutes later we check if the push reversed
    "IMB_WINDOW": 5,            # window for the order imbalance proxy

    # Rule thresholds
    "VOL_Z_RULE": 2.5,
    "REVERSION_RULE": 0.5,      # at least 50% of the push given back
    "IMBALANCE_RULE": 0.6,      # flow strongly one-sided
    "CONFIRM_REVERSION": 0.35,  # live mode: share of the push that must reverse to confirm a warning

    # Model and score
    "TRAIN_FRACTION": 0.6,
    "CONTAMINATION": 0.01,
    "MODEL_WEIGHT": 0.6,        # share of risk score from Isolation Forest
    "RULE_WEIGHT": 0.4,         # share from rule triggers
    "ELEVATED": 50,
    "HIGH": 70,
}

COLS = ["open", "high", "low", "close", "volume"]
FEATURES = ["volume_z", "reversion", "imbalance_abs"]


# --------------------------------------------------------------------------
# Data loaders
# --------------------------------------------------------------------------
def _clean(df):
    df = df.copy()
    df.columns = [str(c).lower() for c in df.columns]
    df = df[COLS].astype(float).dropna()
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    df.index = df.index.tz_convert(NY)
    df = df.between_time("09:30", "15:59")
    df = df[df["volume"] > 0]
    return df[~df.index.duplicated()].sort_index()


def _flatten(df):
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def load_yfinance(ticker, days=29):
    import yfinance as yf
    end = pd.Timestamp.today().normalize() + pd.Timedelta(days=1)
    start = end - pd.Timedelta(days=days)
    parts, s = [], start
    while s < end:  # Yahoo allows max ~7 days of 1m bars per request
        e = min(s + pd.Timedelta(days=7), end)
        part = yf.download(ticker, start=s.strftime("%Y-%m-%d"), end=e.strftime("%Y-%m-%d"),
                           interval="1m", auto_adjust=False, progress=False)
        if len(part):
            if isinstance(part.columns, pd.MultiIndex):
                part.columns = part.columns.get_level_values(0)
            parts.append(part)
        s = e
    if not parts:
        raise UserError("No data returned. Check the ticker or try fewer days.")
    return _clean(pd.concat(parts))


def load_alpaca(ticker, days, key, secret):
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame
    from alpaca.data.enums import DataFeed
    client = StockHistoricalDataClient(key, secret)
    end = pd.Timestamp.now(tz="UTC") - pd.Timedelta(minutes=1)  # free IEX feed is real time
    req = StockBarsRequest(symbol_or_symbols=ticker, timeframe=TimeFrame.Minute,
                           start=end - pd.Timedelta(days=days), end=end,
                           feed=DataFeed.IEX)  # IEX is a small slice of total volume
    df = client.get_stock_bars(req).df
    if isinstance(df.index, pd.MultiIndex):
        df = df.xs(ticker, level="symbol")
    return _clean(df)


def load_csv(path, max_rows=None):
    """`path` can be a file path or any file-like object (an uploaded file).

    Web-app change: timestamps without a timezone are read as New York time (what broker exports
    use) instead of UTC, and problems raise UserError with a plain message."""
    try:
        df = pd.read_csv(path, nrows=None if max_rows is None else max_rows + 1)
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise UserError("That file could not be read as a CSV.") from exc
    if max_rows is not None and len(df) > max_rows:
        raise UserError(f"That file has more than {max_rows:,} rows. Use a shorter date range.")
    candidates = [c for c in df.columns if str(c).lower() in ("timestamp", "datetime", "date", "time")]
    if not candidates:
        raise UserError("The CSV needs a timestamp column named timestamp, datetime, date or time.")
    ts = candidates[0]
    try:
        stamps = pd.to_datetime(df[ts])
    except (ValueError, TypeError):  # mixed UTC offsets, for example a file that spans a clock change
        stamps = pd.to_datetime(df[ts], utc=True, errors="coerce")
    if stamps.dt.tz is None:
        stamps = stamps.dt.tz_localize(NY, ambiguous="NaT", nonexistent="NaT")
    mask = stamps.notna().to_numpy()
    if not mask.any():
        raise UserError("No readable timestamps were found in the CSV.")
    df = df.loc[mask].drop(columns=[ts])
    df.index = pd.DatetimeIndex(stamps[mask])
    missing = [c for c in COLS if c not in {str(x).lower() for x in df.columns}]
    if missing:
        raise UserError("The CSV is missing these columns: " + ", ".join(missing) + ".")
    return _clean(df)


def make_synthetic(days=20, seed=7, start="2026-08-03"):
    """Realistic-ish minute bars with a U-shaped intraday volume curve. For testing only."""
    rng = np.random.default_rng(seed)
    idx = []
    for d in pd.bdate_range(start, periods=days):
        idx.extend(pd.date_range(d + pd.Timedelta(hours=9, minutes=30), periods=390, freq="1min"))
    idx = pd.DatetimeIndex(idx).tz_localize(NY)
    n = len(idx)
    minute = np.tile(np.arange(390), days)
    u_shape = 1 + 1.5 * ((minute - 195) / 195) ** 2
    volume = rng.lognormal(np.log(20000), 0.35, n) * u_shape
    ret = rng.normal(0, 0.0006, n) * np.sqrt(u_shape)
    # Decoys: news-style jumps (big volume + move that does NOT reverse), plus lunch-hour volume blips.
    # These are the innocent look-alikes a good detector must not flag.
    for t in rng.choice(np.arange(60, n - 60), size=days * 2, replace=False):
        ret[t:t + 2] += rng.choice([-1, 1]) * rng.uniform(0.003, 0.008) / 2
        volume[t:t + 6] *= rng.uniform(3, 7)
    for t in rng.choice(np.arange(60, n - 60), size=days * 3, replace=False):
        volume[t] *= rng.uniform(3, 5)
    close = 250 * np.exp(np.cumsum(ret))
    open_ = np.r_[close[0], close[:-1]]
    wick = np.abs(rng.normal(0, 0.0004, (2, n))) * close
    high = np.maximum(open_, close) + wick[0]
    low = np.minimum(open_, close) - wick[1]
    return pd.DataFrame({"open": open_, "high": high, "low": low, "close": close,
                         "volume": volume.round()}, index=idx)


def load_data(cfg, csv_file=None):
    src = cfg["SOURCE"]
    if src == "yfinance":
        return load_yfinance(cfg["TICKER"], cfg["DAYS"])
    if src == "alpaca":
        return load_alpaca(cfg["TICKER"], cfg["DAYS"], cfg["ALPACA_KEY"], cfg["ALPACA_SECRET"])
    if src == "csv":
        return load_csv(csv_file)
    return make_synthetic()


# --------------------------------------------------------------------------
# Feature engineering
# --------------------------------------------------------------------------
def build_features(df, cfg=DEFAULT_CONFIG, require_forward=True):
    out = df.copy()
    day = out.index.normalize()
    by_day = lambda s: s.groupby(day)

    # Feature 1: Volume Z-score (log volume, baseline excludes the current bar)
    logv = np.log1p(out["volume"])
    base = by_day(logv).transform(lambda s: s.shift(1).rolling(cfg["VOL_WINDOW"], min_periods=10).mean())
    sd = by_day(logv).transform(lambda s: s.shift(1).rolling(cfg["VOL_WINDOW"], min_periods=10).std())
    out["volume_z"] = ((logv - base) / sd.replace(0, np.nan)).fillna(0)

    # Feature 2: Price Reversion Rate
    logc = np.log(out["close"])
    ret = by_day(logc).diff()
    ret_sd = by_day(ret).transform(lambda s: s.shift(1).rolling(cfg["RET_WINDOW"], min_periods=20).std())
    m, k = cfg["MOVE_BARS"], cfg["REVERT_BARS"]
    move = by_day(logc).diff(m)
    fwd = by_day(logc).shift(-k) - logc
    sharp = move.abs() > 2.5 * ret_sd * np.sqrt(m)
    out["reversion"] = np.where(sharp, (-fwd / move).clip(-1, 2), 0.0)
    out["reversion"] = out["reversion"].fillna(0)
    out["move_z"] = (move / (ret_sd * np.sqrt(m))).fillna(0)

    # Feature 3: Order Imbalance Proxy
    rng = (out["high"] - out["low"]).replace(0, np.nan)
    clv = (((out["close"] - out["low"]) - (out["high"] - out["close"])) / rng).fillna(0)
    w = cfg["IMB_WINDOW"]
    num = by_day(clv * out["volume"]).transform(lambda s: s.rolling(w, min_periods=1).sum())
    den = by_day(out["volume"]).transform(lambda s: s.rolling(w, min_periods=1).sum())
    out["imbalance"] = (num / den).fillna(0)

    out["imbalance_abs"] = out["imbalance"].abs()

    # "confirmed" = the 5 future minutes needed for reversion exist. Live mode keeps unconfirmed rows.
    out["confirmed"] = fwd.notna()
    ready = sd.notna() & ret_sd.notna()
    if require_forward:
        ready &= fwd.notna()
    return out[ready]


# --------------------------------------------------------------------------
# Model, rules and HFT Risk Score
# --------------------------------------------------------------------------
class HFTDetector:
    def __init__(self, cfg=DEFAULT_CONFIG):
        self.cfg = cfg
        self.model = IsolationForest(n_estimators=300, contamination=cfg["CONTAMINATION"], random_state=42)

    def fit(self, feat_df):
        X = feat_df[FEATURES].values
        self.model.fit(X)
        self.train_raw = np.sort(-self.model.score_samples(X))
        return self

    def score(self, feat_df):
        c = self.cfg
        out = feat_df.copy()
        raw = -self.model.score_samples(out[FEATURES].values)
        out["model_pct"] = np.searchsorted(self.train_raw, raw) / len(self.train_raw)
        out["model_strength"] = ((out["model_pct"] - 0.95) / 0.05).clip(0, 1)
        out["model_flag"] = -raw < self.model.offset_  # same as predict() == -1, without scoring twice

        out["r_volume"] = out["volume_z"] > c["VOL_Z_RULE"]
        out["r_reversal"] = out["reversion"] > c["REVERSION_RULE"]
        out["r_flow"] = out["imbalance_abs"] > c["IMBALANCE_RULE"]
        out["rules_fired"] = out[["r_volume", "r_reversal", "r_flow"]].sum(axis=1)

        out["risk_score"] = 100 * (c["MODEL_WEIGHT"] * out["model_strength"]
                                   + c["RULE_WEIGHT"] * out["rules_fired"] / 3)
        out["level"] = pd.cut(out["risk_score"], [-1, c["ELEVATED"], c["HIGH"], 101],
                              labels=["Normal", "Elevated", "High"], right=False)
        return out


def split_by_session(df, frac):
    days = df.index.normalize().unique()
    cut = days[int(len(days) * frac)]
    return df[df.index.normalize() < cut], df[df.index.normalize() >= cut]


# --------------------------------------------------------------------------
# Plain-English alerts
# --------------------------------------------------------------------------
def episodes(scored_df, cfg=DEFAULT_CONFIG, min_level=None, gap_minutes=5):
    thr = cfg["ELEVATED"] if min_level is None else min_level
    hits = scored_df[scored_df["risk_score"] >= thr]
    if hits.empty:
        return []
    groups, current = [], [hits.index[0]]
    for t in hits.index[1:]:
        if (t - current[-1]) <= pd.Timedelta(minutes=gap_minutes) and t.date() == current[-1].date():
            current.append(t)
        else:
            groups.append(current)
            current = [t]
    groups.append(current)
    return [hits.loc[g] for g in groups]


def explain(ep):
    peak = ep.loc[ep["risk_score"].idxmax()]
    reasons = []
    if ep["r_volume"].any():
        reasons.append(f"trading volume jumped to {ep['volume_z'].max():.1f} standard deviations above its recent normal")
    if ep["r_reversal"].any():
        direction = "up" if peak["move_z"] > 0 else "down"
        reasons.append(f"the price was pushed sharply {direction} and about {ep['reversion'].max():.0%} of that move reversed within 5 minutes")
    if ep["r_flow"].any():
        side = "buying" if ep.loc[ep["imbalance_abs"].idxmax(), "imbalance"] > 0 else "selling"
        reasons.append(f"order flow was heavily one-sided ({side})")
    if not reasons:
        reasons.append("the combination of volume, price movement and order flow was statistically unusual for this stock")
    start, end = ep.index[0].strftime("%d %b %H:%M"), ep.index[-1].strftime("%H:%M")
    return (f"[{peak['level'].upper()} | score {peak['risk_score']:.0f}/100] {start}-{end} ET: "
            + "; ".join(reasons) + ". This pattern is consistent with fast algorithmic trading. "
            "It is a warning sign, not proof of manipulation.")


def latest_alerts(scored_df, cfg=DEFAULT_CONFIG, n=5):
    eps = episodes(scored_df, cfg)
    if not eps:
        return ["No HFT-like activity flagged in this period."]
    return [explain(e) for e in eps[-n:]]


# --------------------------------------------------------------------------
# Evaluation with injected momentum-ignition events
# --------------------------------------------------------------------------
def inject_events(df, n_events=40, seed=11):
    rng = np.random.default_rng(seed)
    out = df.copy()
    labels = pd.Series(False, index=out.index)
    starts = []
    days = out.index.normalize().unique()
    for _ in range(n_events * 5):
        if len(starts) >= n_events:
            break
        day_bars = np.where(out.index.normalize() == rng.choice(days))[0]
        t = int(rng.integers(day_bars[0] + 70, day_bars[-1] - 20))
        if any(abs(t - s) < 30 for s in starts):
            continue
        starts.append(t)
        size = rng.uniform(0.0025, 0.007) * rng.choice([-1, 1])
        keep = rng.uniform(0.0, 0.35)  # how much of the push survives
        path = np.array([size / 3, 2 * size / 3, size,
                         size * (keep + (1 - keep) * 0.7), size * (keep + (1 - keep) * 0.4),
                         size * (keep + (1 - keep) * 0.15), size * keep, size * keep])
        seg = out.iloc[t:t + len(path)].copy()
        base = np.log(out["close"].iloc[t - 1])
        prev = base
        closes = np.exp(np.log(seg["close"].values) + path)
        for i, (ts, c_new) in enumerate(zip(seg.index, closes)):
            o_new = np.exp(prev) if i else out.at[ts, "open"]
            wick = abs(out.at[ts, "high"] - out.at[ts, "low"]) * 0.15
            burst = i < 3
            hi = max(o_new, c_new) + (wick * 0.2 if burst and size > 0 else wick)
            lo = min(o_new, c_new) - (wick * 0.2 if burst and size < 0 else wick)
            out.loc[ts, ["open", "high", "low", "close"]] = [o_new, hi, lo, c_new]
            out.at[ts, "volume"] *= rng.uniform(3, 6) if burst else rng.uniform(1.5, 3)
            prev = np.log(c_new)
        # carry the surviving shift forward for the rest of the day so the series stays continuous
        rest = out.index[(out.index > seg.index[-1]) & (out.index.normalize() == seg.index[0].normalize())]
        out.loc[rest, ["open", "high", "low", "close"]] *= np.exp(size * keep)
        labels.iloc[t:t + len(path)] = True
    return out, labels, [out.index[s] for s in starts]


def evaluate(scored_df, event_times, flag_col, name, cfg=DEFAULT_CONFIG):
    flagged = scored_df[scored_df[flag_col]]
    fake = scored_df.assign(risk_score=np.where(scored_df[flag_col], 100, 0))
    eps = episodes(fake, cfg, min_level=50)
    window = pd.Timedelta(minutes=10)
    caught = sum(((flagged.index >= t) & (flagged.index <= t + window)).any() for t in event_times)
    true_eps = sum(any((e.index[0] <= t + window) and (e.index[-1] >= t) for t in event_times) for e in eps)
    precision = true_eps / len(eps) if eps else 0.0
    recall = caught / len(event_times)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"method": name, "alert_episodes": len(eps), "precision": round(precision, 3),
            "recall": round(recall, 3), "f1": round(f1, 3)}


def planted_setup(bars, cfg=DEFAULT_CONFIG):
    """Split sessions, plant known momentum-ignition events in the test sessions."""
    train_bars, test_bars = split_by_session(bars, cfg["TRAIN_FRACTION"])
    test_injected, _labels, event_times = inject_events(test_bars)
    return train_bars, test_bars, test_injected, event_times


def run_method_comparison(bars, cfg=DEFAULT_CONFIG, setup=None):
    """Notebook section 7: rules only vs Isolation Forest only vs hybrid, plus a threshold sweep."""
    train_bars, test_bars, test_injected, event_times = setup or planted_setup(bars, cfg)
    eval_feat = build_features(pd.concat([train_bars, test_injected]), cfg)
    eval_train, eval_test = split_by_session(eval_feat, cfg["TRAIN_FRACTION"])

    eval_det = HFTDetector(cfg).fit(eval_train)
    s = eval_det.score(eval_test)
    s["rules_only"] = s["rules_fired"] >= 2
    s["model_only"] = s["model_flag"]
    s["hybrid"] = s["risk_score"] >= cfg["ELEVATED"]

    methods = [
        evaluate(s, event_times, "rules_only", "Rules only (2 of 3)", cfg),
        evaluate(s, event_times, "model_only", "Isolation Forest only", cfg),
        evaluate(s, event_times, "hybrid", "Hybrid risk score", cfg),
    ]
    sweep = []
    for thr in range(20, 95, 5):
        s["_flag"] = s["risk_score"] >= thr
        r = evaluate(s, event_times, "_flag", thr, cfg)
        sweep.append({"threshold": thr, **{k: r[k] for k in ("alert_episodes", "precision", "recall", "f1")}})
    return {
        "n_events": len(event_times),
        "n_test_sessions": int(test_bars.index.normalize().nunique()),
        "methods": methods,
        "sweep": sweep,
    }


# --------------------------------------------------------------------------
# Live mode: two-stage alerts
# --------------------------------------------------------------------------
def score_live(det, feat_df):
    """Full score for confirmed minutes, early score for every minute."""
    c = det.cfg
    out = det.score(feat_df)
    out["r_move"] = out["move_z"].abs() > 2.5
    out["early_hits"] = out[["r_volume", "r_flow", "r_move"]].sum(axis=1)
    out["early_score"] = 100 * (c["MODEL_WEIGHT"] * out["model_strength"]
                                + c["RULE_WEIGHT"] * out["early_hits"] / 3)
    return out


def early_text(row):
    bits = []
    if row["r_volume"]:
        bits.append(f"volume {row['volume_z']:.1f} standard deviations above normal")
    if row["r_move"]:
        bits.append(f"price moved sharply {'up' if row['move_z'] > 0 else 'down'} in 3 minutes")
    if row["r_flow"]:
        bits.append(f"{'buying' if row['imbalance'] > 0 else 'selling'} is heavily one-sided")
    if not bits:
        bits.append("unusual mix of volume and order flow")
    return (f"score {row['early_score']:.0f}/100: " + ", ".join(bits)
            + ". Watching for a reversal over the next 5 minutes.")


class LiveMonitor:
    """Feed it bars minute by minute via fetch_fn(); it emits early warnings, confirmations and clears."""

    def __init__(self, detector, fetch_fn, cfg=DEFAULT_CONFIG, log=print):
        self.det, self.fetch, self.cfg, self.log = detector, fetch_fn, cfg, log
        self.warnings = {}          # early warning time -> row
        self.resolved = set()       # warnings already confirmed or cleared
        self.seen_until = None      # newest minute already checked for early warnings
        self.checked_until = None   # newest confirmed minute already checked for late alerts
        self.last_late = None
        self.events = []            # every message, for analysis afterwards
        self.now = None

    def _emit(self, kind, t, text):
        self.events.append({"kind": kind, "minute": t, "sent": self.now, "text": text})
        self.log(f"{self.now:%H:%M} ET | {kind:<13} | about {t:%H:%M}: {text}")

    def step(self):
        bars = self.fetch()
        if bars is None or len(bars) == 0:
            return
        bars = bars.tail(150)  # plenty for a 60-minute baseline, keeps each step fast
        self.now = bars.index[-1] + pd.Timedelta(minutes=1)  # the moment this minute closed
        today = bars.index[-1].normalize()
        f = build_features(bars, self.cfg, require_forward=False)
        f = f[f.index.normalize() == today].tail(15)  # only recent minutes can still change
        if f.empty:
            return  # still in warm-up
        s = score_live(self.det, f)
        thr, gap = self.cfg["ELEVATED"], pd.Timedelta(minutes=5)

        # Stage 1: early warnings on minutes we have not looked at yet
        new = s if self.seen_until is None else s[s.index > self.seen_until]
        if self.seen_until is None:
            new = new.tail(1)
        for t, row in new.iterrows():
            if row["early_score"] >= thr and not any(abs(t - w) <= gap for w in self.warnings):
                self.warnings[t] = row
                self._emit("EARLY WARNING", t, early_text(row))
        self.seen_until = s.index[-1]

        # Stage 2: confirm or clear warnings once their 5-minute window has closed
        conf = s[s["confirmed"]]
        for t in sorted(set(self.warnings) - self.resolved):
            if conf.empty or conf.index[-1] < t + pd.Timedelta(minutes=2):
                continue
            window = conf[(conf.index >= t) & (conf.index <= t + pd.Timedelta(minutes=2))]
            reversed_ = (window["reversion"] > self.cfg["CONFIRM_REVERSION"]).any()
            if reversed_ and window["risk_score"].max() >= thr:  # confirmed only if the push actually reversed
                self._emit("CONFIRMED", t, explain(window[(window["risk_score"] >= thr) | window["r_reversal"]]))
            else:
                self._emit("CLEARED", t, "the move held instead of reversing. More consistent with "
                                         "genuine buying or selling (for example news) than a push-and-pull pattern.")
            self.resolved.add(t)

        # Stage 2b: anything the full score catches that had no early warning
        fresh = conf if self.checked_until is None else conf[conf.index > self.checked_until]
        for t, row in fresh.iterrows():
            covered = any(w - pd.Timedelta(minutes=2) <= t <= w + pd.Timedelta(minutes=7) for w in self.warnings)
            recent = self.last_late is not None and t - self.last_late <= gap
            if row["risk_score"] >= thr and not covered and not recent:
                self._emit("ALERT", t, explain(conf.loc[[t]]))
                self.last_late = t
        if len(conf):
            self.checked_until = conf.index[-1]


# --------------------------------------------------------------------------
# Live data feeds and replay
# --------------------------------------------------------------------------
def _completed_only(df):
    now = pd.Timestamp.now(tz=NY)
    return df[df.index + pd.Timedelta(minutes=1) <= now]


def yfinance_feed(ticker):
    import yfinance as yf

    def fetch():
        df = yf.download(ticker, period="1d", interval="1m", auto_adjust=False, progress=False)
        return _completed_only(_clean(_flatten(df))) if len(df) else None
    return fetch


def alpaca_feed(ticker, key, secret):
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame
    from alpaca.data.enums import DataFeed
    client = StockHistoricalDataClient(key, secret)

    def fetch():
        now = pd.Timestamp.now(tz=NY)
        req = StockBarsRequest(symbol_or_symbols=ticker, timeframe=TimeFrame.Minute,
                               start=now.normalize() + pd.Timedelta(hours=9, minutes=30), end=now,
                               feed=DataFeed.IEX)
        df = client.get_stock_bars(req).df
        if len(df) == 0:
            return None
        if isinstance(df.index, pd.MultiIndex):
            df = df.xs(ticker, level="symbol")
        return _completed_only(_clean(df))
    return fetch


def market_is_open():
    """Web-app change: holidays and half days count as closed (the notebook only checked for weekdays)."""
    return market_hours.is_open(pd.Timestamp.now(tz=NY))


def run_replay(day_bars, history_bars, cfg=DEFAULT_CONFIG, pause=0.0, log=print, on_step=None):
    """Feed one past session to the monitor one minute at a time, exactly as the live feed would.

    `on_step(i, new_events, monitor)` is called after every minute (the web app uses it for progress)."""
    det = HFTDetector(cfg).fit(build_features(history_bars, cfg))
    day_bars = day_bars.sort_index()
    clock = {"i": 0}
    mon = LiveMonitor(det, lambda: day_bars.iloc[:clock["i"]], cfg, log=log)
    for i in range(1, len(day_bars) + 1):
        clock["i"] = i
        before = len(mon.events)
        mon.step()
        if on_step:
            on_step(i, mon.events[before:], mon)
        if pause:
            time.sleep(pause)  # e.g. 0.3 for a watchable demo
    return mon


def replay_evaluation(test_injected, train_bars, event_times, cfg=DEFAULT_CONFIG, progress=None):
    """Notebook section 10: replay every test session and measure early-warning and confirmation quality."""
    test_days = test_injected.index.normalize().unique()
    msgs, per_event = [], []
    for n, d in enumerate(test_days):
        day = test_injected[test_injected.index.normalize() == d]
        mon = run_replay(day, train_bars, cfg, log=lambda *_: None)
        ev = pd.DataFrame(mon.events, columns=["kind", "minute", "sent", "text"])
        msgs.append(ev)
        for t in [e for e in event_times if e.normalize() == d]:
            near = ev[(ev["minute"] >= t - pd.Timedelta(minutes=1)) & (ev["minute"] <= t + pd.Timedelta(minutes=6))]
            early = near[near["kind"] == "EARLY WARNING"]
            final = near[near["kind"].isin(["CONFIRMED", "ALERT"])]
            per_event.append({
                "event": t,
                "early_warning": len(early) > 0,
                "warning_delay_min": (early["sent"].min() - t).total_seconds() / 60 if len(early) else np.nan,
                "confirmed": len(final) > 0,
                "confirm_delay_min": (final["sent"].min() - t).total_seconds() / 60 if len(final) else np.nan,
            })
        if progress:
            progress(n + 1, len(test_days))
    if not per_event:  # web-app guard: no planted event landed on a replayed day
        empty = {"caught": 0.0, "median_delay": None, "precision": None, "count": 0}
        return {"n_events": 0, "early": empty, "confirmed": dict(empty), "cleared": {"count": 0, "decoys": 0}}
    msgs = pd.concat(msgs)
    res = pd.DataFrame(per_event)

    def is_event(m):
        return any(t - pd.Timedelta(minutes=1) <= m <= t + pd.Timedelta(minutes=6) for t in event_times)
    msgs["real_event"] = msgs["minute"].apply(is_event)
    warn = msgs[msgs["kind"] == "EARLY WARNING"]
    final = msgs[msgs["kind"].isin(["CONFIRMED", "ALERT"])]
    cleared = msgs[msgs["kind"] == "CLEARED"]

    def num(x):
        return None if pd.isna(x) else float(x)

    return {
        "n_events": int(len(res)),
        "early": {"caught": float(res["early_warning"].mean()), "median_delay": num(res["warning_delay_min"].median()),
                  "precision": num(warn["real_event"].mean()) if len(warn) else None, "count": int(len(warn))},
        "confirmed": {"caught": float(res["confirmed"].mean()), "median_delay": num(res["confirm_delay_min"].median()),
                      "precision": num(final["real_event"].mean()) if len(final) else None, "count": int(len(final))},
        "cleared": {"count": int(len(cleared)), "decoys": int((~cleared["real_event"]).sum())},
    }
