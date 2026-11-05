"""Controls for the real-data study, requested by the mock peer review.

Everything uses the unchanged detector (server/engine.py) and the same settings as
real_data_study.py. Real market data only, apart from the clearly labelled planted-event
and shuffled-data controls.

  1. Sensitivity    alert rate under other score gates and alert cut-offs, and under other
                    Isolation Forest contamination settings
  2. Ablation       rules only vs Isolation Forest only vs the combined score, on real data
                    and on planted events (the positive control)
  3. Shuffled data  the same pipeline on bars shuffled within each session (null)
  4. Shifted times  does the market-wide share exceed what chance timing gives?
  5. Comparison     20 lower-volatility large caps, same dates and settings
  6. Intervals      bootstrap over trading days

Run from the repo root:
    .venv/Scripts/python research/controls_study.py            # downloads the comparison group
    .venv/Scripts/python research/controls_study.py --offline  # uses saved bars only
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "server"))

import engine  # noqa: E402
import real_data_study as rds  # noqa: E402

CFG = rds.CFG
OUT = ROOT / "results" / "controls"
COMP_DIR = ROOT / "bars_comparison"
COMP_TICKERS = ["KO", "PG", "JNJ", "WMT", "XOM", "JPM", "PEP", "MRK", "CVX", "HD",
                "VZ", "T", "CSCO", "INTC", "ORCL", "IBM", "MCD", "CAT", "LOW", "ABT"]
FIRST_SESSION = pd.Timestamp("2026-09-21", tz=engine.NY)
GATES = [0.90, 0.95, 0.99]
CUTOFFS = [40, 50, 60]
CONTAMINATIONS = [0.005, 0.01, 0.02]
SHUFFLE_BLOCKS = [1, 10]
N_SHIFT_DRAWS = 300
N_BOOT = 5000


# ---------------------------------------------------------------- pipeline pieces
def prep(bars, cfg=CFG):
    feat = engine.build_features(bars, cfg)
    train, test = engine.split_by_session(feat, cfg["TRAIN_FRACTION"])
    det = engine.HFTDetector(cfg).fit(train)
    return train, test, det, det.score(test)


def score_with_gate(det, feat_df, gate):
    """engine.HFTDetector.score with the 95th-percentile gate made a parameter."""
    c = det.cfg
    out = feat_df.copy()
    raw = -det.model.score_samples(out[engine.FEATURES].values)
    pct = np.searchsorted(det.train_raw, raw) / len(det.train_raw)
    strength = ((pct - gate) / (1 - gate)).clip(0, 1)
    rules = ((out["volume_z"] > c["VOL_Z_RULE"]).astype(int)
             + (out["reversion"] > c["REVERSION_RULE"]).astype(int)
             + (out["imbalance_abs"] > c["IMBALANCE_RULE"]).astype(int))
    out["risk_score"] = 100 * (c["MODEL_WEIGHT"] * strength + c["RULE_WEIGHT"] * rules / 3)
    return out


def n_episodes(scored, cutoff):
    return len(engine.episodes(scored, CFG, min_level=cutoff))


def flag_episodes(scored, flag_col):
    """Episode count for a boolean flag, merged the way engine.evaluate merges them."""
    fake = scored.assign(risk_score=np.where(scored[flag_col], 100, 0))
    return len(engine.episodes(fake, CFG, min_level=50))


def shuffle_bars(bars, block, seed):
    """Shuffle blocks of bars inside each session, keeping each bar's own shape and volume.

    Prices are rebuilt from each bar's open/high/low/close relative to the previous close, so
    the series stays continuous. Within-block order is kept; the order of blocks is random."""
    rng = np.random.default_rng(seed)
    parts = []
    for _, g in bars.sort_index().groupby(bars.sort_index().index.normalize()):
        o, h, lo, c, v = (g[k].to_numpy() for k in ("open", "high", "low", "close", "volume"))
        prev = np.r_[o[0], c[:-1]]
        rel = np.log(np.column_stack([o, h, lo, c]) / prev[:, None])
        idx = np.arange(len(g))
        blocks = [idx[i:i + block] for i in range(0, len(g), block)]
        perm = np.concatenate([blocks[i] for i in rng.permutation(len(blocks))])
        rel, v = rel[perm], v[perm]
        level = np.r_[o[0], o[0] * np.exp(np.cumsum(rel[:, 3]))[:-1]]
        new = level[:, None] * np.exp(rel)
        df = pd.DataFrame(new, columns=["open", "high", "low", "close"], index=g.index)
        df["volume"] = v
        parts.append(df)
    return pd.concat(parts)


# ---------------------------------------------------------------- per-ticker tasks
def main_task(args):
    i, ticker, offline = args
    bars = rds.fetch_bars(ticker, offline)
    train, test, det, scored = prep(bars)
    days = test.index.normalize().nunique()
    row = {"ticker": ticker, "test_days": days}

    # 1. sensitivity (gate x cut-off) and contamination
    default_check = score_with_gate(det, test, 0.95)["risk_score"]
    assert np.allclose(default_check, scored["risk_score"]), "gate=0.95 must reproduce engine.score"
    sens = [{"ticker": ticker, "gate": g, "cutoff": k,
             "episodes_per_day": n_episodes(score_with_gate(det, test, g), k) / days}
            for g in GATES for k in CUTOFFS]
    contam = []
    for c in CONTAMINATIONS:
        d2 = engine.HFTDetector(dict(CFG, CONTAMINATION=c)).fit(train)
        s2 = d2.score(test)
        contam.append({"ticker": ticker, "contamination": c,
                       "model_flag_minutes": int(s2["model_flag"].sum()),
                       "episodes_per_day": n_episodes(s2, 50) / days})

    # 2. ablation on real test data
    real = {"rules_only": flag_episodes(scored.assign(f=scored["rules_fired"] >= 2), "f") / days,
            "forest_only": flag_episodes(scored, "model_flag") / days,
            "combined": n_episodes(scored, 50) / days}

    # 2b. planted-event positive control (engine's own comparison)
    planted = engine.run_method_comparison(bars, CFG)

    # 3. shuffled-data nulls
    nulls = {}
    for block in SHUFFLE_BLOCKS:
        sb = shuffle_bars(bars, block, seed=1000 * block + i)
        _, _, _, ss = prep(sb)
        nulls[block] = rds.episode_rows(ticker, ss)
    return row, sens, contam, real, planted, nulls, rds.episode_rows(ticker, scored)


def comparison_task(args):
    ticker, offline = args
    path = COMP_DIR / f"{ticker}.csv.gz"
    if offline:
        bars = pd.read_csv(path, index_col=0)
        bars.index = pd.to_datetime(bars.index, utc=True).tz_convert(engine.NY)
    else:
        bars = engine.load_yfinance(ticker, CFG["DAYS"])
        bars = bars[bars.index.normalize() >= FIRST_SESSION]
        COMP_DIR.mkdir(exist_ok=True)
        bars.to_csv(path)
    train, test, det, scored = prep(bars)
    return ticker, bars.index.normalize().nunique(), len(bars), rds.episode_rows(ticker, scored)


# ---------------------------------------------------------------- aggregate analyses
def coincident_counts(eps, times):
    """For each (ticker, time) in `times`, the number of OTHER tickers with an episode within 2 min."""
    e_t = eps["start"].to_numpy().astype("datetime64[s]").astype(np.int64)
    e_k = eps["ticker"].to_numpy()
    out = []
    for tk, t in times:
        near = (np.abs(e_t - t) <= rds.CO_WINDOW.total_seconds()) & (e_k != tk)
        out.append(len(set(e_k[near])))
    return np.array(out)


def shift_null(eps, seed=7):
    """Circularly shift each ticker's episodes inside each session; recompute the market-wide share."""
    rng = np.random.default_rng(seed)
    eps = eps.copy()
    eps["day"] = eps["start"].dt.normalize()
    sec = (eps["start"] - eps["day"] - pd.Timedelta(hours=9, minutes=30)).dt.total_seconds().to_numpy()
    base = eps["day"].dt.tz_localize(None).to_numpy().astype("datetime64[s]").astype(np.int64)
    day_len = 390 * 60
    keys = eps[["ticker", "day"]].astype(str).agg("|".join, axis=1).to_numpy()
    shares = []
    for _ in range(N_SHIFT_DRAWS):
        shift = {k: rng.integers(0, day_len) for k in set(keys)}
        new = (sec + np.array([shift[k] for k in keys])) % day_len
        t = base + 34200 + new.astype(np.int64)  # 34200 s = 09:30
        tmp = pd.DataFrame({"ticker": eps["ticker"].to_numpy(), "start": pd.to_datetime(t, unit="s")})
        counts = coincident_counts(tmp, list(zip(tmp["ticker"], t)))
        shares.append(float((counts >= rds.MARKET_WIDE_MIN_TICKERS).mean()))
    return np.array(shares)


