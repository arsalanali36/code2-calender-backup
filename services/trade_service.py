"""
trade_service.py
----------------
Thin wrapper around data_processors load/save functions.
All route handlers read/write trades exclusively through here.
"""

from processors.data_processors import load_trades as _load, save_trades_to_file as _save


def get_all_trades():
    """Return the full trades payload dict: {trades, columns, dayData, ...}"""
    return _load()


def save_trades(data: dict):
    """Persist the trades payload. Raises if data is missing 'trades' key."""
    if not isinstance(data, dict) or 'trades' not in data:
        raise ValueError("Payload must be a dict with a 'trades' key")
    _save(data)
