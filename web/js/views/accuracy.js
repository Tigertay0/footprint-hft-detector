import { h, svg, clear } from "../dom.js";
import { api, pollJob } from "../api.js";

const PCT = (v) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
const SWEEP_SIZE = { w: 520, h: 260, l: 40, r: 12, t: 12, b: 36 };
const SERIES = [["precision", "Precision", "line--solid"], ["recall", "Recall", "line--dash"], ["f1", "F1", "line--dot"]];
const POLL_MS = 800;

export function mountAccuracy(root, ctx) {
  const { store, navigate } = ctx;
  if (!store.scan) {
    root.append(h("section", { class: "scan" }, h("div", { class: "intro" }, h("div", { class: "intro__lead" },
      h("h1", { class: "display", tabindex: "-1" }, "Does the hybrid score beat simple rules?"),
      h("p", { class: "lede" }, "The test needs data to work on. Run a scan first, then come back."),
      h("button", { type: "button", class: "btn btn--primary", onClick: () => navigate("scan") }, "Go to Scan")))));
    return () => {};
  }

  const scan = store.scan;
  let stopPoll = null;
  let jobId = null;
  let disposed = false;
  let starting = false;
  let renderedKey = "";
  const live = h("input", { type: "checkbox", id: "live-test" });
  const run = h("button", { type: "button", class: "btn btn--primary", onClick: start }, "Run test");
  const progress = h("p", { class: "hint" });
  const announce = h("p", { class: "sr-only", role: "status" });
  const errorSlot = h("div", { class: "notice-slot", role: "alert" });
  const results = h("div", { class: "results" });

  root.append(h("section", { class: "scan" },
    h("div", { class: "verdict" },
      h("h1", { class: "display", tabindex: "-1" }, "Does the hybrid score beat simple rules?"),
      h("p", { class: "lede" }, "Real manipulation has no public labels. So the test plants known push-and-reverse events in the later sessions and counts how many each method finds.")),
    h("div", { class: "controls controls--test" }, run,
      h("div", { class: "check" }, live, h("label", { for: "live-test" }, "Also test live alerts (takes about 2 minutes)"))),
    progress, announce, errorSlot, results));

  const setBusy = (busy) => run.setAttribute("aria-disabled", String(busy));

  async function start() {
    if (starting || run.getAttribute("aria-disabled") === "true") return;
    stopPoll?.();
    errorSlot.replaceChildren();
    starting = true;
    setBusy(true);
    clear(results);
    renderedKey = "";
    progress.textContent = "Planting events and scoring each method.";
    announce.textContent = "Test started.";
    try {
      const { job_id: id } = await api.startEvaluate({ scan_id: scan.id, include_live: live.checked });
      if (disposed) {
        api.stopJob(id);
        return;
      }
      jobId = id;
      stopPoll = pollJob(id, onUpdate, { intervalMs: POLL_MS });
    } catch (error) {
      fail(error.message);
    } finally {
      starting = false;
    }
  }

  function fail(message) {
    setBusy(false);
    progress.textContent = "";
    errorSlot.replaceChildren(h("div", { class: "notice", tabindex: "-1" }, h("p", { class: "notice__text" }, message)));
    errorSlot.querySelector(".notice").focus();
  }

  function onUpdate(p) {
    if (disposed) return;
    if (p.status === "error") return fail(p.error);
    const key = p.result ? JSON.stringify(p.result) : "";
    if (p.result && key !== renderedKey) {
      renderedKey = key;
      render(p.result);
    }
    const prog = p.progress ?? {};
    if (p.status === "running") {
      if (prog.stage === "live") progress.textContent = `Testing live alerts: session ${prog.done} of ${prog.total}.`;
      else if (p.result) progress.textContent = "Methods compared. Still testing live alerts.";
      return;
    }
    progress.textContent = "";
    setBusy(false);
    if (p.status === "stopped") return;
    announce.textContent = "Test complete. Results are below.";
    const heading = results.querySelector("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: false });
    }
  }

  function render(r) {
    if (!r.methods.length) {
      clear(results).append(h("p", { class: "lede" }, "The test produced no results. Scan a longer window and try again."));
      return;
    }
    const best = [...r.methods].sort((a, b) => b.f1 - a.f1)[0];
    const mostFound = [...r.methods].sort((a, b) => b.recall - a.recall)[0];
    const fewestFalse = [...r.methods].sort((a, b) => b.precision - a.precision)[0];
    clear(results).append(
      h("section", { "aria-labelledby": "methods-title", class: "block" },
        h("h2", { id: "methods-title", class: "panel__title" }, "Which method finds the planted events?"),
        h("p", { class: "lede lede--small" },
          `${r.n_events} events across ${r.n_test_sessions} later sessions. Recall is the share of events found. Precision is the share of alerts that were real.`),
        h("p", { class: "summary" },
          `On this data, ${mostFound.method} finds the most events (${PCT(mostFound.recall)}). `
          + `${fewestFalse.method} raises the fewest false alarms (${PCT(fewestFalse.precision)} of its alerts were real).`),
        methodsTable(r.methods, best),
        h("p", { class: "hint" }, "Precision is a lower bound on real data, because some alerts may be genuine events nobody labelled.")),
      r.sweep.length > 1 ? h("section", { "aria-labelledby": "sweep-title", class: "block" },
        h("h2", { id: "sweep-title", class: "panel__title" }, "What the alert threshold trades off"),
        h("p", { class: "lede lede--small" }, "A lower threshold finds more events but raises more false alarms."),
        sweepChart(r.sweep, scan.settings.elevated)) : null,
      r.live ? liveBlock(r.live) : null);
  }

  return () => {
    disposed = true;
    stopPoll?.();
    if (jobId) api.stopJob(jobId);
  };
}