def boot_days(per_day, stat, seed=11):
    """95% interval over trading days. `per_day` is a DataFrame indexed by day."""
    rng = np.random.default_rng(seed)
    n = len(per_day)
    vals = [stat(per_day.iloc[rng.integers(0, n, n)]) for _ in range(N_BOOT)]
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def group_summary(eps, n_tickers, label):
    eps = eps.copy()
    eps["day"] = eps["start"].dt.normalize()
    eps = rds.tag_market_wide(eps.sort_values("start").reset_index(drop=True), "start", eps)
    g = eps.groupby("day").agg(n=("ticker", "size"), rev=("reversal_rule", "sum"), mw=("market_wide", "sum"))
    out = {"group": label, "tickers": n_tickers, "episodes": int(len(eps)), "test_days": int(len(g)),
           "episodes_per_stock_day": len(eps) / n_tickers / len(g),
           "reversal_share": float(eps["reversal_rule"].mean()),
           "market_wide_share": float(eps["market_wide"].mean()),
           "stock_specific_reversals_per_stock_day": float((eps["reversal_rule"] & ~eps["market_wide"]).sum()) / n_tickers / len(g)}
    out["episodes_per_stock_day_ci95"] = boot_days(g, lambda d: d["n"].sum() / n_tickers / len(d))
    out["reversal_share_ci95"] = boot_days(g, lambda d: d["rev"].sum() / d["n"].sum())
    out["market_wide_share_ci95"] = boot_days(g, lambda d: d["mw"].sum() / d["n"].sum())
    return out, eps


