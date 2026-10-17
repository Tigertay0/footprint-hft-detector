"""Input rules shared by the web app and the watcher."""
import re

from errors import UserError

TICKER_PATTERN = re.compile(r"^[A-Z0-9^][A-Z0-9.\-=]{0,11}$")
NTFY_TOPIC_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,64}$")     # the topic is the only secret, so it must not be guessable
MAX_WATCHLIST = 25                      # one batched Yahoo request per poll stays polite up to about this many


def normalize_ticker(raw: str) -> str:
    """Upper-case a ticker and check it. Raises UserError for anything Yahoo would not accept as a symbol."""
    ticker = raw.strip().upper()
    if not TICKER_PATTERN.match(ticker) or ".." in ticker:
        raise UserError(f"'{raw.strip()[:20]}' is not a valid ticker. Use letters and digits, such as TSLA or BRK-B.")
    return ticker
