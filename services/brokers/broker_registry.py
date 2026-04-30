"""
services/brokers/broker_registry.py
-------------------------------------
Maps broker key → broker class.
Add new brokers here as they are implemented.
"""
from services.brokers.dhan_broker    import DhanBroker
from services.brokers.zerodha_broker import ZerodhaBroker
from services.brokers.angel_broker   import AngelBroker

BROKER_REGISTRY = {
    'dhan':    DhanBroker,
    'zerodha': ZerodhaBroker,
    'angel':   AngelBroker,
}

BROKER_META = {
    'dhan':    {'label': 'Dhan',         'ready': True},
    'zerodha': {'label': 'Zerodha Kite', 'ready': False},
    'angel':   {'label': 'Angel One',    'ready': False},
}


def get_broker(key: str):
    """Return an instantiated broker for the given key."""
    cls = BROKER_REGISTRY.get(key)
    if not cls:
        raise ValueError(f"Unknown broker: {key!r}. Available: {list(BROKER_REGISTRY)}")
    return cls()
