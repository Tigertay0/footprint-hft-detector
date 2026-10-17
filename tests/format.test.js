// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import {
  etClock, dateShort, dateLong, plural, reasonSentence, reasonShort, episodeHeadline, verdict, ruleLine, nearestIndex, etToDate,
} from "../web/js/format.js";

const OPEN_MS_EDT = Date.UTC(2026, 9, 12, 13, 30); // 9:30 New York on 12 Oct 2026 (daylight time)

test("etClock shows New York time for a minute offset", () => {
  assert.equal(etClock(OPEN_MS_EDT, 0), "09:30");
  assert.equal(etClock(OPEN_MS_EDT, 390), "16:00");
  assert.equal(etClock(Date.UTC(2026, 11, 1, 14, 30), 60), "10:30"); // winter, standard time
});

test("dates are formatted without timezone drift", () => {
  assert.equal(dateShort("2026-10-01"), "1 Oct");
  assert.equal(dateLong("2026-09-21"), "Mon 21 Sep");
});

test("plural", () => {
  assert.equal(plural(1, "session"), "1 session");
  assert.equal(plural(21, "session"), "21 sessions");
});

test("reason sentences use the notebook wording", () => {
  assert.equal(reasonSentence({ kind: "volume", value: 3.94 }), "Trading volume jumped to 3.9 standard deviations above its recent normal.");
  assert.equal(reasonSentence({ kind: "reversal", value: 0.87, direction: "up" }),
    "The price was pushed sharply up and about 87% of that move reversed within 5 minutes.");
  assert.equal(reasonSentence({ kind: "flow", value: -0.8, side: "selling" }), "Order flow was heavily one-sided (selling).");
  assert.match(reasonSentence({ kind: "model", value: 0.9 }), /statistically unusual/);
});

test("list headline joins at most two reasons", () => {
  const ep = { reasons: [{ kind: "volume", value: 3 }, { kind: "reversal", value: 0.62 }, { kind: "flow", side: "buying", value: 1 }] };
  assert.equal(episodeHeadline(ep), "Volume burst, Price push, 62% reversed");
  assert.equal(reasonShort({ kind: "flow", side: "buying" }), "One-sided buying");
});

test("verdict headline counts high and elevated separately", () => {
  const scan = { ticker: "TSLA", summary: { sessions: 21, episodes: 122, high_episodes: 47, peak: { score: 86.4, date: "2026-09-21" } } };
  const v = verdict(scan);
  assert.equal(v.headline, "TSLA has 47 high-risk episodes and 75 elevated ones in 21 sessions.");
  assert.match(v.sub, /86 out of 100 on 21 Sep/);
  assert.match(v.sub, /not proof of manipulation/);
});

test("verdict when nothing is flagged", () => {
  const v = verdict({ ticker: "AAPL", summary: { sessions: 19, episodes: 0, high_episodes: 0, peak: null } });
  assert.equal(v.headline, "AAPL: no fast-trading footprints found in 19 sessions.");
});

test("verdict with one episode uses the singular", () => {
  const v = verdict({ ticker: "X", summary: { sessions: 1, episodes: 1, high_episodes: 1, peak: null } });
  assert.equal(v.headline, "X has 1 high-risk episode in 1 session.");
});

test("rule lines say what was needed", () => {
  const line = ruleLine({ id: "volume", fired: true, value: 12.31, threshold: 2.5 });
  assert.deepEqual(line, { label: "Volume burst", detail: "12.3 against 2.5 needed", fired: true });
  assert.equal(ruleLine({ id: "reversal", fired: false, value: 0.1, threshold: 0.5 }).detail, "10% given back against 50% needed");
});

test("nearestIndex finds the closest minute", () => {
  assert.equal(nearestIndex([0, 1, 2, 5, 9], 4), 3);
  assert.equal(nearestIndex([0, 1, 2, 5, 9], 100), 4);
  assert.equal(nearestIndex([0, 1, 2, 5, 9], -3), 0);
  assert.equal(nearestIndex([3], 3), 0);
});

test("etToDate handles daylight and standard time", () => {
  assert.equal(etToDate(2026, 10, 12, 9, 30).toISOString(), "2026-10-12T13:30:00.000Z");
  assert.equal(etToDate(2026, 12, 1, 9, 30).toISOString(), "2026-12-01T14:30:00.000Z");
});