function methodsTable(methods, best) {
  return h("div", { class: "table-scroll", role: "region", tabindex: "0", "aria-label": "Method comparison table" },
    h("table", { class: "table" },
      h("caption", { class: "sr-only" }, "Precision, recall and F1 for each detection method"),
      h("thead", {}, h("tr", {}, ["Method", "Alerts", "Precision", "Recall", "F1"].map((c, i) => h("th", { scope: "col", class: i ? "num" : "" }, c)))),
      h("tbody", {}, methods.map((m) => h("tr", { class: m === best ? "row--best" : "" },
        h("th", { scope: "row" }, m.method, m === best ? h("span", { class: "tag" }, "Best F1") : null),
        h("td", { class: "num" }, m.alert_episodes), h("td", { class: "num" }, PCT(m.precision)),
        h("td", { class: "num" }, PCT(m.recall)), h("td", { class: "num" }, PCT(m.f1)))))));
}

function sweepChart(sweep, current) {
  const { w, h: ht, l, r, t, b } = SWEEP_SIZE;
  const xs = sweep.map((p) => p.threshold);
  const x = (v) => l + ((v - xs[0]) / (xs[xs.length - 1] - xs[0])) * (w - l - r);
  const y = (v) => t + (1 - v) * (ht - t - b);
  const root = svg("svg", { class: "sweep", viewBox: `0 0 ${w} ${ht}`, "aria-hidden": "true", focusable: "false" });
  for (const v of [0, 0.5, 1]) {
    root.append(svg("line", { class: "grid", x1: l, x2: w - r, y1: y(v), y2: y(v) }));
    root.append(svg("text", { class: "axis-label", x: l - 8, y: y(v) + 4, "text-anchor": "end" }, document.createTextNode(`${v * 100}%`)));
  }
  for (const v of xs.filter((_, i) => i % 3 === 0)) {
    root.append(svg("text", { class: "axis-label", x: x(v), y: ht - 14, "text-anchor": "middle" }, document.createTextNode(String(v))));
  }
  root.append(svg("text", { class: "axis-label", x: (l + w - r) / 2, y: ht - 0, "text-anchor": "middle" }, document.createTextNode("Alert threshold (risk score)")));
  const cx = x(Math.min(Math.max(current, xs[0]), xs[xs.length - 1]));
  root.append(svg("line", { class: "threshold threshold--high", x1: cx, x2: cx, y1: t, y2: ht - b }));
  for (const [key, , cls] of SERIES) {
    const d = sweep.map((p, i) => `${i ? "L" : "M"}${x(p.threshold).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
    root.append(svg("path", { class: `sweep-line ${cls}`, d }));
  }
  const legend = h("p", { class: "legend" }, SERIES.map(([, label, cls]) =>
    h("span", { class: "legend__item" }, h("i", { class: `key-line ${cls}` }), label)),
  h("span", { class: "legend__item" }, h("i", { class: "key-line key-line--marker" }), `Your setting (${current})`));
  // The same numbers as a table, for anyone who cannot read the drawing.
  const table = h("details", { class: "data-details" }, h("summary", {}, "Show the numbers as a table"),
    h("div", { class: "table-scroll", role: "region", tabindex: "0", "aria-label": "Threshold trade-off table" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {}, ["Threshold", "Alerts", "Precision", "Recall", "F1"].map((c, i) => h("th", { scope: "col", class: i ? "num" : "" }, c)))),
        h("tbody", {}, sweep.map((p) => h("tr", {}, h("th", { scope: "row" }, p.threshold), h("td", { class: "num" }, p.alert_episodes),
          h("td", { class: "num" }, PCT(p.precision)), h("td", { class: "num" }, PCT(p.recall)), h("td", { class: "num" }, PCT(p.f1))))))));
  return h("div", { class: "sweep-wrap" }, root, legend, table);
}

function liveBlock(live) {
  const delay = (v) => (v == null ? "" : `, median ${v} min after the push began`);
  const rows = [
    ["Early warning", `Found ${PCT(live.early.caught)} of planted events${delay(live.early.median_delay)}. ${PCT(live.early.precision)} of its ${live.early.count} warnings were real.`],
    ["Confirmed", `Found ${PCT(live.confirmed.caught)}${delay(live.confirmed.median_delay)}. ${PCT(live.confirmed.precision)} of its ${live.confirmed.count} alerts were real.`],
    ["Cleared", `${live.cleared.count} warnings were withdrawn. ${live.cleared.decoys} of them were look-alikes that should be cleared.`],
  ];
  return h("section", { "aria-labelledby": "live-title", class: "block" },
    h("h2", { id: "live-title", class: "panel__title" }, "How live alerts behave"),
    h("p", { class: "lede lede--small" }, "Live mode warns early, then confirms or clears each warning five minutes later."),
    h("dl", { class: "facts" }, rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
}
