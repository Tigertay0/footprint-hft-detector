import { h, icon, clear, segmented, prefersReducedMotion } from "../dom.js";
import { api, pollJob } from "../api.js";
import { SessionChart } from "../chart.js";
import { dateLong, etClock, etToDate, plural } from "../format.js";

const MIN_HISTORY_SESSIONS = 3;
const SPEEDS = { slow: 5, normal: 15, fast: 45 }; // minutes of market time per second
const MAX_FRAME_SECONDS = 0.25;                   // a long pause (hidden tab) must not make playback jump
const REPLAY_POLL_MS = 400;
const LIVE_POLL_MS = 5000;
const KIND_LABEL = { "EARLY WARNING": "Early warning", CONFIRMED: "Confirmed", CLEARED: "Cleared", ALERT: "Alert" };
const KIND_CLASS = { "EARLY WARNING": "elevated", CONFIRMED: "high", ALERT: "high", CLEARED: "neutral" };

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function mountReplay(root, ctx) {
  const { store, navigate } = ctx;
  if (!store.scan) {
    root.append(h("section", { class: "scan" }, h("div", { class: "intro" }, h("div", { class: "intro__lead" },
      h("h1", { class: "display", tabindex: "-1" }, "Watch alerts arrive minute by minute."),
      h("p", { class: "lede" }, "Replay needs data to play. Run a scan first, then come back."),
      h("button", { type: "button", class: "btn btn--primary", onClick: () => navigate("scan") }, "Go to Scan")))));
    return () => {};
  }

  const scan = store.scan;
  const sessions = scan.sessions;
  const later = sessions.filter((_, i) => i >= MIN_HISTORY_SESSIONS);
  const testDays = sessions.filter((x) => !x.in_training);
  let renderedMessages = 0;
  let startSeq = 0;
  let starting = false;
  let disposed = false;
  const s = {
    mode: "planted", runMode: null, date: testDays[0]?.date, speed: "normal", market: null,
    job: null, stopPoll: null, bars: null, events: [], total: 0, computed: 0, cursor: 0, planted: [],
    playing: false, pendingPlay: false, result: null, raf: 0, last: 0,
  };
  const liveTicker = () => (scan.source === "market" ? scan.ticker : store.form.ticker);

  // ------------------------------------------------------------ controls
  const modeSeg = segmented({
    label: "Replay type",
    value: s.mode,
    options: [{ value: "planted", label: "Planted events" }, { value: "session", label: "A real session" }, { value: "live", label: "Live now" }],
    onChange: (v) => { cancelStart(); stopAll(); resetStage(); s.mode = v; s.date = pickDate(v); syncControls(); },
  });
  const dateSelect = h("select", { id: "replay-date", onChange: (e) => { s.date = e.target.value; syncControls(); } });
  const dateField = h("div", { class: "field" }, h("label", { for: "replay-date" }, "Session"), dateSelect);
  const startBtn = h("button", { type: "button", class: "btn btn--primary", "aria-describedby": "mode-note", onClick: start }, "Start replay");
  const modeNote = h("p", { id: "mode-note", class: "hint mode-note" });
  const errorSlot = h("div", { class: "notice-slot", role: "alert" });
  const announce = h("p", { class: "sr-only", role: "status" });
  const cursorLive = h("p", { class: "sr-only", role: "status" });

  function pickDate(mode) {
    const pool = mode === "planted" ? testDays : later;
    return pool.some((x) => x.date === s.date) ? s.date : pool[0]?.date;
  }

  function syncControls() {
    const pool = s.mode === "planted" ? testDays : later;
    clear(dateSelect).append(...pool.map((x) => h("option", { value: x.date, selected: x.date === s.date }, dateLong(x.date))));
    dateField.hidden = s.mode === "live";
    const closed = s.mode === "live" && s.market && !s.market.open;
    const blocked = Boolean(closed) || (s.mode !== "live" && !s.date) || starting;
    startBtn.setAttribute("aria-disabled", String(blocked));
    startBtn.classList.toggle("is-disabled", blocked);
    startBtn.textContent = s.mode === "live" ? "Watch live" : "Start replay";
    modeNote.textContent = {
      planted: testDays.length ? "Known momentum-ignition events are planted in a later session, so you can check what the detector catches and what it misses."
        : "This scan has no later sessions to plant events in. Scan a longer window.",
      session: "Plays one of your scanned sessions as if it were happening now. The model only learns from the sessions before it.",
      live: closed ? marketClosedText() : `Trains on the last week, then checks ${liveTicker()} every minute until the market closes.`,
    }[s.mode];
  }

  function marketClosedText() {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    const fmt = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const open = etToDate(get("year"), get("month"), get("day"), 9, 30);
    const close = etToDate(get("year"), get("month"), get("day"), 16, 0);
    return `The US market is closed. It trades 9:30 to 16:00 New York time on weekdays (${fmt(open)} to ${fmt(close)} your time).`;
  }

  // ------------------------------------------------------------ stage
  const chartRoot = h("div", { class: "chart-root" });
  const status = h("p", { class: "hint" });
  const scrub = h("input", { type: "range", min: "0", max: "0", value: "0", step: "1", "aria-label": "Minute of the session",
    onInput: (e) => { pause(); s.cursor = Math.min(Number(e.target.value), s.computed); paint(); } });
  const playBtn = h("button", { type: "button", class: "btn btn--icon", "aria-label": "Play", onClick: togglePlay }, icon("play"));
  const restartBtn = h("button", { type: "button", class: "btn btn--icon", "aria-label": "Restart", onClick: restart }, icon("arrow-counter-clockwise"));
  const stopBtn = h("button", { type: "button", class: "btn btn--quiet", hidden: true, onClick: () => { stopAll(); status.textContent = "Stopped."; announce.textContent = "Stopped watching live."; startBtn.focus(); } }, "Stop");
  const speedSeg = segmented({ label: "Playback speed", value: s.speed,
    options: [{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }], onChange: (v) => { s.speed = v; } });
  const player = h("div", { class: "player" }, playBtn, restartBtn, scrub, speedSeg, stopBtn);
  const feedList = h("ol", { class: "feed__list feed__list--log" });
  const log = h("div", { class: "log", role: "log", "aria-label": "Alert messages", tabindex: "0" }, feedList);
  const summary = h("p", { class: "summary", hidden: true });
  const stage = h("div", { class: "workspace", hidden: true },
    h("div", { class: "workspace__main" }, h("section", { class: "panel", "aria-label": "Replay chart" }, chartRoot, player, status, summary,
      h("p", { class: "legend" },
        h("span", { class: "legend__item" }, "Triangle: a planted event (planted replay only)"),
        h("span", { class: "legend__item" }, "Dashed line: an alert message, labelled by type")))),
    h("div", { class: "workspace__side" }, h("section", { class: "feed", "aria-labelledby": "log-title" },
      h("h2", { id: "log-title", class: "panel__title" }, "Alerts as they arrive"),
      h("p", { class: "hint" }, "An early warning fires at once. Five minutes later it is confirmed or cleared."), log)));

  const chart = new SessionChart(chartRoot, {
    kind: "replay",
    onHover(i, fromPointer) {
      if (i == null || fromPointer || !s.bars) return;
      cursorLive.textContent = `${etClock(s.bars.open_ms, s.bars.m[i])} ET. Price ${s.bars.c[i].toFixed(2)}. Volume ${s.bars.v[i].toLocaleString()}.`;
    },
  });

  root.append(h("section", { class: "scan" },
    h("div", { class: "verdict" }, h("h1", { class: "display", tabindex: "-1" }, "Watch alerts arrive minute by minute."),
      h("p", { class: "lede" }, "Replay one session as if it were happening now, or follow the live market.")),
    h("form", { class: "controls", onSubmit: (e) => e.preventDefault(), "aria-label": "Replay settings" },
      h("div", { class: "field" }, h("span", { class: "field__label" }, "Replay"), modeSeg), dateField, startBtn),
    modeNote, errorSlot, announce, cursorLive, stage));

  // ------------------------------------------------------------ job handling
  function cancelStart() {
    startSeq += 1;
    starting = false;
  }

  async function start() {
    if (starting || startBtn.getAttribute("aria-disabled") === "true") return;
    stopAll();
    errorSlot.replaceChildren();
    const mode = s.mode;
    const mine = ++startSeq;
    starting = true;
    syncControls();
    if (mode === "live") {
      resetStage();
      stage.hidden = false;
      status.textContent = `Training on recent ${liveTicker()} sessions. This takes a few seconds.`;
    }
    try {
      const { job_id: id } = mode === "live"
        ? await api.startLive({ ticker: liveTicker(), sensitivity: scan.sensitivity })
        : await api.startReplay({ scan_id: scan.id, mode, date: s.date });
      if (disposed || mine !== startSeq) {
        api.stopJob(id); // the page moved on while the server was starting this job
        return;
      }
      Object.assign(s, { job: id, runMode: mode, bars: null, events: [], total: 0, computed: 0, cursor: 0, planted: [], result: null });
      stage.hidden = false;
      summary.hidden = true;
      clear(feedList);
      renderedMessages = 0;
      stopBtn.hidden = mode !== "live";
      scrub.hidden = mode === "live";
      s.stopPoll = pollJob(id, onUpdate, { intervalMs: mode === "live" ? LIVE_POLL_MS : REPLAY_POLL_MS });
      announce.textContent = mode === "live" ? "Watching live." : "Replay started.";
      s.pendingPlay = mode !== "live"; // playback begins when the first bars arrive
    } catch (error) {
      if (disposed || mine !== startSeq) return;
      showError(error.message);
      stage.hidden = mode === "live";
    } finally {
      if (mine === startSeq) {
        starting = false;
        syncControls();
      }
    }
  }

  function onUpdate(p) {
    if (disposed) return;
    if (p.status === "error") {
      stopAll();
      showError(p.error);
      return;
    }
    if (p.bars) s.bars = p.bars;
    s.events.push(...p.events);
    if (s.pendingPlay && s.bars) {
      s.pendingPlay = false;
      play();
    }
    s.computed = p.progress.step ?? s.computed;
    s.total = p.progress.total ?? s.bars?.m.length ?? 0;
    s.planted = p.progress.planted_m ?? s.planted;
    if (p.status === "done") s.result = p.result;
    if (s.runMode === "live") {
      s.cursor = s.bars?.m.length ?? 0;
      if (p.status !== "running") {
        stopBtn.hidden = true;
        status.textContent = "The session ended. The market closed or live watching timed out.";
        announce.textContent = "Live session ended.";
      }
      s.feedState = { feedError: p.progress.feed_error, noData: p.progress.no_data };
    }
    scrub.max = String(s.total);
    paint();
  }

  function showError(message) {
    errorSlot.replaceChildren(h("div", { class: "notice", tabindex: "-1" }, h("p", { class: "notice__text" }, message)));
    errorSlot.querySelector(".notice").focus();
  }

  function stopAll() {
    pause();
    s.stopPoll?.();
    s.stopPoll = null;
    if (s.job) api.stopJob(s.job);
    s.job = null;
    stopBtn.hidden = true;
  }

  function resetStage() {
    Object.assign(s, { runMode: null, bars: null, events: [], total: 0, computed: 0, cursor: 0, planted: [], result: null });
    clear(feedList);
    renderedMessages = 0;
    summary.hidden = true;
    stage.hidden = true;
    errorSlot.replaceChildren();
  }

  // ------------------------------------------------------------ playback
  function play() {
    if (s.runMode === "live" || !s.bars) return;
    cancelAnimationFrame(s.raf);
    if (s.cursor >= s.total && s.total) s.cursor = 0;
    s.playing = true;
    s.last = performance.now();
    s.raf = requestAnimationFrame(frame);
    syncPlayButton();
  }

  function pause() {
    s.playing = false;
    s.pendingPlay = false;
    cancelAnimationFrame(s.raf);
    syncPlayButton();
  }

  function togglePlay() {
    if (s.playing) {
      pause();
      announce.textContent = "Paused.";
    } else {
      play();
    }
  }

  function restart() {
    s.cursor = 0;
    paint();
    play();
  }

  function frame(now) {
    if (!s.playing) return;
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - s.last) / 1000));
    s.last = now;
    const target = prefersReducedMotion() ? s.computed : s.cursor + dt * SPEEDS[s.speed];
    s.cursor = Math.min(target, s.computed);
    paint();
    if (s.total && s.cursor >= s.total) {
      pause();
      announce.textContent = summary.hidden ? "Replay finished." : `Replay finished. ${summary.textContent}`;
      return;
    }
    s.raf = requestAnimationFrame(frame);
  }

  function syncPlayButton() {
    playBtn.setAttribute("aria-label", s.playing ? "Pause" : "Play");
    clear(playBtn).append(icon(s.playing ? "pause" : "play"));
  }

  // ------------------------------------------------------------ painting
  function paint() {
    if (!s.bars) return;
    const live = s.runMode === "live";
    const shown = live ? s.bars.m.length : Math.max(0, Math.floor(s.cursor));
    const visible = s.events.filter((e) => live || e.step <= shown);
    chart.update({ session: s.bars, reveal: shown, markers: visible, planted: s.planted, episodes: [], settings: scan.settings, selectedId: null });
    chart.setLabel(`Replay of ${live ? "today" : dateLong(s.date)}. ${plural(visible.length, "alert message")} so far. Arrow keys read each minute.`);
    scrub.value = String(shown);
    const at = shown > 0 ? etClock(s.bars.open_ms, s.bars.m[Math.min(shown, s.bars.m.length) - 1]) : "9:30";
    scrub.setAttribute("aria-valuetext", `Minute ${shown}, ${at} ET`);
    const waiting = s.playing && s.cursor >= s.computed && s.computed < s.total;
    if (live) {
      const note = s.feedState?.noData ? " No data has arrived yet. The market may be on a holiday."
        : s.feedState?.feedError ? " The data feed is having trouble. Retrying." : "";
      status.textContent = `Live ${liveTicker()}: ${s.bars.m.length} minutes so far, latest ${at} ET. Checking again every minute.${note}`;
    } else {
      status.textContent = `Minute ${shown} of ${s.total}, ${at} ET${waiting ? ". Computing the next minutes." : ""}`;
    }
    paintFeed(visible);
    paintSummary(shown);
  }

  function messageItem(e) {
    const cls = KIND_CLASS[e.kind] ?? "neutral";
    return h("li", { class: `msg msg--${cls}` },
      h("div", { class: "msg__head" }, h("span", { class: `pill pill--${cls}` }, KIND_LABEL[e.kind] ?? e.kind),
        h("span", { class: "msg__time" }, `${etClock(s.bars.open_ms, e.sent_m)} ET, about ${etClock(s.bars.open_ms, e.about_m)}`)),
      h("p", { class: "msg__text" }, upper(e.text)));
  }

  // Only new messages are added, so earlier ones do not replay their entrance.
  function paintFeed(visible) {
    if (visible.length < renderedMessages) {
      clear(feedList);
      renderedMessages = 0;
    }
    if (visible.length === 0) {
      if (!feedList.firstChild) feedList.append(h("li", { class: "feed__empty" }, "No messages yet."));
      return;
    }
    if (renderedMessages === 0) clear(feedList);
    for (let i = renderedMessages; i < visible.length; i++) feedList.prepend(messageItem(visible[i]));
    renderedMessages = visible.length;
  }

  function paintSummary(shown) {
    const planted = s.result?.planted;
    summary.hidden = !(planted && shown >= s.total);
    if (summary.hidden) return;
    const early = planted.filter((p) => p.early);
    const confirmed = planted.filter((p) => p.confirmed);
    const delays = early.map((p) => p.early_delay).sort((a, b) => a - b);
    const median = delays.length ? delays[Math.floor(delays.length / 2)] : null;
    summary.textContent = `${plural(planted.length, "event")} ${planted.length === 1 ? "was" : "were"} planted this day. ${early.length} got an early warning`
      + `${median == null ? "" : ` (median ${median} min after the push began)`}, and ${confirmed.length} were confirmed.`;
  }

  // ------------------------------------------------------------ mount
  api.market().then((m) => { s.market = m; syncControls(); }).catch(() => { syncControls(); });
  syncControls();
  return () => {
    disposed = true;
    cancelStart();
    stopAll();
    chart.destroy();
  };
}
