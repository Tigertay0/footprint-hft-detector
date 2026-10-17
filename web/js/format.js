// Pure text and time helpers. No DOM access, so they can be tested with `node --test`.

const ET = "America/New_York";
const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: ET, hour: "2-digit", minute: "2-digit", hour12: false });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Clock time in New York for a minute offset from the 9:30 open. */
export function etClock(openMs, minute) {
  return clockFmt.format(new Date(openMs + minute * 60000));
}

/** "2026-09-21" -> parts, without any timezone shifting. */
function dateParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

export function dateShort(iso) {
  const { m, d } = dateParts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

export function dateLong(iso) {
  const { weekday } = dateParts(iso);
  return `${weekday} ${dateShort(iso)}`;
}

export function weekdayShort(iso) {
  return dateParts(iso).weekday;
}

export function dayOfMonth(iso) {
  return String(dateParts(iso).d);
}

export const LEVELS = ["Normal", "Elevated", "High"];

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** One full sentence for a single reason, in the notebook's own wording. */
export function reasonSentence(reason) {
  switch (reason.kind) {
    case "volume":
      return `Trading volume jumped to ${reason.value.toFixed(1)} standard deviations above its recent normal.`;
    case "reversal":
      return `The price was pushed sharply ${reason.direction} and about ${Math.round(reason.value * 100)}% of that move reversed within 5 minutes.`;
    case "flow":
      return `Order flow was heavily one-sided (${reason.side}).`;
    default:
      return "The mix of volume, price movement and order flow was statistically unusual for this stock.";
  }
}

/** A few words for list rows. */
export function reasonShort(reason) {
  switch (reason.kind) {
    case "volume":
      return "Volume burst";
    case "reversal":
      return `Price push, ${Math.round(reason.value * 100)}% reversed`;
    case "flow":
      return `One-sided ${reason.side}`;
    default:
      return "Unusual mix";
  }
}

export function episodeHeadline(ep) {
  return ep.reasons.slice(0, 2).map(reasonShort).join(", ");
}

/** Headline and supporting sentence for a finished scan. */
export function verdict(scan) {
  const { summary, ticker } = scan;
  const high = summary.high_episodes;
  const elevated = summary.episodes - high;
  const sessions = plural(summary.sessions, "session");
  if (summary.episodes === 0) {
    return {
      headline: `${ticker}: no fast-trading footprints found in ${sessions}.`,
      sub: "Nothing crossed the alert line. Try the Sensitive setting to see weaker signals.",
    };
  }
  const parts = [];
  if (high) parts.push(`${plural(high, "high-risk episode")}`);
  if (elevated) parts.push(`${plural(elevated, "elevated one")}`);
  const peak = summary.peak;
  const sub = peak
    ? `Strongest: ${Math.round(peak.score)} out of 100 on ${dateShort(peak.date)}. Flags are warning signs of fast algorithmic trading, not proof of manipulation.`
    : "Flags are warning signs of fast algorithmic trading, not proof of manipulation.";
  return { headline: `${ticker} has ${parts.join(" and ")} in ${sessions}.`, sub };
}

/** Plain-language line for one rule row in the "why this score" panel. */
export function ruleLine(rule) {
  const labels = {
    volume: ["Volume burst", (r) => `${r.value.toFixed(1)} against ${r.threshold} needed`],
    reversal: ["Push, then reversal", (r) => `${Math.round(r.value * 100)}% given back against ${Math.round(r.threshold * 100)}% needed`],
    flow: ["One-sided flow", (r) => `${r.value.toFixed(2)} against ${r.threshold} needed`],
  };
  const [label, detail] = labels[rule.id];
  return { label, detail: detail(rule), fired: rule.fired };
}

export function sensitivityNote(name, settings) {
  const word = { strict: "Strict", balanced: "Balanced", sensitive: "Sensitive" }[name];
  return `${word}: Elevated from ${settings.elevated}, High from ${settings.high}`;
}

/** Index of the entry in a sorted number array closest to `target`. */
export function nearestIndex(sorted, target) {
  let lo = 0;
  let hi = sorted.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < target) lo = mid;
    else hi = mid;
  }
  return Math.abs(sorted[lo] - target) <= Math.abs(sorted[hi] - target) ? lo : hi;
}

/** The instant (a Date) when New York clocks read hh:mm on the given New York calendar day. */
export function etToDate(y, m, d, hh, mm) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  }).formatToParts(new Date(guess));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess + (guess - shown));
}
