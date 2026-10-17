// Building blocks for the Scan view: session strip, chart panel and alert feed.
import { h, icon, clear, segmented, copyText } from "../dom.js";
import { SessionChart } from "../chart.js";
import {
  dateLong, dayOfMonth, weekdayShort, etClock, episodeHeadline, reasonSentence, ruleLine, sensitivityNote, plural,
} from "../format.js";

const FEED_PREVIEW = 8;
const ZOOM_PADDING_MIN = 25;
const FULL_SESSION = [0, 390];
const LEVEL_WORDS = ["Normal", "Elevated", "High"];
const COPY_RESET_MS = 1600;

function levelOf(score, settings) {
  if (score == null) return "none";
  if (score >= settings.high) return "high";
  return score >= settings.elevated ? "elevated" : "normal";
}

// ------------------------------------------------------------------ session strip
export function sessionStrip(scan, selectedDate, onPick) {
  const { sessions, settings, summary } = scan;
  const strip = h("div", { class: "strip", role: "group", "aria-label": "Sessions. Bar height is the highest risk score of the day." });
  if (summary.training_sessions > 0) {
    strip.append(h("div", { class: "strip__learn", style: `grid-column: 1 / span ${summary.training_sessions}` },
      h("span", {}, "Model learned from these sessions")));
  }
  sessions.forEach((s, i) => {
    const level = levelOf(s.peak_score, settings);
    const word = { high: "High", elevated: "Elevated", normal: "Normal", none: "No score" }[level];
    const label = `${dateLong(s.date)}. ${word}${s.peak_score == null ? "" : `, highest score ${Math.round(s.peak_score)}`}. ${plural(s.episodes, "alert")}.`;
    strip.append(h("button", {
      type: "button", class: `day day--${level}`, dataset: { date: s.date }, style: `grid-column: ${i + 1}; grid-row: 2`,
      "aria-pressed": String(s.date === selectedDate), "aria-label": label, onClick: () => onPick(s.date),
    },
    h("span", { class: "day__well", "aria-hidden": "true" }, h("span", { class: "day__bar", style: `height: ${Math.max(4, s.peak_score ?? 0)}%` })),
    h("span", { class: "day__num", "aria-hidden": "true" }, dayOfMonth(s.date)),
    h("span", { class: "day__wd", "aria-hidden": "true" }, weekdayShort(s.date))));
  });
  return strip;
}

// ------------------------------------------------------------------ chart panel
export function chartPanel(getScan, { onPick, onReset }) {
  const title = h("h2", { class: "panel__title", id: "chart-title" });
  const sub = h("p", { class: "panel__sub" });
  const reset = h("button", { type: "button", class: "btn btn--quiet", dataset: { focus: "reset" }, hidden: true, onClick: onReset }, "Show full session");
  const hint = "Hover the chart or use the arrow keys to inspect a minute. PageUp and PageDown jump between flagged minutes. Click a shaded band to open its alert.";
  const readout = h("p", { class: "readout", "aria-hidden": "true" }, hint);
  const live = h("p", { class: "sr-only", role: "status" });
  const root = h("div", { class: "chart-root" });
  const el = h("section", { class: "panel", "aria-labelledby": "chart-title" },
    h("div", { class: "panel__head" }, h("div", {}, title, sub), reset),
    readout, root, live,
    h("p", { class: "legend" },
      h("span", { class: "legend__item" }, h("i", { class: "swatch swatch--elevated" }), "Elevated minute (circle)"),
      h("span", { class: "legend__item" }, h("i", { class: "swatch swatch--high" }), "High minute (diamond)"),
      h("span", { class: "legend__item" }, h("i", { class: "swatch swatch--band" }), "Shaded band: one alert episode")));

  let session = null;

  const chart = new SessionChart(root, {
    kind: "scan",
    onPick,
    onHover(i, fromPointer) {
      if (i == null || !session) {
        readout.textContent = hint;
        return;
      }
      const r = session;
      const level = LEVEL_WORDS[r.lvl[i] ?? 0];
      const flags = [["Price", r.c[i].toFixed(2)], ["Volume Z", r.vz[i]?.toFixed(1) ?? "n/a"],
        ["Reversion", r.rev[i] == null ? "n/a" : `${Math.round(r.rev[i] * 100)}%`],
        ["Imbalance", r.imb[i]?.toFixed(2) ?? "n/a"], ["Risk", r.risk[i]?.toFixed(0) ?? "n/a"]];
      clear(readout).append(h("strong", {}, `${etClock(r.open_ms, r.m[i])} ET`), h("span", { class: "readout__item" }, h("span", { class: "readout__k" }, "Level"), level),
        ...flags.map(([k, v]) => h("span", { class: "readout__item" }, h("span", { class: "readout__k" }, k), v)));
      if (!fromPointer) live.textContent = `${etClock(r.open_ms, r.m[i])}. ${level}. ${flags.map(([k, v]) => `${k} ${v}`).join(". ")}.`;
    },
  });

  return {
    el,
    chart,
    show(date, episodeId, { animate }) {
      const scan = getScan();
      session = scan.sessions.find((s) => s.date === date);
      const episodes = scan.episodes.filter((e) => e.date === date);
      title.textContent = dateLong(date);
      const peak = session.peak_score == null ? "No scored minutes yet"
        : `Highest score ${Math.round(session.peak_score)} at ${etClock(session.open_ms, session.peak_m)} ET`;
      sub.textContent = `${peak}. ${plural(episodes.length, "alert episode")}. ${session.in_training ? "The model learned from this session." : "Not used for training."}`;
      chart.setLabel(`${dateLong(date)}. Price, volume and risk score by minute. ${sub.textContent}`);
      chart.update({ session, episodes, settings: scan.settings, selectedId: episodeId });
      const ep = episodes.find((e) => e.id === episodeId);
      reset.hidden = !ep;
      const target = ep
        ? [Math.max(0, ep.start_m - ZOOM_PADDING_MIN), Math.min(FULL_SESSION[1], ep.end_m + ZOOM_PADDING_MIN)]
        : FULL_SESSION;
      chart.setDomain(target, animate);
    },
    destroy: () => chart.destroy(),
  };
}

