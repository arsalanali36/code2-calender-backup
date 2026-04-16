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


# ── Brokerage calculation ─────────────────────────────────────────────────────

def net_pnl(buy_price, sell_price, qty, broker='', fill_count=2):
    """Mirror of JS computeTradeCharges — returns (gross, fees, net)."""
    if not buy_price or not sell_price or not qty:
        return None, None, None
    buy_price  = float(buy_price)
    sell_price = float(sell_price)
    qty        = float(qty)
    fill_count = max(int(fill_count or 0), 2)
    broker     = str(broker).lower().strip()

    buy_turn  = buy_price  * qty
    sell_turn = sell_price * qty
    total     = buy_turn + sell_turn

    stt   = sell_turn * 0.001
    exch  = total * 0.0003503
    sebi  = total * 0.000001
    stamp = buy_turn * 0.00003

    brokerage = fill_count * 20
    if broker == 'dhan':
        ipft          = total * 0.000001
        gst           = (brokerage + exch + sebi + ipft) * 0.18
        other_charges = stt + exch + sebi + ipft + stamp + gst
    else:
        gst           = (brokerage + exch + sebi) * 0.18
        other_charges = stt + exch + sebi + stamp + gst

    gross = round((sell_price - buy_price) * qty, 2)
    net   = round(gross - (brokerage + other_charges), 2)
    fees  = round(brokerage + other_charges, 2)
    return gross, fees, net


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


# ── Route business-logic helpers (extracted from whatif_routes) ───────────────

def parse_tradebook_csv(content):
    """
    Parse a Zerodha F&O tradebook CSV string.
    Returns (expiry_map, queue) where:
      expiry_map : {symbol → actual_expiry YYYY-MM-DD}
      queue      : [{symbol, trade_date, expiry_date, entry_time}]
    Raises ValueError if structure is invalid or no options found.
    """
    import io, csv as _csv
    from datetime import datetime as _dt

    reader = _csv.DictReader(io.StringIO(content))
    fields = reader.fieldnames or []
    fl     = [h.strip().lower() for h in fields]

    def _col(*names):
        for n in names:
            for i, h in enumerate(fl):
                if h == n or h.replace(' ', '_') == n:
                    return fields[i]
        return None

    sym_col    = _col('tradingsymbol', 'symbol', 'trading_symbol')
    expiry_col = _col('expiry_date', 'expiry date', 'expiry')
    date_col   = _col('trade_date', 'order_execution_time', 'date')
    time_col   = _col('order_execution_time', 'trade_time', 'time')

    if not sym_col or not expiry_col:
        raise ValueError(f'Cannot find symbol/expiry columns. Got: {fields}')

    def _norm_date(s):
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%b-%Y', '%Y-%m-%d %H:%M:%S'):
            try:
                return _dt.strptime(s.strip(), fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
        return s.strip()[:10]

    def _norm_time(s):
        s = s.strip()
        if ' ' in s:
            s = s.split(' ', 1)[1]
        return s[:5]

    expiry_map = {}
    pairs_seen = {}

    for row in reader:
        sym    = str(row.get(sym_col, '') or '').strip().upper()
        expiry = str(row.get(expiry_col, '') or '').strip()
        if not sym or not expiry or expiry.lower() in ('nan', 'none', '', '-'):
            continue
        if not (sym.endswith('CE') or sym.endswith('PE')):
            continue

        expiry = _norm_date(expiry)
        expiry_map[sym] = expiry

        trade_date = ''
        if date_col:
            raw = str(row.get(date_col, '') or '').strip()
            trade_date = _norm_date(raw) if raw else ''

        entry_time = ''
        if time_col:
            raw = str(row.get(time_col, '') or '').strip()
            if raw:
                entry_time = _norm_time(raw)

        if trade_date:
            key = (sym, trade_date)
            if key not in pairs_seen:
                pairs_seen[key] = {
                    'symbol':      sym,
                    'trade_date':  trade_date,
                    'expiry_date': expiry,
                    'entry_time':  entry_time,
                }

    if not expiry_map:
        raise ValueError('No option symbols with expiry dates found in file')

    return expiry_map, list(pairs_seen.values())


def collect_trade_pairs(trades, date_from='', date_to=''):
    """
    From a trade list, build:
      sym_date_map : {symbol → earliest trade date}  (used for auto-mapping)
      pairs        : [{symbol, date, entry_time}]     (used for OHLC sync)
    Applies optional date range filter.
    """
    if date_from:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) >= date_from]
    if date_to:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) <= date_to]

    sym_date_map = {}
    pairs        = []
    seen_pairs   = set()

    for t in trades:
        sym  = t.get('Instrument', '')
        date = t.get('date', t.get('trade_date', ''))
        if not sym or not date:
            continue
        if sym not in sym_date_map or date < sym_date_map[sym]:
            sym_date_map[sym] = date
        key = (sym, date)
        if key not in seen_pairs:
            seen_pairs.add(key)
            tt = t.get('TradeType', 'sell').lower()
            entry_time = str(t.get('Sell Time' if tt == 'sell' else 'Buy Time', '') or '')[:8]
            pairs.append({'symbol': sym, 'date': date, 'entry_time': entry_time})

    return sym_date_map, pairs


