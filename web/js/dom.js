// Tiny DOM helpers. Text always goes in as text nodes, never as HTML, so data from the
// server or an uploaded file name cannot inject markup.

const SVG_NS = "http://www.w3.org/2000/svg";

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value == null) continue;
    if (key === "class") el.className = value;
    else if (key === "style") el.style.cssText = value; // CSSOM write, allowed by a strict CSP
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) if (child) el.append(child);
  return el;
}

export function icon(name, size = 20) {
  const el = svg("svg", { class: "icon", width: size, height: size, "aria-hidden": "true", focusable: "false" });
  el.append(svg("use", { href: `/icons.svg#${name}` }));
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Segmented control: mutually exclusive buttons with a gliding highlight.
 * Arrow keys, Home and End move focus; Space or Enter chooses. Choosing can start a slow scan or stop a
 * running replay, so merely moving through the options must not trigger it.
 * Mechanism adapted from https://21st.dev/@kuratlielia/components/segmented-control (gliding selection,
 * roving tab stop), ported from React + Motion to plain DOM and a CSS transform.
 */
export function segmented({ label, options, value, onChange }) {
  const thumb = h("span", { class: "seg__thumb", "aria-hidden": "true" });
  const buttons = options.map((opt) =>
    h("button", { type: "button", class: "seg__btn", dataset: { value: opt.value }, onClick: () => select(opt.value, true) }, opt.label));
  const root = h("div", { class: "seg", role: "group", "aria-label": label }, thumb, ...buttons);
  let current = value;

  function place() {
    const active = buttons.find((b) => b.dataset.value === current);
    if (!active || !active.offsetWidth) return;
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
  }

  function select(next, notify) {
    if (notify && next === current) return;
    current = next;
    for (const b of buttons) {
      const on = b.dataset.value === next;
      b.setAttribute("aria-pressed", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    place();
    if (notify) onChange(next);
  }

  root.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const i = Math.max(0, buttons.indexOf(document.activeElement));
    const last = buttons.length - 1;
    const target = { ArrowRight: i === last ? 0 : i + 1, ArrowDown: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1, ArrowUp: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    for (const b of buttons) b.tabIndex = b === buttons[target] ? 0 : -1;
    buttons[target].focus();
  });

  select(value, false);
  // Re-measure without gliding when the size changes (first paint, font load, window resize).
  new ResizeObserver(() => {
    thumb.style.transition = "none";
    place();
    thumb.getBoundingClientRect();
    thumb.style.transition = "";
  }).observe(root);
  root.set = (next) => select(next, false);
  root.setDisabled = (disabled) => buttons.forEach((b) => { b.disabled = disabled; });
  return root;
}

/** Copy text to the clipboard. Returns true on success. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
