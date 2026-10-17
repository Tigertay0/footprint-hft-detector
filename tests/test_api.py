"""API checks. Uses the sample data source so nothing here needs the network."""
import io
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

import analysis as A  # noqa: E402
import engine as E  # noqa: E402
import jobs as J  # noqa: E402
import main  # noqa: E402
from errors import UserError  # noqa: E402


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(main.app)


@pytest.fixture(scope="module")
def scan(client: TestClient) -> dict:
    res = client.post("/api/scan", data={"source": "sample", "sensitivity": "balanced"})
    assert res.status_code == 200, res.text
    return res.json()


def test_scan_shape_is_consistent(scan: dict) -> None:
    assert scan["summary"]["sessions"] == len(scan["sessions"])
    assert scan["summary"]["episodes"] == len(scan["episodes"])
    for s in scan["sessions"]:
        n = len(s["m"])
        assert all(len(s[k]) == n for k in ("o", "h", "l", "c", "v", "vz", "rev", "imb", "risk", "lvl", "flags"))
    assert scan["settings"]["elevated"] == 50 and scan["settings"]["high"] == 70


def test_scan_json_has_no_nan(scan: dict) -> None:
    json.dumps(scan, allow_nan=False)


def test_training_sessions_are_the_first_sixty_percent(scan: dict) -> None:
    flags = [s["in_training"] for s in scan["sessions"]]
    assert flags == sorted(flags, reverse=True)
    assert scan["summary"]["training_sessions"] == sum(flags)


def test_sensitivity_changes_thresholds_not_scores(client: TestClient) -> None:
    strict = client.post("/api/scan", data={"source": "sample", "sensitivity": "strict"}).json()
    sensitive = client.post("/api/scan", data={"source": "sample", "sensitivity": "sensitive"}).json()
    assert strict["settings"]["elevated"] > sensitive["settings"]["elevated"]
    assert strict["summary"]["episodes"] <= sensitive["summary"]["episodes"]
    assert strict["sessions"][-1]["risk"] == sensitive["sessions"][-1]["risk"]


def test_bad_ticker_is_rejected_before_any_download(client: TestClient) -> None:
    res = client.post("/api/scan", data={"source": "market", "ticker": "TS LA; DROP"})
    assert res.status_code == 422


def test_csv_upload_round_trip(client: TestClient) -> None:
    bars = E.make_synthetic(days=8, seed=3)
    out = bars.copy()
    out.index = out.index.tz_convert("UTC")
    out.index.name = "timestamp"
    res = client.post("/api/scan", data={"source": "csv"}, files={"file": ("bars.csv", out.to_csv().encode(), "text/csv")})
    assert res.status_code == 200, res.text
    assert res.json()["ticker"] == "bars.csv"


def test_csv_without_file_or_with_garbage_gives_a_plain_message(client: TestClient) -> None:
    assert client.post("/api/scan", data={"source": "csv"}).status_code == 422
    res = client.post("/api/scan", data={"source": "csv"}, files={"file": ("x.csv", b"hello,world\n1,2\n", "text/csv")})
    assert res.status_code == 422
    assert "timestamp" in res.json()["detail"]


def test_too_few_sessions_is_explained(client: TestClient) -> None:
    out = E.make_synthetic(days=3).copy()
    out.index = out.index.tz_convert("UTC")
    out.index.name = "timestamp"
    res = client.post("/api/scan", data={"source": "csv"}, files={"file": ("few.csv", out.to_csv().encode(), "text/csv")})
    assert res.status_code == 422 and "sessions" in res.json()["detail"]


def test_kept_sessions_are_long_enough_for_the_planted_event_test() -> None:
    bars = E.make_synthetic(days=10)
    cfg = A.make_cfg("balanced", "x", 29, "synthetic")
    shortest = bars.groupby(bars.index.normalize()).head(A.MIN_BARS_PER_SESSION)
    scan = A.run_scan(shortest, cfg, "x", "sample", "balanced")
    assert E.planted_setup(scan.bars, cfg)[3], "events can be planted in the shortest session that is kept"
    with pytest.raises(UserError):                                      # one bar fewer: left out, not a crash later
        A.run_scan(bars.groupby(bars.index.normalize()).head(A.MIN_BARS_PER_SESSION - 1), cfg, "x", "sample", "balanced")


