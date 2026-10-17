"""Keeps the watcher running, and tells your phone if it cannot.

run-watcher.bat starts this instead of the watcher. It imports only the standard library plus the
small notify module (no pandas), so it still works when the watcher itself crashes on startup, for
example after a broken package install. A watcher that dies silently would look like a quiet market.
"""
from __future__ import annotations

import logging
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path

from errors import SETUP_PROBLEM_EXIT
from notify import Message, Notifier, load_env_file, notifier_from_env

log = logging.getLogger("footprint.supervisor")
ROOT = Path(__file__).resolve().parent.parent

FIRST_DELAY = 15.0
MAX_DELAY = 300.0
QUICK_CRASH_SECONDS = 60.0     # exits sooner than this back off harder
STABLE_SECONDS = 600.0         # a run this long counts as healthy and resets the crash count
CRASHES_BEFORE_NOTICE = 3


def supervise(run: Callable[[], int], notifier: Notifier | None, *, sleep: Callable[[float], None] = time.sleep,
              clock: Callable[[], float] = time.monotonic, max_runs: int | None = None) -> int:
    """Runs the watcher again each time it exits. Returns the exit code that ended supervision."""
    crashes, delay, alerted, runs = 0, FIRST_DELAY, False, 0

    def tell(title: str, body: str) -> None:
        if notifier is None or not notifier.send(Message(title, body, 4, ("rotating_light",))):
            log.error("could not send the notice: %s", title)

    while max_runs is None or runs < max_runs:
        runs += 1
        started = clock()
        code = run()
        lasted = clock() - started
        if code == 0:
            log.info("the watcher stopped on request")
            return 0
        if code == SETUP_PROBLEM_EXIT:
            tell("Footprint cannot start", "A setting is wrong (watcher.json or watcher.env). Alerts are OFF. See data\\logs\\watcher.log.")
            return SETUP_PROBLEM_EXIT
        # Any exit before a stable run counts: a watcher that dies a few minutes after each start is still down.
        crashes = crashes + 1 if lasted < STABLE_SECONDS else 1
        log.error("the watcher exited with code %s after %.0f seconds (%s failures in a row)", code, lasted, crashes)
        if lasted >= STABLE_SECONDS:
            alerted, delay = False, FIRST_DELAY
        elif crashes >= CRASHES_BEFORE_NOTICE and not alerted:
            alerted = True
            tell("Footprint watcher keeps crashing", f"It stopped {crashes} times in a row (exit code {code}). Alerts are OFF. See data\\logs\\watcher.log.")
        sleep(delay)
        delay = min(delay * 2, MAX_DELAY) if lasted < QUICK_CRASH_SECONDS else FIRST_DELAY
    return 1


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    notifier: Notifier | None = None
    try:
        env = load_env_file(ROOT / "watcher.env")
        if env.get("NTFY_TOPIC"):
            notifier = notifier_from_env(env)
    except ValueError as exc:                          # UserError: a setting the owner has to fix
        log.error("notifications are not set up: %s", exc)
    command = [sys.executable, str(ROOT / "server" / "watcher.py")]
    return supervise(lambda: subprocess.run(command, cwd=ROOT, check=False).returncode, notifier)


if __name__ == "__main__":
    sys.exit(main())