// ------------------------------------------------------------------ alert feed
export function alertFeed(scan, { selectedId, showAll, onSelect, onToggleAll, onSensitivity, onCopied }) {
  // Strongest first. Scores tie often (the model strength is capped), so the newest breaks ties.
  const ranked = [...scan.episodes].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || b.start_m - a.start_m);
  const selectedRank = ranked.findIndex((e) => e.id === selectedId);
  const expanded = showAll || selectedRank >= FEED_PREVIEW;
  const rows = expanded ? ranked : ranked.slice(0, FEED_PREVIEW);

  const level = segmented({
    label: "Alert level",
    value: scan.sensitivity,
    options: [{ value: "strict", label: "Strict" }, { value: "balanced", label: "Balanced" }, { value: "sensitive", label: "Sensitive" }],
    onChange: onSensitivity,
  });

  const list = h("ol", { class: "feed__list" }, rows.map((ep) => feedItem(ep, scan, ep.id === selectedId, onSelect, onCopied)));
  if (!rows.length) list.append(h("li", { class: "feed__empty" }, "No alerts at this level. Switch to Sensitive to see weaker signals."));

  return h("section", { class: "feed", "aria-labelledby": "feed-title" },
    h("div", { class: "feed__head" }, h("h2", { id: "feed-title", class: "panel__title" }, "What was flagged"), level),
    h("p", { class: "hint" }, sensitivityNote(scan.sensitivity, scan.settings)),
    list,
    ranked.length > FEED_PREVIEW
      ? h("button", { type: "button", class: "btn btn--quiet feed__more", dataset: { focus: "more" }, onClick: onToggleAll },
        expanded ? "Show strongest only" : `Show all ${ranked.length} alerts`)
      : null,
    h("p", { class: "hint feed__foot" }, "Flags are warning signs of fast algorithmic trading, not proof of manipulation."));
}

function feedItem(ep, scan, selected, onSelect, onCopied) {
  const session = scan.sessions.find((s) => s.date === ep.date);
  const when = `${dateLong(ep.date)}, ${etClock(ep.open_ms, ep.start_m)}${ep.end_m > ep.start_m ? `-${etClock(ep.open_ms, ep.end_m)}` : ""} ET`;
  const bodyId = `${ep.id}-body`;
  const head = h("button", {
    type: "button", class: "item__head", dataset: { ep: ep.id }, "aria-expanded": String(selected),
    "aria-controls": selected ? bodyId : null, onClick: () => onSelect(ep.id),
  },
  h("span", { class: `pill pill--${ep.level.toLowerCase()}` }, `${ep.level} ${Math.round(ep.score)}`),
  h("span", { class: "item__text" }, h("span", { class: "item__title" }, episodeHeadline(ep)), h("span", { class: "item__when" }, when)));
  const li = h("li", { class: `item${selected ? " item--open" : ""}` }, head);
  if (selected && session) li.append(feedBody(ep, bodyId, onCopied));
  return li;
}

function feedBody(ep, bodyId, onCopied) {
  const parts = ep.score_parts;
  const copy = h("button", { type: "button", class: "btn btn--quiet", onClick: async () => {
    const ok = await copyText(ep.text);
    copy.textContent = ok ? "Copied" : "Copy failed";
    onCopied(ok);
    setTimeout(() => { copy.textContent = "Copy alert text"; }, COPY_RESET_MS);
  } }, "Copy alert text");
  const total = Math.max(parts.model_points + parts.rule_points, 1);
  return h("div", { class: "item__body", id: bodyId },
    h("ul", { class: "plain-list" }, ep.reasons.map((r) => h("li", {}, reasonSentence(r)))),
    h("h3", { class: "mini-title" }, "Why this score"),
    h("div", { class: "score-split", role: "img",
      "aria-label": `Score ${Math.round(ep.score)}: model contributed ${parts.model_points}, rules contributed ${parts.rule_points}` },
    h("span", { class: "score-split__model", style: `flex: ${parts.model_points / total}` }),
    h("span", { class: "score-split__rules", style: `flex: ${parts.rule_points / total}` })),
    h("p", { class: "score-split__key" },
      h("span", {}, `Model ${parts.model_points}`), h("span", {}, `Rules ${parts.rule_points} (${parts.rules_fired} of 3)`)),
    h("ul", { class: "rules" }, ep.rules.map((rule) => {
      const line = ruleLine(rule);
      return h("li", { class: `rule${line.fired ? " rule--hit" : ""}` },
        icon(line.fired ? "check" : "x", 16),
        h("span", { class: "rule__label" }, line.label),
        h("span", { class: "rule__detail" }, `${line.fired ? "Triggered: " : "Not triggered: "}${line.detail}`));
    })),
    h("div", { class: "item__actions" }, copy));
}
