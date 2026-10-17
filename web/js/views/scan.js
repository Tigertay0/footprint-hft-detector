import { h, clear, segmented } from "../dom.js";
import { api } from "../api.js";
import { verdict, episodeHeadline, etClock } from "../format.js";
import { sessionStrip, chartPanel, alertFeed, zoomWindow } from "./scan-parts.js";

const TICKER_PATTERN = /^[A-Za-z0-9^][A-Za-z0-9.\-=]{0,11}$/;
const TICKER_RULE = "Use 1 to 12 letters or digits, starting with a letter or digit. . - ^ = are allowed after that.";
const WINDOWS = [{ value: "14", label: "2 weeks" }, { value: "29", label: "4 weeks" }];
const SOURCES = [
  { value: "market", label: "Market data" },
  { value: "sample", label: "Sample data" },
  { value: "csv", label: "Upload CSV" },
];
const CSV_HINT = "One-minute bars with columns timestamp, open, high, low, close, volume. Times without a timezone are read as New York time.";

export function mountScan(root, ctx) {
  const { store } = ctx;
  const form = store.form;
  const out = h("div", { class: "scan__out" });
  const status = h("p", { class: "sr-only", role: "status" });
  const noticeSlot = h("div", { class: "notice-slot", role: "alert" });
  let panel = null;
  let strip = null;
  let feed = null;
  let showAll = false;
  let busy = false;
  let disposed = false;
  let seq = 0;

  // ------------------------------------------------------------ control bar
  const tickerInput = h("input", {
    id: "ticker", name: "ticker", type: "text", value: form.ticker, autocomplete: "off", autocapitalize: "characters",
    spellcheck: "false", maxlength: "12", "aria-describedby": "ticker-error",
  });
  const tickerError = h("p", { id: "ticker-error", class: "field__error" });
  const daysSelect = h("select", { id: "days", name: "days" },
    WINDOWS.map((w) => h("option", { value: w.value, selected: w.value === form.days }, w.label)));
  const fileInput = h("input", { id: "csv", type: "file", accept: ".csv,text/csv", "aria-describedby": "csv-hint csv-error" });
  const fileHint = h("p", { id: "csv-hint", class: "hint" }, form.file ? `Using ${form.file.name}. Choose another file to replace it.` : CSV_HINT);
  const fileError = h("p", { id: "csv-error", class: "field__error" });
  const submit = h("button", { type: "submit", class: "btn btn--primary" }, "Scan");
  const source = segmented({ label: "Data source", options: SOURCES, value: form.source, onChange: (v) => { form.source = v; syncFields(); } });

  const tickerField = h("div", { class: "field field--ticker" }, h("label", { for: "ticker" }, "Ticker"), tickerInput, tickerError);
  const daysField = h("div", { class: "field" }, h("label", { for: "days" }, "Window"), daysSelect);
  const fileField = h("div", { class: "field field--file" }, h("label", { for: "csv" }, "CSV file"), fileInput, fileHint, fileError);
  const bar = h("form", { class: "controls", novalidate: true, "aria-label": "Scan settings" },
    tickerField, h("div", { class: "field" }, h("span", { class: "field__label" }, "Data"), source), daysField, fileField, submit);

  function syncFields() {
    tickerField.hidden = form.source !== "market";
    daysField.hidden = form.source !== "market";
    fileField.hidden = form.source !== "csv";
  }

  function validate() {
    tickerError.textContent = "";
    fileError.textContent = "";
    tickerInput.removeAttribute("aria-invalid");
    fileInput.removeAttribute("aria-invalid");
    if (form.source === "market" && !TICKER_PATTERN.test(form.ticker)) {
      tickerError.textContent = `Enter a ticker such as TSLA or AAPL. ${TICKER_RULE}`;
      tickerInput.setAttribute("aria-invalid", "true");
      return tickerInput;
    }
    if (form.source === "csv" && !form.file) {
      fileError.textContent = "Choose a CSV file first.";
      fileInput.setAttribute("aria-invalid", "true");
      return fileInput;
    }
    return null;
  }

  tickerInput.addEventListener("input", () => {
    form.ticker = tickerInput.value.trim().toUpperCase();
    if (tickerError.textContent && TICKER_PATTERN.test(form.ticker)) validate();
  });
  tickerInput.addEventListener("blur", () => { tickerInput.value = form.ticker; });
  daysSelect.addEventListener("change", () => { form.days = daysSelect.value; });
  fileInput.addEventListener("change", () => {
    form.file = fileInput.files[0] ?? null;
    fileHint.textContent = form.file ? `Using ${form.file.name}.` : CSV_HINT;
    validate();
  });
  bar.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const invalid = validate();
    if (invalid) {
      invalid.focus();
      return;
    }
    runScan({ source: form.source, ticker: form.ticker, days: form.days, file: form.file }, form.sensitivity, false);
  });

  // ------------------------------------------------------------ running a scan
  async function runScan(request, sensitivity, rescan) {
    if (busy) return;
    busy = true;
    const mine = ++seq;
    submit.setAttribute("aria-disabled", "true");
    noticeSlot.replaceChildren();
    const label = request.source === "market" ? request.ticker : request.source === "sample" ? "sample data" : "your file";
    status.textContent = `Scanning ${label}. This takes about 10 seconds.`;
    if (rescan) {
      out.classList.add("is-busy");
      out.setAttribute("aria-busy", "true");
    } else {
      renderLoading();
    }
    const data = new FormData();
    data.set("source", request.source);
    data.set("ticker", request.ticker);
    data.set("days", request.days);
    data.set("sensitivity", sensitivity);
    if (request.source === "csv" && request.file) data.set("file", request.file);
    try {
      const scan = await api.scan(data);
      if (disposed || mine !== seq) return;
      const scored = scan.sessions.filter((s) => s.peak_score != null);
      const best = scored.reduce((a, b) => (b.peak_score > a.peak_score ? b : a), scored[0] ?? scan.sessions[0]);
      const keepDay = rescan && scan.sessions.some((s) => s.date === store.selectedDate);
      store.scan = scan;
      store.lastRequest = request;
      form.sensitivity = sensitivity;
      store.selectedDate = keepDay ? store.selectedDate : best.date;
      store.selectedEpisode = null;
      showAll = false;
      renderResults();
      status.textContent = rescan ? `Alert level ${sensitivity}. ${verdict(scan).headline}` : verdict(scan).headline;
      if (rescan) out.querySelector(".feed .seg__btn[aria-pressed='true']")?.focus({ preventScroll: true });
      else out.querySelector("h1")?.focus({ preventScroll: true });
    } catch (error) {
      if (disposed || mine !== seq) return;
      showNotice(error.message, request.source === "market");
      if (rescan) resetFeed();              // the alert-level control already moved, so put it back
      else if (store.scan) renderResults(); // keep showing the scan that Replay and Accuracy still use
      else clear(out);
      status.textContent = "The scan did not finish.";
      noticeSlot.querySelector(".notice")?.focus();
    } finally {
      if (!disposed && mine === seq) {
        busy = false;
        submit.removeAttribute("aria-disabled");
        out.classList.remove("is-busy");
        out.removeAttribute("aria-busy");
      }
    }
  }

  // ------------------------------------------------------------ states
  function showNotice(message, offerSample) {
    noticeSlot.replaceChildren(h("div", { class: "notice", tabindex: "-1" },
      h("p", { class: "notice__text" }, message),
      offerSample
        ? h("button", { type: "button", class: "btn btn--quiet", onClick: () => {
          form.source = "sample";
          source.set("sample");
          syncFields();
          runScan({ source: "sample", ticker: form.ticker, days: form.days, file: null }, form.sensitivity, false);
        } }, "Try sample data instead")
        : null));
  }

  function renderEmpty() {
    clear(out).append(h("div", { class: "intro" },
      h("div", { class: "intro__lead" },
        h("h1", { class: "display" }, "Check a stock for fast-trading footprints."),
        h("p", { class: "lede" }, "Scan a few weeks of one-minute prices. Footprint flags minutes where volume, price and order flow look like high-frequency trading, and says why in plain words.")),
      h("div", { class: "intro__key" },
        h("h2", { class: "panel__title" }, "How to read a result"),
        h("dl", { class: "key" },
          h("dt", {}, h("span", { class: "pill pill--elevated" }, "Elevated")),
          h("dd", {}, "Unusual enough to look at. Often explained by news or a busy open."),
          h("dt", {}, h("span", { class: "pill pill--high" }, "High")),
          h("dd", {}, "Several signals line up: a volume burst, a push that reverses, one-sided flow."),
          h("dt", {}, h("span", { class: "pill pill--normal" }, "Normal")),
          h("dd", {}, "Nothing stands out. Most minutes land here.")))));
  }

  function renderLoading() {
    clear(out).append(h("div", { class: "skeleton", "aria-hidden": "true" },
      h("div", { class: "skel skel--title" }), h("div", { class: "skel skel--line" }),
      h("div", { class: "skel skel--strip" }), h("div", { class: "skel skel--chart" })),
    h("p", { class: "hint" }, "Loading minute bars and training the model. This takes about 10 seconds."));
  }

  // ------------------------------------------------------------ results
  function renderResults() {
    panel?.destroy();
    const scan = store.scan;
    const v = verdict(scan);
    panel = chartPanel(() => store.scan, {
      onPick: selectEpisode,
      onReset: () => { store.selectedEpisode = null; status.textContent = "Showing the full session."; refresh(true); },
    });
    strip = sessionStrip(scan, store.selectedDate, pickDay);
    feed = buildFeed();
    const dropped = scan.summary.dropped_sessions;
    clear(out).append(
      h("div", { class: "verdict" }, h("h1", { class: "display", tabindex: "-1" }, v.headline), h("p", { class: "lede" }, v.sub),
        dropped ? h("p", { class: "hint" }, `${dropped === 1 ? "One session was" : `${dropped} sessions were`} left out because too few minutes were available.`) : null),
      h("div", { class: "workspace" },
        h("div", { class: "workspace__main" },
          h("section", { "aria-labelledby": "sessions-title", class: "sessions" },
            h("h2", { id: "sessions-title", class: "panel__title" }, "Sessions"), strip),
          panel.el),
        h("div", { class: "workspace__side" }, feed)));
    panel.show(store.selectedDate, store.selectedEpisode, { animate: false });
  }

  function buildFeed() {
    return alertFeed(store.scan, {
      selectedId: store.selectedEpisode, showAll,
      onSelect: selectEpisode,
      onToggleAll: () => { showAll = !showAll; refresh(false); },
      onSensitivity: (level) => {
        if (busy || !store.lastRequest) return;
        runScan(store.lastRequest, level, true);
      },
      onCopied: (ok) => { status.textContent = ok ? "Alert text copied." : "Could not copy the alert text."; },
    });
  }

  function resetFeed() {
    const nextFeed = buildFeed();
    feed.replaceWith(nextFeed);
    feed = nextFeed;
  }

  function refresh(animate) {
    const active = document.activeElement?.dataset ?? {};
    const nextStrip = sessionStrip(store.scan, store.selectedDate, pickDay);
    const nextFeed = buildFeed();
    strip.replaceWith(nextStrip);
    feed.replaceWith(nextFeed);
    strip = nextStrip;
    feed = nextFeed;
    panel.show(store.selectedDate, store.selectedEpisode, { animate });
    const byAttr = (scope, attr, value) => scope.querySelector(`[data-${attr}="${CSS.escape(value)}"]`);
    if (active.ep) byAttr(feed, "ep", active.ep)?.focus({ preventScroll: true });
    else if (active.date) byAttr(strip, "date", active.date)?.focus({ preventScroll: true });
    else if (active.focus === "more") byAttr(feed, "focus", "more")?.focus({ preventScroll: true });
    else if (active.focus === "reset") {
      // The button that was just pressed is now hidden, so hand focus to the open alert or the chart.
      const target = (store.selectedEpisode && byAttr(feed, "ep", store.selectedEpisode)) || panel.el.querySelector(".chart-root");
      target?.focus({ preventScroll: true });
    }
  }

  function pickDay(date) {
    store.selectedDate = date;
    store.selectedEpisode = null;
    refresh(false);
  }

  function selectEpisode(id) {
    const ep = store.scan.episodes.find((e) => e.id === id);
    if (!ep) return;
    const closing = store.selectedEpisode === id;
    const sameDay = store.selectedDate === ep.date;
    const [from, to] = zoomWindow(ep);
    store.selectedEpisode = closing ? null : id;
    store.selectedDate = ep.date;
    status.textContent = closing
      ? "Showing the full session."
      : `${episodeHeadline(ep)}. Chart zoomed to ${etClock(ep.open_ms, from)} to ${etClock(ep.open_ms, to)} ET.`;
    refresh(sameDay);
  }

  // ------------------------------------------------------------ mount
  root.append(h("section", { class: "scan" }, bar, noticeSlot, status, out));
  syncFields();
  if (store.scan) renderResults();
  else renderEmpty();
  return () => {
    disposed = true;
    panel?.destroy();
  };
}
