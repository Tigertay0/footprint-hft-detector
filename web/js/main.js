import { h, icon, clear } from "./dom.js";
import { mountScan } from "./views/scan.js";
import { mountReplay } from "./views/replay.js";
import { mountAccuracy } from "./views/accuracy.js";
import { mountAlerts } from "./views/alerts.js";
import { mountGuide } from "./views/guide.js";

const ROUTES = {
  scan: { title: "Scan", mount: mountScan },
  replay: { title: "Replay", mount: mountReplay },
  alerts: { title: "Alerts", mount: mountAlerts },
  accuracy: { title: "Accuracy", mount: mountAccuracy },
  guide: { title: "Guide", mount: mountGuide },
};
const DEFAULT_ROUTE = "scan";
const THEME_KEY = "footprint-theme";

// State shared between views. Views replace values, they never mutate them in place.
const store = {
  form: { source: "market", ticker: "TSLA", days: "29", sensitivity: "balanced", file: null },
  scan: null,
  selectedDate: null,
  selectedEpisode: null,
};

const main = document.getElementById("main");
const links = [...document.querySelectorAll("[data-route]")];
let cleanup = null;

function currentRoute() {
  const match = location.hash.match(/^#\/(\w+)/);
  return match && ROUTES[match[1]] ? match[1] : DEFAULT_ROUTE;
}

function focusHeading() {
  const heading = main.querySelector("h1");
  window.scrollTo(0, 0);
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function show({ moveFocus }) {
  const name = currentRoute();
  const route = ROUTES[name];
  if (cleanup) {
    try {
      cleanup();
    } catch {
      // A view that fails while closing must not stop the next one from opening.
    }
    cleanup = null;
  }
  clear(main);
  try {
    cleanup = route.mount(main, { store, navigate: (to) => { location.hash = `#/${to}`; } }) || null;
  } catch {
    clear(main).append(h("div", { class: "scan" }, h("div", { class: "notice", role: "alert" },
      h("p", { class: "notice__text" }, "This page could not be shown. Reload it, or open another tab."))));
  }
  document.title = `${route.title} | Footprint HFT detector`;
  for (const link of links) {
    if (link.dataset.route === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (moveFocus) focusHeading();
}

// ------------------------------------------------------------------ theme
function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  const dark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const button = document.getElementById("theme");
  button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  clear(button).append(icon(dark ? "sun" : "moon"));
}

document.getElementById("theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage can be blocked. The theme still changes for this visit.
  }
  applyTheme(next);
});

// The skip link must not change the hash, because the hash is the router.
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});

applyTheme(storedTheme());
window.addEventListener("hashchange", () => {
  if (location.hash && !location.hash.startsWith("#/")) return;
  show({ moveFocus: true });
});
show({ moveFocus: false });
