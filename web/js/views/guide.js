import { h } from "../dom.js";

const SIGNALS = [
  ["Volume burst", "How far this minute's volume sits above the last 20 minutes, on a log scale. The minute is left out of its own baseline.", "Bursts of rapid-fire orders."],
  ["Push and reversal", "The share of a sharp 3-minute price push that is given back within the next 5 minutes.", "Momentum ignition: push the price, sell into the followers, let it fall back."],
  ["One-sided flow", "Where the close sits inside the high-low range, weighted by volume, over 5 minutes. From -1 (all selling) to +1 (all buying).", "Aggressive orders all on one side."],
];

const LIMITS = [
  ["It cannot name who traded.", "Price and volume bars do not show trader type. Footprint finds patterns consistent with high-frequency trading, not high-frequency traders."],
  ["One-minute bars hide the fastest activity.", "High-frequency firms act in microseconds. Only large, sustained footprints survive being averaged into a minute."],
  ["Imbalance is an estimate.", "It comes from where each bar closes in its range. It is not order-book data."],
  ["Free data sees only part of the market.", "Yahoo's minute bars are limited to about 29 days, and some free feeds cover only a slice of total volume."],
  ["The accuracy test uses planted events.", "It measures sensitivity to one defined manipulation shape, not to every kind of manipulation."],
  ["Confirmed alerts run 5 minutes late.", "Whether a push reversed can only be known after it has had time to reverse. Early warnings come first, confirmation follows."],
];

export function mountGuide(root) {
  root.append(h("article", { class: "guide" },
    h("h1", { class: "display", tabindex: "-1" }, "How Footprint decides"),
    h("p", { class: "lede" }, "Every flag comes from three signals and a trained model. Nothing is hidden, and each alert shows its working."),

    h("section", { "aria-labelledby": "g-signals" },
      h("h2", { id: "g-signals" }, "The three signals"),
      // Roles are explicit because the phone layout stacks cells with display:block, which would otherwise drop the table semantics.
      h("table", { class: "table table--guide", role: "table" },
        h("caption", { class: "sr-only" }, "The three signals and the trading pattern each points to"),
        h("thead", { role: "rowgroup" }, h("tr", { role: "row" }, ["Signal", "What it measures", "Pattern it points to"].map((c) => h("th", { scope: "col", role: "columnheader" }, c)))),
        h("tbody", { role: "rowgroup" }, SIGNALS.map(([a, b, c]) => h("tr", { role: "row" },
          h("th", { scope: "row", role: "rowheader" }, a),
          h("td", { role: "cell", dataset: { label: "What it measures" } }, b),
          h("td", { role: "cell", dataset: { label: "Pattern it points to" } }, c)))))),

    h("section", { "aria-labelledby": "g-score" },
      h("h2", { id: "g-score" }, "The risk score"),
      h("p", {}, "Each minute gets a score from 0 to 100. Sixty percent comes from an Isolation Forest model, and forty percent from how many of three plain rules fire."),
      h("p", { class: "formula" }, "Score = 100 x (0.6 x model strength + 0.4 x rules fired / 3)"),
      h("ul", { class: "plain-list" },
        h("li", {}, "The model learns what normal looks like from the first 60% of sessions only. It never sees the later ones when it learns."),
        h("li", {}, "Its raw output becomes a percentile against that training period. Only the top 5% adds to the score."),
        h("li", {}, "The rules: volume more than 2.5 standard deviations above normal, more than half of a push reversed, and flow stronger than 0.6 on one side.")),
      h("dl", { class: "key" },
        h("dt", {}, h("span", { class: "pill pill--normal" }, "Normal")), h("dd", {}, "Below the Elevated line. Most minutes."),
        h("dt", {}, h("span", { class: "pill pill--elevated" }, "Elevated")), h("dd", {}, "Balanced setting: 50 to 69. Strict starts at 60, Sensitive at 40."),
        h("dt", {}, h("span", { class: "pill pill--high" }, "High")), h("dd", {}, "Balanced setting: 70 and above. Strict starts at 80, Sensitive at 60."))),

    h("section", { "aria-labelledby": "g-live" },
      h("h2", { id: "g-live" }, "Early warnings and confirmation"),
      h("p", {}, "Telling whether a push reversed needs the next five minutes. So live alerts come in two stages."),
      h("dl", { class: "facts" },
        h("dt", {}, "Early warning"), h("dd", {}, "The minute it happens. A volume burst, a sharp 3-minute move or one-sided flow, plus the model. It means something is happening."),
        h("dt", {}, "Confirmed"), h("dd", {}, "Five minutes later, when the full score is above the alert line and at least 35% of the push reversed."),
        h("dt", {}, "Cleared"), h("dd", {}, "Five minutes later, when the move held. That looks more like real demand or news than a push-and-pull pattern."))),

    h("section", { "aria-labelledby": "g-limits" },
      h("h2", { id: "g-limits" }, "What it cannot tell you"),
      h("dl", { class: "facts" }, LIMITS.flatMap(([a, b]) => [h("dt", {}, a), h("dd", {}, b)]))),

    h("section", { "aria-labelledby": "g-data" },
      h("h2", { id: "g-data" }, "Where the data comes from"),
      h("p", {}, "Market data is one-minute bars from Yahoo Finance, regular session only (9:30 to 16:00 New York time). Sample data is generated for testing and includes innocent look-alikes the detector should ignore."),
      h("p", {}, "To use your own bars, upload a CSV with the columns timestamp, open, high, low, close and volume. Timestamps without a timezone are read as New York time, and timestamps with an offset are converted.")),

    h("p", { class: "hint" }, "Footprint is a research tool for studying trading patterns. It is not investment advice.")));
  return () => {};
}