def _wait(client: TestClient, job_id: str, timeout: float = 120) -> dict:
    end = time.time() + timeout
    while time.time() < end:
        payload = client.get(f"/api/jobs/{job_id}").json()
        if payload["status"] != "running":
            return payload
        time.sleep(0.3)
    raise AssertionError("job did not finish")


def test_planted_replay_job_streams_events_and_reports_outcome(client: TestClient, scan: dict) -> None:
    job_id = client.post("/api/replay", json={"scan_id": scan["id"], "mode": "planted"}).json()["job_id"]
    done = _wait(client, job_id)
    assert done["status"] == "done"
    assert done["progress"]["step"] == done["progress"]["total"]
    assert done["bars"]["m"] and done["events"]
    assert done["result"]["planted"], "planted replay reports what happened to each planted event"
    later = client.get(f"/api/jobs/{job_id}?since={done['next']}").json()
    assert later["events"] == []


def test_replay_of_an_early_session_explains_why_not(client: TestClient, scan: dict) -> None:
    job_id = client.post("/api/replay", json={"scan_id": scan["id"], "mode": "session", "date": scan["sessions"][1]["date"]}).json()["job_id"]
    done = _wait(client, job_id)
    assert done["status"] == "error" and "earlier sessions" in done["error"]


def test_accuracy_job_returns_methods_and_sweep(client: TestClient, scan: dict) -> None:
    job_id = client.post("/api/evaluate", json={"scan_id": scan["id"], "include_live": False}).json()["job_id"]
    done = _wait(client, job_id)
    assert done["status"] == "done"
    assert len(done["result"]["methods"]) == 3 and done["result"]["sweep"]


def test_unknown_scan_and_job_are_404(client: TestClient) -> None:
    assert client.post("/api/replay", json={"scan_id": "a" * 22, "mode": "planted"}).status_code == 404
    assert client.get("/api/jobs/nope").status_code == 404


