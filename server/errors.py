"""Errors whose message is safe and useful to show to the person using the app."""

SETUP_PROBLEM_EXIT = 2      # the watcher exits with this when its settings are wrong; the supervisor then stops restarting it


class UserError(ValueError):
    """A problem the user can act on (bad ticker, bad file, too little data). Any other exception
    is shown as a generic message and written to the server log instead."""
