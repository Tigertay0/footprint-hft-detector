// Thin wrapper around the JSON API.

const SCAN_TIMEOUT_MS = 120000;
const REQUEST_TIMEOUT_MS = 20000;
const POLL_FAILURES_BEFORE_ERROR = 3;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function detailText(body, status) {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).filter(Boolean).join(". ") || `The request was not valid (${status}).`;
  return `The request failed (${status}).`;
}

async function request(path, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  let response;
  try {
    response = await fetch(path, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const slow = error?.name === "TimeoutError";
    throw new ApiError(slow ? "The server took too long to answer. Try again." : "Cannot reach the app server. Check that it is still running.", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(detailText(body ?? {}, response.status), response.status);
  // A proxy or captive portal can answer 200 with a web page. That is a failure, not an empty result.
  if (body === null) throw new ApiError("The server sent a reply this page cannot read. Try again.", response.status);
  return body;
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  market: () => request("/api/market"),
  alerts: (ticker) => request(`/api/alerts?limit=100${ticker ? `&ticker=${encodeURIComponent(ticker)}` : ""}`),
  watcher: () => request("/api/watcher"),
  scan: (form) => request("/api/scan", { method: "POST", body: form }, SCAN_TIMEOUT_MS),
  startReplay: (body) => request("/api/replay", json(body), SCAN_TIMEOUT_MS),
  startEvaluate: (body) => request("/api/evaluate", json(body)),
  startLive: (body) => request("/api/live", json(body), SCAN_TIMEOUT_MS),
  job: (id, since = 0) => request(`/api/jobs/${encodeURIComponent(id)}?since=${since}`),
  stopJob: (id) => request(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null),
};

/**
 * Poll a job until the server says it is no longer running. `onUpdate` receives every payload, with
 * `events` holding only entries not delivered before. A few failed requests in a row are tolerated.
 * Returns a function that cancels polling.
 */
export function pollJob(jobId, onUpdate, { intervalMs = 400 } = {}) {
  let since = 0;
  let cancelled = false;
  let failures = 0;
  let timer = 0;

  async function tick() {
    if (cancelled) return;
    let payload;
    try {
      payload = await api.job(jobId, since);
      failures = 0;
    } catch (error) {
      if (cancelled) return;
      failures += 1;
      if (failures >= POLL_FAILURES_BEFORE_ERROR) {
        onUpdate({ status: "error", error: error.message, events: [], progress: {} });
        return;
      }
      timer = setTimeout(tick, intervalMs * 2);
      return;
    }
    if (cancelled) return;
    since = payload.next;
    try {
      onUpdate(payload);
    } catch (error) {
      console.error(error);
      onUpdate({ status: "error", error: "The page hit a problem while showing this result.", events: [], progress: {} });
      return;
    }
    if (payload.status === "running") timer = setTimeout(tick, intervalMs);
  }
  tick();
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