def test_live_is_refused_when_market_is_closed(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(E, "market_is_open", lambda: False)
    assert client.post("/api/live", json={"ticker": "TSLA"}).status_code == 409


def test_cross_site_writes_are_refused(client: TestClient) -> None:
    res = client.post("/api/scan", data={"source": "sample"}, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    assert res.headers["x-frame-options"] == "DENY"


def test_oversized_upload_is_refused_before_parsing(client: TestClient) -> None:
    res = client.post("/api/scan", data={"source": "csv"}, headers={"Content-Length": str(40 * 1024 * 1024)})
    assert res.status_code == 413
    assert res.headers["x-content-type-options"] == "nosniff", "refusals carry the security headers too"


def test_a_chunked_upload_cannot_slip_past_the_size_cap(client: TestClient) -> None:
    chunk = b" " * (1024 * 1024)

    def body():                                                         # no Content-Length: sent chunked
        for _ in range(main.MAX_BODY_BYTES // len(chunk) + 2):
            yield chunk

    res = client.post("/api/replay", content=body(), headers={"Content-Type": "application/json"})
    assert res.status_code == 413 and "25 MB" in res.json()["detail"]


def test_rate_limit_entries_for_departed_clients_are_dropped() -> None:
    main._post_times.clear()
    main._post_times[("10.0.0.9", "write")].append(time.time() - 120)
    main._limit(SimpleNamespace(client=SimpleNamespace(host="10.0.0.1")))  # type: ignore[arg-type]
    assert list(main._post_times) == [("10.0.0.1", "write")]
    main._post_times.clear()


def test_ids_and_dates_are_validated(client: TestClient) -> None:
    assert client.post("/api/replay", json={"scan_id": "x", "mode": "planted"}).status_code == 422
    good = "a" * 22
    assert client.post("/api/replay", json={"scan_id": good, "mode": "session", "date": "not-a-date"}).status_code == 422


def test_unknown_host_header_is_refused(client: TestClient) -> None:
    assert client.get("/api/market", headers={"Host": "evil.example"}).status_code == 400


def test_job_events_are_never_skipped_between_polls(client: TestClient, scan: dict) -> None:
    job_id = client.post("/api/replay", json={"scan_id": scan["id"], "mode": "planted"}).json()["job_id"]
    seen, since = [], 0
    for _ in range(600):
        payload = client.get(f"/api/jobs/{job_id}?since={since}").json()
        seen.extend(payload["events"])
        since = payload["next"]
        if payload["status"] != "running":
            payload = client.get(f"/api/jobs/{job_id}?since={since}").json()
            seen.extend(payload["events"])
            break
        time.sleep(0.1)
    final = client.get(f"/api/jobs/{job_id}").json()
    assert len(seen) == len(final["events"])


def test_stopping_a_job_marks_it_stopped(client: TestClient, scan: dict) -> None:
    job_id = client.post("/api/replay", json={"scan_id": scan["id"], "mode": "planted"}).json()["job_id"]
    client.delete(f"/api/jobs/{job_id}")
    assert _wait(client, job_id)["status"] == "stopped"


def test_a_second_live_session_is_refused() -> None:
    store = J.JobStore()
    gate = {"go": False}

    def hold(job: J.Job) -> None:
        while not gate["go"]:
            time.sleep(0.01)

    store.start("live", hold, owner="a")
    with pytest.raises(J.TooBusy):
        store.start("live", hold, owner="b")
    gate["go"] = True


def test_per_client_job_cap() -> None:
    store = J.JobStore()
    gate = {"go": False}

    def hold(job: J.Job) -> None:
        while not gate["go"]:
            time.sleep(0.01)

    store.start("replay", hold, owner="a")
    store.start("replay", hold, owner="a")
    with pytest.raises(J.TooBusy):
        store.start("replay", hold, owner="a")
    store.start("replay", hold, owner="b")
    gate["go"] = True


def test_security_headers_are_present(client: TestClient) -> None:
    res = client.get("/")
    assert "default-src 'self'" in res.headers["content-security-policy"]
    assert "unsafe-inline" not in res.headers["content-security-policy"]
    assert res.headers["x-content-type-options"] == "nosniff"
    assert client.get("/api/market").headers["cache-control"] == "no-store"


def test_live_monitor_job_with_a_simulated_feed() -> None:
    """The real feed needs an open market, so feed it a synthetic session minute by minute."""
    cfg = A.make_cfg("balanced", "TEST", 7, "yfinance")
    history = E.make_synthetic(days=6, seed=2)
    train, _test, injected, _events = E.planted_setup(E.make_synthetic(), cfg)
    day = injected[injected.index.normalize() == injected.index.normalize().unique()[0]]
    calls = {"n": 0}

    def feed_factory(_ticker: str):
        def fetch() -> pd.DataFrame:
            calls["n"] += 1
            return day.iloc[: 100 + calls["n"] * 40]
        return fetch

    job = J.Job(id="t", kind="live")
    J.live_job(job, "TEST", cfg, fetch_factory=feed_factory, history_loader=lambda _t, _d: history,
               poll_seconds=0, is_open=lambda: calls["n"] < 6)
    assert job.bars and len(job.bars["m"]) > 100
    assert job.progress["step"] == 6
    assert any(e["kind"] == "EARLY WARNING" for e in job.events)


def test_live_job_stops_when_nobody_is_polling_it() -> None:
    cfg = A.make_cfg("balanced", "TEST", 7, "yfinance")
    history = E.make_synthetic(days=6, seed=2)
    job = J.Job(id="t", kind="live")
    job.last_poll = time.time() - 1000
    J.live_job(job, "TEST", cfg, fetch_factory=lambda _t: (lambda: None), history_loader=lambda _t, _d: history,
               poll_seconds=0, is_open=lambda: True, idle_seconds=60)
    assert job.progress["step"] == 0


def test_live_job_survives_a_few_feed_failures_and_flags_empty_feeds() -> None:
    cfg = A.make_cfg("balanced", "TEST", 7, "yfinance")
    history = E.make_synthetic(days=6, seed=2)
    calls = {"n": 0}

    def feed_factory(_t: str):
        def fetch():
            calls["n"] += 1
            if calls["n"] == 2:
                raise ConnectionError("blip")
            return None
        return fetch

    job = J.Job(id="t", kind="live")
    J.live_job(job, "TEST", cfg, fetch_factory=feed_factory, history_loader=lambda _t, _d: history,
               poll_seconds=0, is_open=lambda: calls["n"] < 5)
    assert job.progress["step"] == 5
    assert job.progress["no_data"] is True