def pooled_planted(results):
    rows = []
    for name in ["Rules only (2 of 3)", "Isolation Forest only", "Hybrid risk score"]:
        n_ev = tp_ev = n_ep = tp_ep = 0.0
        for planted in results:
            m = next(x for x in planted["methods"] if x["method"] == name)
            n_ev += planted["n_events"]
            tp_ev += m["recall"] * planted["n_events"]
            n_ep += m["alert_episodes"]
            tp_ep += m["precision"] * m["alert_episodes"]
        rows.append({"method": name, "events": int(n_ev), "recall": tp_ev / n_ev,
                     "alert_episodes": int(n_ep), "precision_planted_only": tp_ep / n_ep if n_ep else 0.0})
    return rows


# ---------------------------------------------------------------- main
def main():
    offline = "--offline" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(max_workers=4) as pool:
        main_res = list(pool.map(main_task, [(i, t, True) for i, t in enumerate(rds.TICKERS)]))
        comp_res = list(pool.map(comparison_task, [(t, offline) for t in COMP_TICKERS]))

    summary = {"config": CFG}
    sens = pd.DataFrame([r for res in main_res for r in res[1]])
    contam = pd.DataFrame([r for res in main_res for r in res[2]])
    real = pd.DataFrame([dict(ticker=res[0]["ticker"], **res[3]) for res in main_res])
    sens.groupby(["gate", "cutoff"])["episodes_per_day"].mean().unstack().to_csv(OUT / "sensitivity_gate_cutoff.csv")
    contam.groupby("contamination").agg(model_flag_minutes=("model_flag_minutes", "sum"),
                                        episodes_per_day=("episodes_per_day", "mean")).to_csv(OUT / "sensitivity_contamination.csv")
    real.to_csv(OUT / "ablation_real_per_ticker.csv", index=False)
    summary["sensitivity_gate_cutoff"] = sens.groupby(["gate", "cutoff"])["episodes_per_day"].mean().unstack().round(2).to_dict()
    summary["contamination"] = contam.groupby("contamination").agg(
        model_flag_minutes=("model_flag_minutes", "sum"), episodes_per_day=("episodes_per_day", "mean")).round(3).to_dict("index")
    summary["ablation_real_episodes_per_stock_day"] = real[["rules_only", "forest_only", "combined"]].mean().round(2).to_dict()
    summary["planted_event_control"] = pooled_planted([r[4] for r in main_res])

    # observed group + stock-specific reversal list
    obs = pd.DataFrame([e for r in main_res for e in r[6]])
    summary["observed"], obs_tagged = group_summary(obs, len(rds.TICKERS), "original 20 tickers")
    obs_tagged[obs_tagged["reversal_rule"] & ~obs_tagged["market_wide"]][
        ["ticker", "start", "end", "peak_score", "level", "volume_rule", "flow_rule"]
    ].to_csv(OUT / "stock_specific_reversals.csv", index=False)
    per_day = obs_tagged.groupby(obs_tagged["start"].dt.date).size()
    summary["episodes_by_day"] = {str(k): int(v) for k, v in per_day.items()}

    # shuffled nulls
    for block in SHUFFLE_BLOCKS:
        null = pd.DataFrame([e for r in main_res for e in r[5][block]])
        s, _ = group_summary(null, len(rds.TICKERS), f"shuffled bars, block={block}")
        summary[f"null_shuffle_block_{block}"] = s

    # shifted-time null for the market-wide share
    shares = shift_null(obs)
    summary["market_wide_shift_null"] = {
        "observed_share": summary["observed"]["market_wide_share"],
        "null_mean": float(shares.mean()),
        "null_95_interval": [float(np.percentile(shares, 2.5)), float(np.percentile(shares, 97.5))],
        "draws": N_SHIFT_DRAWS}

    # comparison group
    comp = pd.DataFrame([e for _, _, _, eps in comp_res for e in eps])
    summary["comparison"], comp_tagged = group_summary(comp, len(COMP_TICKERS), "20 lower-volatility large caps")
    summary["comparison"]["sessions_per_ticker"] = sorted({s for _, s, _, _ in comp_res})
    comp_tagged.to_csv(OUT / "comparison_episodes.csv", index=False)

    (OUT / "controls_summary.json").write_text(json.dumps(summary, indent=2, default=str))
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
