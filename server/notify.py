"""Push notifications through ntfy (https://ntfy.sh), or a self-hosted ntfy server.

Messages go out as JSON to the server root, which keeps non-ASCII text intact in titles and bodies.
The topic works like a password for who can read the alerts, so it is never written to the logs.
"""
from __future__ import annotations

import http.client
import ipaddress
import json
import logging
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

from errors import UserError
from validation import NTFY_TOPIC_PATTERN

log = logging.getLogger("footprint.notify")

DEFAULT_SERVER = "https://ntfy.sh"
RETRY_STATUS = {429, 500, 502, 503, 504}


MAX_RETRY_AFTER = 10.0


def _retry_after(exc: urllib.error.HTTPError) -> float:
    try:
        return float(exc.headers.get("Retry-After", 0)) if exc.headers else 0.0
    except (TypeError, ValueError):
        return 0.0


def _error_text(exc: urllib.error.HTTPError) -> str:
    """The server's own explanation (for example 'topic not found'), shortened. It never contains our topic."""
    try:
        return exc.read(300).decode("utf-8", "replace").replace("\n", " ")
    except Exception:                                  # noqa: BLE001 - the body is only a log aid
        return "(no details)"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect would re-send the Authorization header to another host, so treat it as a failure."""

    def redirect_request(self, *args: object, **kwargs: object) -> None:
        return None


_open_without_redirects = urllib.request.build_opener(_NoRedirect).open


def _is_local_host(host: str) -> bool:
    """Plain http is only acceptable on the same machine or the home network."""
    if host in ("localhost", "") or "." not in host and ":" not in host:
        return True                                    # localhost, or a bare LAN name such as 'nuc'
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    return address.is_loopback or address.is_private


@dataclass(frozen=True)
class Message:
    title: str
    body: str
    priority: int = 3                   # ntfy: 1 min, 2 low, 3 default, 4 high, 5 urgent
    tags: tuple[str, ...] = ()
    click: str | None = None            # page opened when the notification is tapped


class Notifier(Protocol):
    def send(self, message: Message) -> bool: ...


class NtfyNotifier:
    def __init__(self, topic: str, server: str = DEFAULT_SERVER, token: str | None = None, *,
                 timeout: float = 10.0, retries: int = 3, backoff: float = 2.0,
                 opener: Callable[..., object] = _open_without_redirects,
                 sleep: Callable[[float], None] = time.sleep) -> None:
        if not NTFY_TOPIC_PATTERN.match(topic or ""):
            raise UserError("The ntfy topic must be 16 to 64 letters, digits, dashes or underscores.")
        parsed = urlparse(server)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise UserError("The ntfy server must be a web address starting with https://.")
        if parsed.scheme == "http" and not _is_local_host(parsed.hostname or ""):
            raise UserError("The ntfy server must use https:// unless it is on this machine or your home network.")
        self._topic, self._server, self._token = topic, server.rstrip("/"), token
        self._timeout, self._retries, self._backoff = timeout, retries, backoff
        self._open, self._sleep = opener, sleep

    def send(self, message: Message) -> bool:
        """Deliver one message. Returns True once the server accepted it, False after the retries run out."""
        payload: dict[str, object] = {
            "topic": self._topic, "title": message.title, "message": message.body,
            "priority": message.priority, "tags": list(message.tags),
        }
        if message.click:
            payload["click"] = message.click
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        request = urllib.request.Request(self._server, data=json.dumps(payload).encode(), headers=headers, method="POST")
        for attempt in range(1, self._retries + 1):
            wait = self._backoff * attempt
            try:
                with self._open(request, timeout=self._timeout) as response:    # type: ignore[operator]
                    if 200 <= response.status < 300 and self._accepted(response.read(65536)):
                        return True
                    log.error("ntfy answered %s but not with a delivery receipt", response.status)
            except urllib.error.HTTPError as exc:
                log.error("ntfy rejected the message (HTTP %s): %s", exc.code, _error_text(exc))
                if exc.code not in RETRY_STATUS:
                    return False                  # a bad topic, token, redirect or payload will not fix itself
                wait = max(wait, min(_retry_after(exc), MAX_RETRY_AFTER))
            except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException, ValueError) as exc:
                log.error("could not reach the ntfy server (%s: %s)", type(exc).__name__, getattr(exc, "reason", exc))
            if attempt < self._retries:
                self._sleep(wait)
        return False

    def _accepted(self, body: bytes) -> bool:
        """A 200 alone proves little: a captive portal or proxy also answers 200. ntfy's reply names the topic and an id."""
        try:
            receipt = json.loads(body)
        except ValueError:
            return False
        return isinstance(receipt, dict) and receipt.get("event") == "message" and bool(receipt.get("id")) \
            and receipt.get("topic") == self._topic


class DryRunNotifier:
    """Prints messages instead of sending them. For trying the watcher without a phone."""

    def __init__(self, out: Callable[[str], None] = print) -> None:
        self._out = out

    def send(self, message: Message) -> bool:
        self._out(f"[dry run] priority {message.priority} | {message.title}\n{message.body}\n")
        return True
