"""Real-data study for the paper: run the unchanged detector on real Yahoo one-minute bars.

No planted events. Every number comes from real market data, so there is no ground truth and
no precision or recall. What it measures instead: how often the model alerts on real stocks,
what those alerts look like, and how many are market-wide moves rather than one-stock events.

Run from the repo root:
    .venv/Scripts/python research/real_data_study.py            # download, then analyse
    .venv/Scripts/python research/real_data_study.py --offline  # re-analyse saved bars only
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "server"))

import engine  # noqa: E402  (needs server/ on the path)

TICKERS = ["TSLA", "NVDA", "AAPL", "AMD", "META", "AMZN", "SPY", "QQQ", "TQQQ", "SQQQ",
           "SOXL", "GME", "AMC", "PLTR", "SOFI", "COIN", "MARA", "RIVN", "HOOD", "NIO"]
BARS_DIR = ROOT / "bars"          # raw bars are saved: Yahoo drops 1-minute data after ~30 days
OUT_DIR = ROOT / "results"
CFG = dict(engine.DEFAULT_CONFIG)  # the notebook's "Balanced" settings, unchanged
MARKET_WIDE_MIN_TICKERS = 3        # an episode is market-wide if 3+ other tickers alert within 2 min
CO_WINDOW = pd.Timedelta(minutes=2)


def fetch_bars(ticker, offline):
    path = BARS_DIR / f"{ticker}.csv.gz"
    if offline:
        bars = pd.read_csv(path, index_col=0)
        bars.index = pd.to_datetime(bars.index, utc=True).tz_convert(engine.NY)
        return bars
    bars = engine.load_yfinance(ticker, CFG["DAYS"])
    BARS_DIR.mkdir(exist_ok=True)
    bars.to_csv(path)
    return bars


def time_bucket(ts):
    t = ts.hour * 60 + ts.minute
    if t < 10 * 60:
        return "first_30_min"
    if t >= 15 * 60 + 30:
        return "last_30_min"
    return "midday"


def episode_rows(ticker, scored):
    rows = []
    for ep in engine.episodes(scored, CFG):
        peak = ep.loc[ep["risk_score"].idxmax()]
        rows.append({
            "ticker": ticker, "start": ep.index[0], "end": ep.index[-1],
            "minutes": len(ep), "peak_score": round(float(peak["risk_score"]), 1),
            "level": str(peak["level"]),
            "volume_rule": bool(ep["r_volume"].any()), "reversal_rule": bool(ep["r_reversal"].any()),
            "flow_rule": bool(ep["r_flow"].any()), "model_flag": bool(ep["model_flag"].any()),
            "bucket": time_bucket(ep.index[0]),
        })
    return rows


def replay_events(ticker, bars, train_days, test_days):
    """Live two-stage monitor replayed minute by minute over each test session."""
    history = bars[bars.index.normalize().isin(train_days)]
    events = []
    for day in test_days:
        mon = engine.run_replay(bars[bars.index.normalize() == day], history, CFG, log=lambda *_: None)
        events += [{"ticker": ticker, "kind": ev["kind"], "minute": ev["minute"]} for ev in mon.events]
    return events


def study_ticker(args):
    ticker, offline = args
    bars = fetch_bars(ticker, offline)
    feat = engine.build_features(bars, CFG)
    train, test = engine.split_by_session(feat, CFG["TRAIN_FRACTION"])
    scored = engine.HFTDetector(CFG).fit(train).score(test)
    train_days = train.index.normalize().unique()
    test_days = test.index.normalize().unique()
    eps = episode_rows(ticker, scored)
    events = replay_events(ticker, bars, train_days, test_days)
    kinds = pd.Series([ev["kind"] for ev in events], dtype=object).value_counts()
    summary = {
        "ticker": ticker,
        "first_session": str(bars.index[0].date()), "last_session": str(bars.index[-1].date()),
        "train_sessions": len(train_days), "test_sessions": len(test_days),
        "test_minutes": len(scored),
        "elevated_or_high_minutes": int((scored["risk_score"] >= CFG["ELEVATED"]).sum()),
        "high_minutes": int((scored["risk_score"] >= CFG["HIGH"]).sum()),
        "model_flag_minutes": int(scored["model_flag"].sum()),
        "episodes": len(eps),
        **{f"replay_{k.lower().replace(' ', '_')}": int(kinds.get(k, 0))
           for k in ("EARLY WARNING", "CONFIRMED", "CLEARED", "ALERT")},
    }
    return summary, eps, events


def tag_market_wide(rows, time_col, eps):
    """Count how many OTHER tickers had an alert episode within 2 minutes of each row."""
    others = []
    for _, row in rows.iterrows():
        near = eps[(eps["ticker"] != row["ticker"]) & ((eps["start"] - row[time_col]).abs() <= CO_WINDOW)]
        others.append(near["ticker"].nunique())
    rows = rows.assign(other_tickers_within_2min=others)
    return rows.assign(market_wide=rows["other_tickers_within_2min"] >= MARKET_WIDE_MIN_TICKERS)


def main():
    offline = "--offline" in sys.argv
    with ProcessPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(study_ticker, [(t, offline) for t in TICKERS]))
    OUT_DIR.mkdir(exist_ok=True)
    summaries = pd.DataFrame([s for s, _, _ in results])
    eps = pd.DataFrame([e for _, ep, _ in results for e in ep]).sort_values("start").reset_index(drop=True)
    eps = tag_market_wide(eps, "start", eps)
    events = tag_market_wide(pd.DataFrame([e for _, _, ev in results for e in ev]), "minute", eps)
    summaries.to_csv(OUT_DIR / "per_ticker.csv", index=False)
    eps.to_csv(OUT_DIR / "episodes.csv", index=False)
    events.to_csv(OUT_DIR / "replay_events.csv", index=False)
    (OUT_DIR / "config.json").write_text(json.dumps(CFG, indent=2))
    print(summaries.to_string(index=False))
    print(f"\nepisodes: {len(eps)}, market-wide: {int(eps['market_wide'].sum())}")
    print(events.groupby("kind")["market_wide"].agg(["count", "sum"]).to_string())


if __name__ == "__main__":
    main()
