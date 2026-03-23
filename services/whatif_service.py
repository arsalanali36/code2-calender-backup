"""
services/whatif_service.py
--------------------------
What-If simulation engine.

Rules:
  - No hindsight bias — forward candle-by-candle from entry time only
  - No optimisation — fixed target/SL as given by user
  - Trail: move SL to break-even when price moves trail_trigger pts in our favour
  - Direction detected from TradeType, but can be overridden per-run
"""
import pandas as pd


# ── Public API ────────────────────────────────────────────────────────────────

def simulate_trades(trades, ohlc_map, params):
    """
    trades   : list of trade dicts (from trades.json)
    ohlc_map : { (instrument, date) : DataFrame }
    params   : { target_pts, sl_pts, trail_trigger_pts, timeframe, direction }

    Returns list of trade dicts enriched with '_sim' result dict.
    """
    results = []
    for trade in trades:
        symbol = trade.get('Instrument', '')
        date   = trade.get('date', trade.get('trade_date', ''))
        ohlc   = ohlc_map.get((symbol, date))

        if ohlc is None or ohlc.empty:
            results.append({**trade, '_sim': None, '_error': 'no_ohlc'})
            continue

        candles = _resample(ohlc, int(params.get('timeframe', 1)))
        sim     = simulate_one_trade(trade, candles, params)
        results.append({**trade, '_sim': sim})

    return results


def simulate_one_trade(trade, candles, params):
    """
    Simulate a single trade.  Returns a result dict.

    For SHORT (TradeType = 'sell'):
        entry  = Sell Price (Avg)   exit_actual = Buy Price (Avg)
        profit direction = price drops
        Target hit → LOW  <= entry - target
        SL hit     → HIGH >= entry + sl     (or entry if trail active)

    For LONG (TradeType = 'buy'):
        entry  = Buy Price (Avg)    exit_actual = Sell Price (Avg)
        profit direction = price rises
        Target hit → HIGH >= entry + target
        SL hit     → LOW  <= entry - sl     (or entry if trail active)
    """
    # ── Direction & prices ────────────────────────────────────────────────────
    direction = (params.get('direction') or '').lower()
    if not direction:
        direction = 'short' if trade.get('TradeType', 'sell').lower() == 'sell' else 'long'

    target     = float(params.get('target_pts', 30))
    sl         = float(params.get('sl_pts', 15))
    trail_trig = float(params.get('trail_trigger_pts', 0))   # 0 = disabled
    qty        = float(trade.get('Qty', 1))

    if direction == 'short':
        entry_price = float(trade.get('Sell Price (Avg)', 0) or 0)
        exit_actual = float(trade.get('Buy Price (Avg)',  0) or 0)
        entry_time  = str(trade.get('Sell Time', '09:15:00'))
        actual_pts  = entry_price - exit_actual
    else:
        entry_price = float(trade.get('Buy Price (Avg)',  0) or 0)
        exit_actual = float(trade.get('Sell Price (Avg)', 0) or 0)
        entry_time  = str(trade.get('Buy Time',  '09:15:00'))
        actual_pts  = exit_actual - entry_price

    actual_pnl = round(actual_pts * qty, 2)

    # ── Candles from entry time ───────────────────────────────────────────────
    if 'time' not in candles.columns:
        candles = candles.copy()
        candles['time'] = pd.to_datetime(candles['datetime']).dt.strftime('%H:%M:%S')

    entry_time_hms = entry_time[:8]  # ensure HH:MM:SS
    subset = candles[candles['time'] >= entry_time_hms].reset_index(drop=True)

    if subset.empty:
        return _result(actual_pnl, actual_pts, None, 0, 0, 'no_candles', False)

    # ── OHLC sanity check: warn if candle prices are far from entry price ─────
    # This detects wrong-strike OHLC (e.g., ATM fetched instead of OTM/ITM).
    first_open = float(subset.iloc[0]['open'])
    if entry_price > 0 and abs(first_open - entry_price) / entry_price > 0.20:
        return _result(actual_pnl, actual_pts, None, 0, 0, 'ohlc_mismatch', False)

    # ── Walk forward ──────────────────────────────────────────────────────────
    mfe = 0.0          # max favourable excursion (points)
    mae = 0.0          # max adverse excursion (points)
    planned_pts  = None
    exit_reason  = 'eod'
    exit_time    = None
    trail_active = False
    current_sl   = sl  # distance from entry at which SL fires

    for _, candle in subset.iterrows():
        h = float(candle['high'])
        l = float(candle['low'])

        if direction == 'short':
            fav = entry_price - l
            adv = h - entry_price
        else:
            fav = h - entry_price
            adv = entry_price - l

        mfe = max(mfe, fav)
        mae = max(mae, adv)

        # Activate trail → move SL to break-even
        if trail_trig > 0 and not trail_active and mfe >= trail_trig:
            trail_active = True
            current_sl   = 0          # SL now at entry price

        # Check SL first — if both SL and target are hit within the same candle,
        # assume SL hit first (pessimistic / realistic assumption).
        if direction == 'short':
            if h >= entry_price + current_sl:
                planned_pts = -current_sl
                exit_reason = 'trail_sl' if trail_active else 'sl'
                exit_time   = str(candle.get('time', ''))[:5]
                break
            if l <= entry_price - target:
                planned_pts = target
                exit_reason = 'target'
                exit_time   = str(candle.get('time', ''))[:5]
                break
        else:
            if l <= entry_price - current_sl:
                planned_pts = -current_sl
                exit_reason = 'trail_sl' if trail_active else 'sl'
                exit_time   = str(candle.get('time', ''))[:5]
                break
            if h >= entry_price + target:
                planned_pts = target
                exit_reason = 'target'
                exit_time   = str(candle.get('time', ''))[:5]
                break

    # EOD — neither target nor SL hit
    if planned_pts is None:
        last = subset.iloc[-1]
        last_close  = float(last['close'])
        planned_pts = (entry_price - last_close) if direction == 'short' else (last_close - entry_price)
        exit_time   = str(last.get('time', ''))[:5]

    # Planned exit price (for charge calculation in route)
    if direction == 'short':
        planned_exit_price = entry_price - planned_pts
    else:
        planned_exit_price = entry_price + planned_pts

    return _result(actual_pnl, actual_pts, planned_pts, mfe, mae, exit_reason, trail_active, qty, exit_time,
                   entry_price, planned_exit_price, direction)


