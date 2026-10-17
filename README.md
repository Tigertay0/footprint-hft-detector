# Footprint: HFT footprint detector

A browser interface for the model in `HFT_Footprint_Detector.ipynb`. The detection code is the notebook's own, moved into [server/engine.py](server/engine.py). The interface explains each flag in plain English, so people who did not write the model can use and read it.

## Run it

Windows: double-click [run.bat](run.bat). The first run sets up a private Python environment (about 2 minutes), then opens http://127.0.0.1:8000.

Any system:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt      # Windows: .venv\Scripts\pip
.venv/bin/python -m uvicorn main:app --app-dir server --port 8000
```

Needs Python 3.10 or newer. Keep the project in a short folder path on Windows (deep folders can break Python's file access).

## What each tab does

| Tab | Notebook section | What it shows |
|---|---|---|
| Scan | 1 to 6 | Loads one-minute bars, trains the model, flags minutes. A headline sentence, a strip of sessions, an annotated chart (price, volume, risk score) and a ranked alert list. Click an alert to zoom the chart and see why it scored what it did. |
| Replay | 10 | Plays one session minute by minute with early warnings, then confirmed or cleared messages. Planted events (known answers), a real session from your scan, or the live market while it is open. |
| Alerts | 10 | The history saved by the always-on watcher (below), with its running status. |
| Accuracy | 7 | Plants known momentum-ignition events in the later sessions and compares rules only, Isolation Forest only and the hybrid score, plus the threshold trade-off. Optional live-alert test (about 2 minutes). |
| Guide | 3, 4, 9 | The three signals, the score formula, early warning versus confirmed, and the limitations. |

Data sources: Market data (Yahoo Finance, about 29 days of one-minute bars), Sample data (the notebook's synthetic generator), or an uploaded CSV with columns `timestamp, open, high, low, close, volume`.

The alert level (Strict, Balanced, Sensitive) only moves the Elevated and High lines (60/80, 50/70, 40/60). Balanced is the notebook's setting. Scores do not change.

## What changed from the notebook

The detection logic is untouched. These are the differences:

- No matplotlib. The page draws the charts.
- Every function takes its settings as an argument instead of reading a global `CONFIG`, so each request can use its own thresholds.
- The CSV loader accepts an uploaded file, and replay results come back as data instead of printed text.
- `replay_evaluation` and the method comparison return numbers for the page instead of printing.
- The Alpaca loader is kept in `engine.py` but is not connected to the interface (it would need API keys typed into a web page).

## Layout

```
server/engine.py     the notebook's model, features, score, alerts, evaluation and live monitor
server/analysis.py   reshapes results into JSON for the page
server/jobs.py       background jobs: replay, accuracy test, live monitoring
server/main.py       FastAPI app and API routes, serves web/
server/watcher.py    always-on watcher: watchlist, market hours, notifications
server/notify.py     ntfy sender (retries, never logs the topic)
server/store.py      alert history and watcher heartbeat (SQLite)
install-watcher.ps1  one-time setup on the NUC (topic, test message, startup task)
web/                 the interface (plain HTML, CSS and JavaScript, no build step)
tests/               pytest for the server, node --test for the text helpers
design-system.md     colors, type, spacing, motion and the reasons for them
```

## Always-on alerts on a Windows PC (a NUC)

The watcher follows your tickers during US market hours and sends a phone notification through [ntfy](https://ntfy.sh) the minute the model flags one. It uses the notebook's live monitor, so you get:

| What | When | How it shows up |
|---|---|---|
| Early warning | the minute it looks wrong (within about 20 seconds of Yahoo publishing the bar) | high priority |
| Confirmed | about 5 minutes later, if the push reversed | urgent priority |
| Cleared | about 5 minutes later, if the move held | silent (set `notify_cleared` to false to save it without notifying) |

Set up (about 10 minutes):

1. Copy this folder to the NUC, somewhere short such as `C:\hft-detector`. Leave out `.venv`.
2. Install Python 3.10 or newer on the NUC (tick "Add python.exe to PATH").
3. Open `watcher.json` and list your tickers (up to 25).
4. Right-click `install-watcher.ps1`, choose Run with PowerShell, and accept the administrator prompt. It sets up Python, saves your private topic in `watcher.env`, sends a test notification, and registers a startup task that restarts the watcher if it stops.
5. On your phone, install the free ntfy app and subscribe to the topic the script shows. In the app, let the urgent channel override Do Not Disturb if you want confirmed alerts at night.

The market runs 9:30 to 16:00 New York time, which is 19:00 to 01:30 in India until early November, then 20:00 to 02:30. The watcher sleeps outside those hours and on US market holidays, trains on each ticker's last sessions at 9:15 New York time, and saves every alert to `data/alerts.db` (shown in the Alerts tab).

Check on it: `data\logs\watcher.log`, or run `run.bat` and open the Alerts tab. Stop it with `Stop-ScheduledTask -TaskName FootprintWatcher`. To try it first without a phone, run `.venv\Scripts\python server\watcher.py --dry-run`.

### An old Surface (or any old Windows tablet or laptop)

The same steps work. The installer now checks the PC first and stops with a plain message if it cannot run the watcher. It needs:

- 64-bit Windows 10 or newer. A Surface stuck on Windows 8.1 or older cannot run it.
- Not Windows S mode (some Surface Go and Laptop Go models ship in it). Switching out is free and permanent: Settings, Update and Security, Activation.
- About 4 GB of memory (with less, keep the watchlist to about 5 tickers) and 2 GB of free disk.
- An Intel or AMD chip. ARM Surfaces (Surface Pro X, Surface RT) are untested, and some Python packages may not install.

On an old PC the first install can take up to 10 minutes, and each morning's training takes longer per ticker. Keep the PC plugged in. The watcher asks Windows not to sleep while it runs, but a flat battery still ends it, and a battery that sits at 100% for months can wear out, so use a charge limit if the maker offers one.

Running the NUC and a Surface at the same time: if both use the same topic, every alert arrives twice, once from each. To avoid that, give each PC different tickers in its own `watcher.json`, or run just one. A "backup that stays silent until the other one stops" mode is not built yet.

What to expect:

- Early warnings are noisy. In the notebook's planted-event test only 57% of early warnings were real, against 91% of confirmed alerts. `max_alerts_per_hour` (default 20) stops a burst from flooding the phone, and held-back alerts stay in the history.
- The watcher tells you when it cannot reach Yahoo (after 5 failed checks in a row), when it recovers, and when a ticker has no data. A silent phone then does not mean a quiet market.
- Windows must not sleep. The installer offers to turn sleep off while plugged in.
- It depends on Yahoo's unofficial one-minute feed, fetched in one request per check. If Yahoo throttles it, the watcher says so.
- The web app on the same PC is optional. To open it from another device, set `HOST=0.0.0.0` and `FOOTPRINT_ALLOWED_HOSTS=<the NUC's name or address>` before `run.bat`, allow the port in the firewall, and keep it on your home network only. It has no sign-in.

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests -q
node --test tests/format.test.js
```

## Sharing it

It runs on any host that can run Python, with `python -m uvicorn main:app --app-dir server --host 0.0.0.0 --port $PORT` as the start command. Set `FOOTPRINT_ALLOWED_HOSTS` to your domain (comma-separated for several), because the app refuses requests for any other host name.

Already in place: a strict content security policy, same-origin-only writes, a 25 MB upload cap with a row limit, per-client rate limits, at most two scans at once, four jobs in total (two per client, one live session), and live sessions that stop when the page is closed.

Not in place, so decide before making it public: there is no sign-in and no per-visitor ownership of scans and jobs (ids are long and random, but anyone holding one can read it), and the rate limit keys on the connecting address, which is a shared proxy address on most hosts. Run `pip-audit` on the installed packages before deploying.

## Credits

- Font: [Schibsted Grotesk](https://fontesk.com/schibsted-grotesk-typeface/), SIL Open Font License (copy in `web/fonts/schibsted-grotesk/OFL.txt`).
- Icons: [Phosphor Icons](https://phosphoricons.com), MIT.
- Segmented control mechanism adapted from [kuratlielia on 21st.dev](https://21st.dev/@kuratlielia/components/segmented-control).

Footprint is a research tool for studying trading patterns. It is not investment advice, and a flag is a warning sign, not proof of manipulation.
