"""
services/strategies/ema_crossover_strategy.py
-----------------------------------------------
EMA fast/slow crossover — ported from algo_engine._detect_signal().
Params accepted via generate_signal(candles, params):
  ema_fast (int, default 9)
  ema_slow (int, default 20)
"""
from services.strategies.base_strategy import BaseStrategy


def _calc_ema(closes, period):
    if len(closes) < period:
        return [None] * len(closes)
    k = 2.0 / (period + 1)
    result = [None] * (period - 1)
    seed = sum(closes[:period]) / period
    result.append(seed)
    for price in closes[period:]:
        result.append(price * k + result[-1] * (1 - k))
    return result


class EmaCrossoverStrategy(BaseStrategy):

    @property
    def name(self) -> str:
        return 'EMA Crossover'

    def default_params(self) -> dict:
        return {'ema_fast': 9, 'ema_slow': 20}

    def generate_signal(self, candles: list, params: dict = None) -> tuple:
        p     = {**self.default_params(), **(params or {})}
        fast  = int(p['ema_fast'])
        slow  = int(p['ema_slow'])

        min_needed = slow + 3
        if len(candles) < min_needed:
            cmp   = candles[-1]['close'] if candles else None
            ctime = candles[-1]['time']  if candles else '--'
            return None, cmp, None

        closes = [c['close'] for c in candles]
        ef = _calc_ema(closes, fast)
        es = _calc_ema(closes, slow)

        # -2 = last confirmed candle, -3 = one before
        i, j = len(closes) - 2, len(closes) - 3
        if any(v is None for v in [ef[i], es[i], ef[j], es[j]]):
            return None, closes[-1], None

        curr_above = ef[i] > es[i]
        prev_above = ef[j] > es[j]
        price      = closes[i]

        if not prev_above and curr_above:
            return 'BUY',  price, None
        if prev_above and not curr_above:
            return 'SELL', price, None
        return None, price, None
