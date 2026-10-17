"""Checks on the detection engine, using the built-in synthetic data (no network)."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

import engine as E  # noqa: E402

CFG = dict(E.DEFAULT_CONFIG)


@pytest.fixture(scope="module")
def bars() -> pd.DataFrame:
    return E.make_synthetic()


@pytest.fixture(scope="module")
def scored(bars: pd.DataFrame) -> pd.DataFrame:
    feat = E.build_features(bars, CFG)
    train, _ = E.split_by_session(feat, CFG["TRAIN_FRACTION"])
    return E.HFTDetector(CFG).fit(train).score(feat)


def test_loader_output_is_regular_session_only(bars: pd.DataFrame) -> None:
    times = bars.index.time
    assert min(times) >= pd.Timestamp("09:30").time()
    assert max(times) <= pd.Timestamp("15:59").time()
    assert str(bars.index.tz) == E.NY


def test_features_have_expected_columns_and_ranges(bars: pd.DataFrame) -> None:
    feat = E.build_features(bars, CFG)
    for col in ("volume_z", "reversion", "imbalance", "imbalance_abs", "move_z"):
        assert col in feat
    assert feat["imbalance"].between(-1, 1).all()
    assert feat["reversion"].between(-1, 2).all()
    assert not feat[["volume_z", "reversion", "imbalance"]].isna().any().any()


def test_risk_score_is_bounded_and_levels_partition_minutes(scored: pd.DataFrame) -> None:
    assert scored["risk_score"].between(0, 100).all()
    assert scored["level"].notna().all()
    assert scored["level"].value_counts().sum() == len(scored)
    high = scored[scored["level"] == "High"]
    assert (high["risk_score"] >= CFG["HIGH"]).all()


def test_risk_score_matches_the_published_formula(scored: pd.DataFrame) -> None:
    expected = 100 * (CFG["MODEL_WEIGHT"] * scored["model_strength"] + CFG["RULE_WEIGHT"] * scored["rules_fired"] / 3)
    assert np.allclose(scored["risk_score"], expected)


def test_episodes_merge_nearby_minutes_and_never_span_days(scored: pd.DataFrame) -> None:
    eps = E.episodes(scored, CFG)
    assert eps, "synthetic data should produce at least one alert"
    for ep in eps:
        assert len({t.date() for t in ep.index}) == 1
        assert (ep["risk_score"] >= CFG["ELEVATED"]).all()
    starts = [ep.index[0] for ep in eps]
    assert starts == sorted(starts)


def test_every_alert_text_carries_the_honesty_line(scored: pd.DataFrame) -> None:
    for line in E.latest_alerts(scored, CFG, n=3):
        assert "not proof of manipulation" in line


def test_no_alerts_message_when_nothing_crosses_the_line(scored: pd.DataFrame) -> None:
    quiet = scored.assign(risk_score=0.0)
    assert E.latest_alerts(quiet, CFG) == ["No HFT-like activity flagged in this period."]


def test_planted_events_are_placed_and_the_hybrid_finds_most_of_them(bars: pd.DataFrame) -> None:
    result = E.run_method_comparison(bars, CFG)
    assert result["n_events"] == 40
    names = [m["method"] for m in result["methods"]]
    assert names == ["Rules only (2 of 3)", "Isolation Forest only", "Hybrid risk score"]
    for m in result["methods"]:
        assert 0 <= m["precision"] <= 1 and 0 <= m["recall"] <= 1
    hybrid = result["methods"][2]
    assert hybrid["recall"] >= 0.8
    recalls = [p["recall"] for p in result["sweep"]]
    assert recalls == sorted(recalls, reverse=True), "raising the threshold cannot find more events"


def test_replay_emits_early_warning_then_resolves_it(bars: pd.DataFrame) -> None:
    train, _test, injected, events = E.planted_setup(bars, CFG)
    day = injected.index.normalize().unique()[0]
    day_bars = injected[injected.index.normalize() == day]
    mon = E.run_replay(day_bars, train, CFG, log=lambda *_: None)
    kinds = {e["kind"] for e in mon.events}
    assert "EARLY WARNING" in kinds
    assert kinds & {"CONFIRMED", "CLEARED"}
    warned = [e for e in mon.events if e["kind"] == "EARLY WARNING"]
    resolved = [e for e in mon.events if e["kind"] in ("CONFIRMED", "CLEARED")]
    assert len(resolved) <= len(warned) + 1


def test_csv_without_a_timezone_is_read_as_new_york_time(bars: pd.DataFrame, tmp_path: Path) -> None:
    naive = bars.copy()
    naive.index = naive.index.tz_localize(None)
    naive.index.name = "timestamp"
    path = tmp_path / "ny.csv"
    naive.to_csv(path)
    loaded = E.load_csv(path)
    assert len(loaded) == len(bars), "no minutes should be shifted out of the session"
    assert loaded.index[0] == bars.index[0]


def test_csv_with_missing_columns_names_them(tmp_path: Path) -> None:
    path = tmp_path / "short.csv"
    path.write_text("timestamp,open,close\n2026-08-03 09:30:00,1,1\n")
    with pytest.raises(E.UserError, match="high, low, volume"):
        E.load_csv(path)


def test_csv_row_cap_is_enforced(bars: pd.DataFrame, tmp_path: Path) -> None:
    path = tmp_path / "big.csv"
    bars.rename_axis("timestamp").to_csv(path)
    with pytest.raises(E.UserError, match="more than"):
        E.load_csv(path, max_rows=100)


def test_csv_loader_requires_a_timestamp_column(tmp_path: Path) -> None:
    path = tmp_path / "bad.csv"
    path.write_text("a,open,high,low,close,volume\n1,1,1,1,1,1\n")
    with pytest.raises(ValueError, match="timestamp"):
        E.load_csv(path)
