"""
services/strategies/x2_strategy.py
-------------------------------------
Arsalan X2 strategy for the algo engine.
Wraps run_x2_common_strategy_logic() from strategy_service.py
and converts the candle-list format to a pandas DataFrame.

Params accepted via generate_signal(candles, params):
  hawa_me_zone  (bool, default False)
  use_fresh_zone (bool, default True)

Returns BUY/SELL signal on the last COMPLETED candle (index -2).
SL = last matching zone's low (BUY) or high (SELL).

Note: X2 requires daily_pivot_levels.json to have today's levels
for zone/level logic to fire correctly.
"""
from datetime import datetime, date as _date

from services.strategies.base_strategy import BaseStrategy


def _candles_to_df(candles, trade_date=None):
    """Convert list of {time, open, high, low, close, vol} to pandas DataFrame."""
    import pandas as pd
    if trade_date is None:
        trade_date = _date.today().isoformat()
    records = []
    for c in candles:
        dt = datetime.strptime(f"{trade_date} {c['time']}", '%Y-%m-%d %H:%M')
        records.append({
            'datetime': dt,
            'Open':     c['open'],
            'High':     c['high'],
            'Low':      c['low'],
            'Close':    c['close'],
            'Volume':   c.get('vol', 0),
        })
    df = pd.DataFrame(records)
    df.set_index('datetime', inplace=True)
    return df


class X2Strategy(BaseStrategy):

    @property
    def name(self) -> str:
        return 'Arsalan X2'

    def default_params(self) -> dict:
        return {'hawa_me_zone': False, 'use_fresh_zone': True}

    def generate_signal(self, candles: list, params: dict = None) -> tuple:
        # Minimum candles for X2 to produce meaningful output
        if len(candles) < 30:
            return None, candles[-1]['close'] if candles else None, None

        p              = {**self.default_params(), **(params or {})}
        hawa_me_zone   = bool(p.get('hawa_me_zone', False))
        use_fresh_zone = bool(p.get('use_fresh_zone', True))

        from services.strategy_service import run_x2_common_strategy_logic

        trade_date = _date.today().isoformat()
        df         = _candles_to_df(candles, trade_date)

        result_df, final_zones = run_x2_common_strategy_logic(
            df, hawa_me_zone=hawa_me_zone, use_fresh_zone=use_fresh_zone
        )

        # Need at least 2 rows: last completed = -2 (skip forming candle at -1)
        if len(result_df) < 2:
            return None, None, None

        last  = result_df.iloc[-2]
        price = float(last['Close'])

        if last.get('bull_trigger'):
            bull_zones = [z for z in final_zones if z['type'] == 'bull']
            sl = float(bull_zones[-1]['low']) if bull_zones else round(price * 0.995, 2)
            return 'BUY', price, sl

        if last.get('bear_trigger'):
            bear_zones = [z for z in final_zones if z['type'] == 'bear']
            sl = float(bear_zones[-1]['high']) if bear_zones else round(price * 1.005, 2)
            return 'SELL', price, sl

        return None, price, None
