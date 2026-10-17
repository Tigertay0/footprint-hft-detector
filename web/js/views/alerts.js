import { h, clear } from "../dom.js";
import { api } from "../api.js";
import { dateLong, plural } from "../format.js";

const REFRESH_MS = 30000;
const KIND = {
  "EARLY WARNING": { label: "Early warning", cls: "elevated" },
  CONFIRMED: { label: "Confirmed", cls: "high" },
  ALERT: { label: "Confirmed", cls: "high" },
  CLEARED: { label: "Cleared", cls: "neutral" },
};

const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function delivery(row) {
  if (row.notified) return null;
  if (row.note === "saved only (setting)") return "Saved, not sent (by your setting)";
  if (row.note === "held back: hourly limit") return "Saved, not sent (hourly limit)";
  return "Not delivered to your phone";
}

function statusLine(w) {
  if (!w.seen) return { text: "No watcher has reported yet. Start it on your always-on computer (see the README).", ok: false };
  const tickers = w.tickers.length ? w.tickers.join(", ") : "no tickers yet";
  if (!w.running) {
    return { text: `The watcher is not running. It last reported ${Math.max(1, Math.round(w.age_seconds / 60))} minutes ago while watching ${tickers}. Alerts are not being checked.`, ok: false };
  }
  if (w.state === "degraded") return { text: `The watcher is running but something is wrong: ${w.detail} Alerts may be missed.`, ok: false };
  if (w.state === "watching") return { text: `The watcher is running and checking ${tickers}. ${w.detail}.`, ok: true };
  if (w.state === "preparing") return { text: `The watcher is running and training on ${tickers} before the bell.`, ok: true };
  return { text: `The watcher is running and waiting for the market. ${w.detail}.`, ok: true };
}

export function mountAlerts(root) {
  let disposed = false;
  let timer = 0;
  let ticker = "";
  let knownTickers = [];
  const status = h("p", { class: "summary" }, "Checking the watcher...");
  const select = h("select", { id: "alert-ticker", onChange: (e) => { ticker = e.target.value; load(); } });
  const list = h("ol", { class: "feed__list" });
  const note = h("p", { class: "hint" });
  const errorSlot = h("div", { class: "notice-slot", role: "alert" });

  root.append(h("section", { class: "scan" },
    h("div", { class: "verdict" },
      h("h1", { class: "display", tabindex: "-1" }, "Alerts from the watcher."),
      h("p", { class: "lede" }, "The watcher runs on an always-on computer and saves every alert here, whether or not this page was open.")),
    status,
    h("div", { class: "controls" }, h("div", { class: "field" }, h("label", { for: "alert-ticker" }, "Ticker"), select)),
    errorSlot, note, list));

  function fillSelect(tickers) {
    const next = [...new Set([...tickers])].sort();
    if (next.join() === knownTickers.join()) return;
    knownTickers = next;
    clear(select).append(h("option", { value: "" }, "All tickers"),
      ...next.map((t) => h("option", { value: t, selected: t === ticker }, t)));
  }

  function row(a) {
    const kind = KIND[a.kind] ?? { label: a.kind, cls: "neutral" };
    const problem = delivery(a);
    return h("li", { class: "msg" },
      h("div", { class: "msg__head" },
        h("span", { class: `pill pill--${kind.cls}` }, kind.label),
        h("strong", {}, a.ticker),
        h("span", { class: "msg__time" }, `${dateLong(a.session_date)}, ${a.sent_et} ET, about ${a.about_et}`)),
      h("p", { class: "msg__text" }, upper(a.text)),
      problem ? h("p", { class: "hint" }, problem) : null);
  }

  async function load() {
    try {
      const [watcher, history] = await Promise.all([api.watcher(), api.alerts(ticker)]);
      if (disposed) return;
      errorSlot.replaceChildren();
      const line = statusLine(watcher);
      status.textContent = line.text;
      status.classList.toggle("summary--bad", !line.ok);
      fillSelect([...watcher.tickers, ...history.alerts.map((a) => a.ticker)]);
      clear(list).append(...history.alerts.map(row));
      note.textContent = history.alerts.length
        ? `Showing the latest ${plural(history.alerts.length, "alert")}. This list refreshes every 30 seconds.`
        : "No alerts yet. Quiet is normal: an alert needs a volume burst, a sharp push or one-sided flow to stand out.";
    } catch (error) {
      if (disposed) return;
      errorSlot.replaceChildren(h("div", { class: "notice", tabindex: "-1" }, h("p", { class: "notice__text" }, error.message)));
    }
  }

  function schedule() {
    timer = setTimeout(async () => {
      await load();
      if (!disposed) schedule();
    }, REFRESH_MS);
  }

  load();
  schedule();
  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}
