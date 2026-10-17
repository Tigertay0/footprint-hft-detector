// Session chart: price on top, then volume and risk panes sharing one time axis.
// Drawn as plain SVG so colors come from CSS classes (and therefore from the theme tokens).
import { svg, prefersReducedMotion } from "./dom.js";
import { etClock, nearestIndex } from "./format.js";

const MARGIN = { l: 56, r: 14, t: 10, b: 28 };
const PANE_GAP = 16;
const ZOOM_MS = 360;
const FULL_SESSION = [0, 390];
const TICK_STEPS = [5, 10, 15, 30, 60];
const VOL_Z_CAP = 8;
const LEVEL_CLASS = ["", "elevated", "high"];

let chartCount = 0;

/**
 * @typedef {{ m:number[], o:number[], h:number[], l:number[], c:number[], v:number[], open_ms:number,
 *   vz?:(number|null)[], risk?:(number|null)[], lvl?:(number|null)[] }} SessionData
 */

export class SessionChart {
  /**
   * @param {HTMLElement} root
   * @param {{ kind: "scan"|"replay", onHover?: (i:number|null)=>void, onPick?: (id:string)=>void }} opts
   */
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    this.id = `chart${++chartCount}`;
    this.state = { session: null, episodes: [], settings: null, selectedId: null, reveal: Infinity, markers: [], planted: [] };
    this.domain = [...FULL_SESSION];
    this.cursor = null;
    this.frame = 0;
    // The focusable wrapper carries the name and role. The drawing itself is hidden from assistive tech,
    // because its shapes mean nothing one by one. The readout and the alert list carry the content.
    this.svg = svg("svg", { class: "chart", "aria-hidden": "true", focusable: "false" });
    root.append(this.svg);
    root.tabIndex = 0;
    root.setAttribute("role", "group");
    root.setAttribute("aria-roledescription", "interactive chart");
    this.layout = null;
    this.resizer = new ResizeObserver(() => this.render());
    this.resizer.observe(root);
    this.svg.addEventListener("pointermove", (e) => this.pointer(e));
    this.svg.addEventListener("pointerleave", () => {
      if (document.activeElement !== this.root) this.setCursor(null, true);
    });
    this.svg.addEventListener("click", (e) => this.click(e));
    root.addEventListener("keydown", (e) => this.key(e));
  }

  update(patch) {
    if (patch.session && patch.session !== this.state.session) this.cursor = null;
    this.state = { ...this.state, ...patch };
    this.render();
  }

  setLabel(text) {
    this.root.setAttribute("aria-label", text);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizer.disconnect();
  }

  // ------------------------------------------------------------ zoom
  setDomain(target, animate = true) {
    cancelAnimationFrame(this.frame);
    const from = [...this.domain];
    if (!animate || prefersReducedMotion()) {
      this.domain = [...target];
      this.render();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const e = 1 - (1 - t) ** 3; // ease-out cubic
      this.domain = [from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e];
      this.render();
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------ geometry
  computeLayout(width) {
    const compact = width < 560;
    const kind = this.opts.kind;
    const panes = kind === "scan"
      ? [{ id: "price", h: compact ? 200 : 264 }, { id: "vol", h: compact ? 64 : 84 }, { id: "risk", h: compact ? 64 : 84 }]
      : [{ id: "price", h: compact ? 240 : 320 }, { id: "volume", h: compact ? 64 : 76 }];
    let y = MARGIN.t;
    for (const p of panes) {
      p.y0 = y;
      y += p.h + PANE_GAP;
    }
    return { panes, height: y - PANE_GAP + MARGIN.b, plotW: width - MARGIN.l - MARGIN.r, bottom: y - PANE_GAP };
  }

  xOf(m) {
    const [d0, d1] = this.domain;
    return MARGIN.l + ((m - d0) / (d1 - d0)) * this.layout.plotW;
  }

  visibleIndices() {
    const { session, reveal } = this.state;
    const [d0, d1] = this.domain;
    const out = [];
    for (let i = 0; i < session.m.length && i < reveal; i++) {
      if (session.m[i] >= d0 - 1 && session.m[i] <= d1 + 1) out.push(i);
    }
    return out;
  }

  // ------------------------------------------------------------ drawing
  render() {
    const { session } = this.state;
    const width = this.root.clientWidth;
    if (!session || !width) return;
    this.layout = this.computeLayout(width);
    const { height, panes } = this.layout;
    const root = this.svg;
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    root.setAttribute("width", width);
    root.setAttribute("height", height);
    while (root.firstChild) root.removeChild(root.firstChild);

    const clipId = `${this.id}-clip`;
    root.append(svg("defs", {}, svg("clipPath", { id: clipId },
      svg("rect", { x: MARGIN.l, y: 0, width: this.layout.plotW, height }))));
    const body = svg("g", { "clip-path": `url(#${clipId})` });
    const idx = this.visibleIndices();

    this.drawBands(body);
    for (const pane of panes) {
      this.drawGrid(root, body, pane);
      if (pane.id === "price") this.drawPrice(body, pane, idx);
      else if (pane.id === "vol") this.drawVolumeZ(body, pane, idx);
      else if (pane.id === "volume") this.drawVolumeRaw(body, pane, idx);
      else this.drawRisk(body, pane, idx);
    }
    this.drawMarkers(body, panes[0]);
    root.append(body);
    this.drawTimeAxis(root);
    this.cursorGroup = svg("g", { class: "cursor", "pointer-events": "none" });
    root.append(this.cursorGroup);
    this.drawCursor();
  }

  drawBands(parent) {
    const { episodes, selectedId } = this.state;
    for (const ep of episodes) {
      const x0 = this.xOf(ep.start_m - 0.5);
      const x1 = this.xOf(ep.end_m + 0.5);
      const level = LEVEL_CLASS[ep.level === "High" ? 2 : 1];
      const width = Math.max(6, x1 - x0);
      parent.append(svg("rect", {
        class: `band band--${level}${ep.id === selectedId ? " band--selected" : ""}`,
        x: x0, y: MARGIN.t, width, height: this.layout.bottom - MARGIN.t,
      }));
      // High episodes also get a solid cap, so they differ from Elevated by more than color.
      if (level === "high") parent.append(svg("rect", { class: "band-cap", x: x0, y: MARGIN.t, width, height: 4 }));
    }
  }

  drawGrid(root, body, pane) {
    const gridLines = (values, fmt) => {
      for (const v of values) {
        const y = pane.scale(v);
        body.append(svg("line", { class: "grid", x1: MARGIN.l, x2: MARGIN.l + this.layout.plotW, y1: y, y2: y }));
        root.append(svg("text", { class: "axis-label", x: MARGIN.l - 8, y: y + 4, "text-anchor": "end" }, text(fmt(v))));
      }
    };
    pane.gridLines = gridLines;
  }

  drawPrice(body, pane, idx) {
    const { session } = this.state;
    // Before the first minute is revealed there is nothing to scale to, so use the whole session's range.
    const closes = (idx.length ? idx : session.c.map((_, i) => i)).map((i) => session.c[i]);
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const pad = (hi - lo || hi * 0.002) * 0.1;
    const y0 = lo - pad;
    const y1 = hi + pad;
    pane.scale = (v) => pane.y0 + pane.h - ((v - y0) / (y1 - y0)) * pane.h;
    const ticks = [0, 1, 2, 3].map((k) => y0 + ((y1 - y0) * k) / 3);
    pane.gridLines(ticks, (v) => v.toFixed(2));
    body.append(svg("text", { class: "pane-title", x: MARGIN.l + 6, y: pane.y0 + 14 }, text("Price")));
    if (idx.length > 1) {
      const d = idx.map((i, n) => `${n ? "L" : "M"}${this.xOf(session.m[i]).toFixed(1)},${pane.scale(session.c[i]).toFixed(1)}`).join("");
      body.append(svg("path", { class: "price-line", d }));
    }
    if (session.lvl) {
      for (const i of idx) {
        const lvl = session.lvl[i];
        if (!lvl) continue;
        const x = this.xOf(session.m[i]);
        const y = pane.scale(session.c[i]);
        // Elevated is a small circle and High is a larger diamond, so the two differ by shape as well as hue.
        body.append(lvl === 2
          ? svg("path", { class: "dot dot--high", d: `M${x},${y - 6}L${x + 6},${y}L${x},${y + 6}L${x - 6},${y}Z` })
          : svg("circle", { class: "dot dot--elevated", cx: x, cy: y, r: 3.2 }));
      }
    }
    for (const m of this.state.planted) {
      const x = this.xOf(m);
      const y = pane.y0 + pane.h;
      body.append(svg("path", { class: "planted", d: `M${x},${y - 9}L${x - 5},${y}L${x + 5},${y}Z` }, svg("title", {}, text("Planted event"))));
    }
  }

  drawVolumeZ(body, pane, idx) {
    const { session, settings } = this.state;
    pane.scale = (v) => pane.y0 + pane.h - (Math.min(v, VOL_Z_CAP) / VOL_Z_CAP) * pane.h;
    pane.gridLines([0, settings.vol_z, VOL_Z_CAP], (v) => (v === VOL_Z_CAP ? `${v}+` : String(v)));
    body.append(svg("text", { class: "pane-title", x: MARGIN.l + 6, y: pane.y0 + 14 }, text("Volume vs normal")));
    const barW = Math.max(1, (this.layout.plotW / (this.domain[1] - this.domain[0])) * 0.7);
    for (const i of idx) {
      const z = session.vz?.[i];
      if (z == null || z <= 0) continue;
      const hot = z > settings.vol_z;
      body.append(svg("rect", {
        class: hot ? "bar bar--elevated" : "bar",
        x: this.xOf(session.m[i]) - barW / 2, y: pane.scale(z), width: barW, height: pane.y0 + pane.h - pane.scale(z),
      }));
    }
    body.append(svg("line", { class: "threshold", x1: MARGIN.l, x2: MARGIN.l + this.layout.plotW, y1: pane.scale(settings.vol_z), y2: pane.scale(settings.vol_z) }));
  }

  drawVolumeRaw(body, pane, idx) {
    const { session } = this.state;
    const max = Math.max(1, ...idx.map((i) => session.v[i]));
    pane.scale = (v) => pane.y0 + pane.h - (v / max) * pane.h;
    pane.gridLines([0], () => "0");
    body.append(svg("text", { class: "pane-title", x: MARGIN.l + 6, y: pane.y0 + 14 }, text("Volume")));
    const barW = Math.max(1, (this.layout.plotW / (this.domain[1] - this.domain[0])) * 0.7);
    for (const i of idx) {
      body.append(svg("rect", { class: "bar", x: this.xOf(session.m[i]) - barW / 2, y: pane.scale(session.v[i]), width: barW,
        height: pane.y0 + pane.h - pane.scale(session.v[i]) }));
    }
  }

  drawRisk(body, pane, idx) {
    const { session, settings } = this.state;
    pane.scale = (v) => pane.y0 + pane.h - (v / 100) * pane.h;
    pane.gridLines([0, 50, 100], String);
    body.append(svg("text", { class: "pane-title", x: MARGIN.l + 6, y: pane.y0 + 14 }, text("Risk score")));
    const barW = Math.max(1, (this.layout.plotW / (this.domain[1] - this.domain[0])) * 0.7);
    for (const i of idx) {
      const r = session.risk?.[i];
      if (r == null || r <= 0) continue;
      const cls = LEVEL_CLASS[session.lvl?.[i] ?? 0];
      body.append(svg("rect", {
        class: cls ? `bar bar--${cls}` : "bar", x: this.xOf(session.m[i]) - barW / 2, y: pane.scale(r), width: barW, height: pane.y0 + pane.h - pane.scale(r),
      }));
    }
    for (const [value, name] of [[settings.elevated, "elevated"], [settings.high, "high"]]) {
      const y = pane.scale(value);
      body.append(svg("line", { class: `threshold threshold--${name}`, x1: MARGIN.l, x2: MARGIN.l + this.layout.plotW, y1: y, y2: y }));
      body.append(svg("text", { class: "threshold-label", x: MARGIN.l + this.layout.plotW - 6, y: y - 4, "text-anchor": "end" }, text(`${name === "high" ? "High" : "Elevated"} ${value}`)));
    }
  }

  drawMarkers(parent, pricePane) {
    const labels = { "EARLY WARNING": "Early warning", CONFIRMED: "Confirmed", CLEARED: "Cleared", ALERT: "Alert" };
    this.state.markers.forEach((mk, n) => {
      const x = this.xOf(mk.about_m);
      const cls = mk.kind === "EARLY WARNING" ? "elevated" : mk.kind === "CLEARED" ? "neutral" : "high";
      parent.append(svg("line", { class: `marker marker--${cls}`, x1: x, x2: x, y1: pricePane.y0 + 20, y2: pricePane.y0 + pricePane.h }));
      parent.append(svg("text", { class: `marker-label marker-label--${cls}`, x: x + 4, y: pricePane.y0 + 32 + (n % 2) * 14 }, text(labels[mk.kind] ?? mk.kind)));
    });
  }

  drawTimeAxis(root) {
    const [d0, d1] = this.domain;
    const step = TICK_STEPS.find((s) => (d1 - d0) / s <= 8) ?? 60;
    const first = Math.ceil(d0 / step) * step;
    for (let m = first; m <= d1; m += step) {
      const x = this.xOf(m);
      root.append(svg("line", { class: "tick", x1: x, x2: x, y1: this.layout.bottom, y2: this.layout.bottom + 5 }));
      root.append(svg("text", { class: "axis-label", x, y: this.layout.bottom + 19, "text-anchor": "middle" }, text(etClock(this.state.session.open_ms, m))));
    }
  }

  // ------------------------------------------------------------ cursor and input
  drawCursor() {
    const g = this.cursorGroup;
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const { session, reveal } = this.state;
    if (this.cursor == null || !session || this.cursor >= Math.min(session.m.length, reveal)) return;
    const x = this.xOf(session.m[this.cursor]);
    if (x < MARGIN.l || x > MARGIN.l + this.layout.plotW) return;
    g.append(svg("line", { class: "cursor-line", x1: x, x2: x, y1: MARGIN.t, y2: this.layout.bottom }));
    const price = this.layout.panes[0];
    if (price.scale) g.append(svg("circle", { class: "cursor-dot", cx: x, cy: price.scale(session.c[this.cursor]), r: 4 }));
  }

  setCursor(i, fromPointer) {
    this.cursor = i;
    this.drawCursor();
    this.opts.onHover?.(i, fromPointer);
  }

  minuteAt(event) {
    const rect = this.svg.getBoundingClientRect();
    const [d0, d1] = this.domain;
    return d0 + ((event.clientX - rect.left - MARGIN.l) / this.layout.plotW) * (d1 - d0);
  }

  pointer(event) {
    const { session, reveal } = this.state;
    if (!session || !this.layout) return;
    const m = this.minuteAt(event);
    const limit = Math.min(session.m.length, reveal);
    if (m < this.domain[0] - 1 || m > this.domain[1] + 1 || limit < 1) return this.setCursor(null, true);
    this.setCursor(nearestIndex(session.m.slice(0, limit), m), true);
  }

  click(event) {
    if (!this.layout) return;
    const m = this.minuteAt(event);
    const hit = this.state.episodes.find((ep) => m >= ep.start_m - 2 && m <= ep.end_m + 2);
    if (hit) this.opts.onPick?.(hit.id);
  }

  key(event) {
    const { session } = this.state;
    if (!session || event.altKey || event.ctrlKey || event.metaKey) return;
    // Keyboard movement stays inside what is on screen (zoomed window, revealed minutes).
    const visible = this.visibleIndices();
    if (!visible.length) return;
    const first = visible[0];
    const last = visible[visible.length - 1];
    const current = this.cursor == null || this.cursor < first || this.cursor > last ? null : this.cursor;
    const step = event.shiftKey ? 10 : 1;
    const flagged = (i) => session.lvl?.[i] > 0;
    const jump = (dir) => {
      for (let i = (current ?? (dir > 0 ? first - 1 : last + 1)) + dir; i >= first && i <= last; i += dir) {
        if (flagged(i)) return i;
      }
      return current ?? first;
    };
    const next = {
      ArrowRight: current == null ? first : current + step,
      ArrowLeft: current == null ? last : current - step,
      Home: first,
      End: last,
      PageDown: jump(1),
      PageUp: jump(-1),
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.setCursor(Math.max(first, Math.min(last, next)), false);
  }
}

function text(value) {
  return document.createTextNode(String(value));
}