def summary_stats(results):
    """Aggregate summary across all simulated trades."""
    _bad = {'no_candles', 'ohlc_mismatch'}
    sim_ok  = [r for r in results if r.get('_sim') and r['_sim']['exit_reason'] not in _bad]
    no_ohlc = len(results) - len(sim_ok)

    if not sim_ok:
        return {'total_trades': 0, 'no_ohlc_count': no_ohlc}

    actual_total  = sum(r['_sim']['actual_pnl']  for r in sim_ok)
    planned_total = sum(r['_sim']['planned_pnl'] for r in sim_ok)
    effs = [r['_sim']['efficiency'] for r in sim_ok if r['_sim']['efficiency'] is not None]

    return {
        'total_trades':   len(sim_ok),
        'actual_pnl':     round(actual_total,  2),
        'planned_pnl':    round(planned_total, 2),
        'missed_pnl':     round(planned_total - actual_total, 2),
        'avg_efficiency': round(sum(effs) / len(effs), 1) if effs else None,
        'target_hits':    sum(1 for r in sim_ok if r['_sim']['exit_reason'] == 'target'),
        'sl_hits':        sum(1 for r in sim_ok if r['_sim']['exit_reason'] == 'sl'),
        'trail_sl_hits':  sum(1 for r in sim_ok if r['_sim']['exit_reason'] == 'trail_sl'),
        'eod_exits':      sum(1 for r in sim_ok if r['_sim']['exit_reason'] == 'eod'),
        'no_ohlc_count':  no_ohlc,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resample(df, mins):
    if mins <= 1:
        return df
    df = df.copy()
    df['datetime'] = pd.to_datetime(df['datetime'])
    df = df.set_index('datetime')
    rs = df.resample(f'{mins}min').agg(
        open=('open', 'first'), high=('high', 'max'),
        low=('low', 'min'),    close=('close', 'last'),
        volume=('volume', 'sum')
    ).dropna(subset=['open']).reset_index()
    rs['time'] = rs['datetime'].dt.strftime('%H:%M:%S')
    return rs


def _result(actual_pnl, actual_pts, planned_pts, mfe, mae, exit_reason, trail_active, qty=1, exit_time=None,
            entry_price=None, planned_exit_price=None, direction=None):
    planned_pnl = round(planned_pts * qty, 2) if planned_pts is not None else None
    efficiency  = round((actual_pts / mfe) * 100, 1) if (mfe and mfe > 0) else None
    missed_pts  = round(planned_pts - actual_pts, 2) if planned_pts is not None else None
    return {
        'actual_pnl':         actual_pnl,
        'actual_pts':         round(actual_pts, 2),
        'planned_pnl':        planned_pnl,
        'planned_pts':        round(planned_pts, 2) if planned_pts is not None else None,
        'mfe':                round(mfe, 2),
        'mae':                round(mae, 2),
        'efficiency':         efficiency,
        'missed_pts':         missed_pts,
        'exit_reason':        exit_reason,
        'trail_triggered':    trail_active,
        'exit_time':          exit_time,
        'entry_price':        entry_price,
        'planned_exit_price': planned_exit_price,
        'direction':          direction,
    }
