"""
services/strategies/strategy_registry.py
------------------------------------------
Maps strategy key → strategy class.
Add new strategies here as they are built.
"""
from services.strategies.ema_crossover_strategy import EmaCrossoverStrategy
from services.strategies.x2_strategy            import X2Strategy

STRATEGY_REGISTRY = {
    'EMA Crossover': EmaCrossoverStrategy,
    'Arsalan X2':    X2Strategy,
}

STRATEGY_META = {
    'EMA Crossover': {'label': 'EMA Crossover', 'ready': True},
    'Arsalan X2':    {'label': 'Arsalan X2',    'ready': True},
}


def get_strategy(key: str):
    """Return an instantiated strategy for the given key."""
    cls = STRATEGY_REGISTRY.get(key)
    if not cls:
        raise ValueError(f"Unknown strategy: {key!r}. Available: {list(STRATEGY_REGISTRY)}")
    return cls()