def apply_confidence_mapping(results, existing_mapping):
    """
    Apply auto_map results to an existing symbol mapping dict.
    Saves entries with confidence >= 70, removes stale expired-option entries.
    Returns (updated_mapping, saved_count).
    """
    mapping = dict(existing_mapping)
    saved   = 0
    for sym, res in results.items():
        if res.get('expired_opt'):
            mapping.pop(sym, None)
            continue
        if res.get('confidence', 0) >= 70 and res.get('security_id'):
            mapping[sym] = {
                'security_id':      res['security_id'],
                'exchange_segment': res['exchange_segment'],
                'instrument':       res['instrument'],
            }
            saved += 1
    return mapping, saved


def format_simulation_output(results, net_pnl_fn):
    """
    Convert simulate_trades output → API response shape.
    Assigns T1/T2/… numbers per (instrument, date) in time order.
    net_pnl_fn: callable matching net_pnl(buy_p, sell_p, qty, broker, fill_count) → (gross, fees, net)
    """
    trade_seq = {}
    out       = []
    for r in results:
        sim        = r.get('_sim')
        tt         = r.get('TradeType', 'sell').lower()
        inst       = r.get('Instrument', '')
        date       = r.get('date', r.get('trade_date', ''))
        qty        = r.get('Qty', 1)
        broker     = r.get('Broker', '')
        fill_count = r.get('fill_count', 2)
        key        = (inst, date)
        trade_seq[key] = trade_seq.get(key, 0) + 1
        t_num      = f"T{trade_seq[key]}"

        actual_net  = r.get('Net P/L')
        planned_net = None
        if sim and sim.get('planned_exit_price') is not None:
            ep    = sim['entry_price']
            xp    = sim['planned_exit_price']
            dir_  = sim['direction']
            buy_p  = xp if dir_ == 'short' else ep
            sell_p = ep if dir_ == 'short' else xp
            _, _, planned_net = net_pnl_fn(buy_p, sell_p, qty, broker, fill_count)

        missed_net = None
        if planned_net is not None and actual_net is not None:
            missed_net = round(planned_net - actual_net, 2)

        out.append({
            'date':             date,
            'time':             r.get('Sell Time') if tt == 'sell' else r.get('Buy Time', ''),
            'actual_exit_time': r.get('Buy Time',  '') if tt == 'sell' else r.get('Sell Time', ''),
            'instrument':       inst,
            't_num':            t_num,
            'direction':        'SHORT' if tt == 'sell' else 'LONG',
            'entry':            r.get('Sell Price (Avg)') if tt == 'sell' else r.get('Buy Price (Avg)'),
            'exit_actual':      r.get('Buy Price (Avg)') if tt == 'sell' else r.get('Sell Price (Avg)'),
            'qty':              qty,
            'tags':             r.get('tags', []),
            'actual_pnl':       sim['actual_pnl']      if sim else None,
            'actual_net':       actual_net,
            'actual_pts':       sim['actual_pts']       if sim else None,
            'planned_pnl':      sim['planned_pnl']      if sim else None,
            'planned_net':      planned_net,
            'planned_pts':      sim['planned_pts']      if sim else None,
            'missed_pts':       sim['missed_pts']       if sim else None,
            'missed_net':       missed_net,
            'mfe':              sim['mfe']               if sim else None,
            'mae':              sim['mae']               if sim else None,
            'efficiency':       sim['efficiency']        if sim else None,
            'exit_reason':      sim['exit_reason']       if sim else 'no_ohlc',
            'exit_time':        sim['exit_time']         if sim else None,
            'trail_triggered':  sim['trail_triggered']   if sim else False,
        })
    return out
