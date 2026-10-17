"""Errors whose message is safe and useful to show to the person using the app."""


class UserError(ValueError):
    """A problem the user can act on (bad ticker, bad file, too little data). Any other exception
    is shown as a generic message and written to the server log instead."""
