"""
services/algo_engine.py
-----------------------
Paper-trading EMA crossover engine.
Fetches 1-min candles from Dhan, computes EMA fast/slow,
detects crossover at confirmed candle close, manages paper orders.
No real orders are ever sent to Dhan.
"""
import os
import json
import uuid
import time
from datetime import datetime, date, timedelta

from config import (
    ALGO_CONFIG_FILE, ALGO_WATCHLIST_FILE,
    ALGO_ORDERS_FILE, ALGO_STATE_FILE,
)
from services.dhan_service_core import DHAN_API_BASE, _post_json, _dhan_headers, get_config

DEFAULT_CONFIG = {
    "ema_fast":         9,
    "ema_slow":         20,
    "timeframe":        1,
    "entry_mode":       "candle_close",
    "sl_type":          "crossover",
    "daily_loss_limit": 100,
    "qty":              1,
    "running":          False,
}


# ── Config ────────────────────────────────────────────────────────────────────

def get_algo_config():
    if not os.path.exists(ALGO_CONFIG_FILE):
        return DEFAULT_CONFIG.copy()
    with open(ALGO_CONFIG_FILE) as f:
        cfg = json.load(f)
    for k, v in DEFAULT_CONFIG.items():
        cfg.setdefault(k, v)
    return cfg


def save_algo_config(cfg):
    with open(ALGO_CONFIG_FILE, 'w') as f:
        json.dump(cfg, f, indent=2)


# ── Watchlist ─────────────────────────────────────────────────────────────────

def get_watchlist():
    if not os.path.exists(ALGO_WATCHLIST_FILE):
        return []
    with open(ALGO_WATCHLIST_FILE) as f:
        return json.load(f)


def save_watchlist(items):
    with open(ALGO_WATCHLIST_FILE, 'w') as f:
        json.dump(items, f, indent=2)


# ── Orders ────────────────────────────────────────────────────────────────────

def get_orders():
    if not os.path.exists(ALGO_ORDERS_FILE):
        return []
    with open(ALGO_ORDERS_FILE) as f:
        return json.load(f)


def save_orders(orders):
    with open(ALGO_ORDERS_FILE, 'w') as f:
        json.dump(orders, f, indent=2)


def clear_orders():
    save_orders([])


# ── Daily State ───────────────────────────────────────────────────────────────

def _get_state():
    today = date.today().isoformat()
    if not os.path.exists(ALGO_STATE_FILE):
        return {"date": today, "daily_pnl": 0.0, "stopped": False}
    with open(ALGO_STATE_FILE) as f:
        s = json.load(f)
    if s.get("date") != today:
        s = {"date": today, "daily_pnl": 0.0, "stopped": False}
    return s


def _save_state(s):
    with open(ALGO_STATE_FILE, 'w') as f:
        json.dump(s, f)


def reset_daily_state():
    today = date.today().isoformat()
    _save_state({"date": today, "daily_pnl": 0.0, "stopped": False})


# ── EMA ───────────────────────────────────────────────────────────────────────

def _calc_ema(closes, period):
    """Returns list of EMA values (None for warm-up bars)."""
    if len(closes) < period:
        return [None] * len(closes)
    k = 2.0 / (period + 1)
    result = [None] * (period - 1)
    seed = sum(closes[:period]) / period
    result.append(seed)
    for price in closes[period:]:
        result.append(price * k + result[-1] * (1 - k))
    return result


# ── Dhan Intraday Fetch ───────────────────────────────────────────────────────

def _fetch_candles(security_id, exchange_segment, instrument, trade_date, dhan_config):
    url = f"{DHAN_API_BASE}/v2/charts/intraday"
    payload = {
        "securityId":      str(security_id),
        "exchangeSegment": exchange_segment,
        "instrument":      instrument,
        "interval":        1,
        "fromDate":        trade_date,
        "toDate":          trade_date,
    }
    resp   = _post_json(url, payload, _dhan_headers(dhan_config))
    opens  = resp.get('open',      []) or []
    highs  = resp.get('high',      []) or []
    lows   = resp.get('low',       []) or []
    closes = resp.get('close',     []) or []
    vols   = resp.get('volume',    []) or []
    stamps = resp.get('timestamp', []) or []

    if not closes:
        return []

    candles = []
    if stamps:
        for i, ts in enumerate(stamps):
            dt = datetime.fromtimestamp(int(ts))
            if dt.strftime('%Y-%m-%d') != trade_date:
                continue
            candles.append({
                'time':  dt.strftime('%H:%M'),
                'open':  float(opens[i])  if i < len(opens)  else 0.0,
                'high':  float(highs[i])  if i < len(highs)  else 0.0,
                'low':   float(lows[i])   if i < len(lows)   else 0.0,
                'close': float(closes[i]),
                'vol':   int(vols[i])     if i < len(vols)   else 0,
            })
    else:
        start = datetime.strptime(f"{trade_date} 09:15", '%Y-%m-%d %H:%M')
        for i, c in enumerate(closes):
            dt = start + timedelta(minutes=i)
            candles.append({
                'time':  dt.strftime('%H:%M'),
                'open':  float(opens[i])  if i < len(opens)  else 0.0,
                'high':  float(highs[i])  if i < len(highs)  else 0.0,
                'low':   float(lows[i])   if i < len(lows)   else 0.0,
                'close': float(c),
                'vol':   int(vols[i])     if i < len(vols)   else 0,
            })
    return candles


# ── Signal Detection ──────────────────────────────────────────────────────────

def _detect_signal(candles, fast, slow):
    """
    Checks the last TWO *completed* candles (skip the forming candle).
    Returns (signal, price, time_str) where signal is 'BUY', 'SELL', or None.
    """
    min_needed = slow + 3
    if len(candles) < min_needed:
        cmp   = candles[-1]['close'] if candles else None
        ctime = candles[-1]['time']  if candles else '--'
        return None, cmp, ctime

    closes = [c['close'] for c in candles]
    ef = _calc_ema(closes, fast)
    es = _calc_ema(closes, slow)

    # -2 = last confirmed candle, -3 = one before it
    i, j = len(closes) - 2, len(closes) - 3
    if ef[i] is None or es[i] is None or ef[j] is None or es[j] is None:
        return None, closes[-1], candles[-1]['time']

    curr_above = ef[i] > es[i]
    prev_above = ef[j] > es[j]
    price      = closes[i]
    sig_time   = candles[i]['time']

    if not prev_above and curr_above:
        return 'BUY',  price, sig_time
    if prev_above and not curr_above:
        return 'SELL', price, sig_time
    return None, price, sig_time


# ── Symbol Resolve (scrip master lookup) ─────────────────────────────────────

def resolve_equity_symbol(symbol):
    """
    Look up NSE_EQ EQUITY security_id for a plain symbol (e.g. 'RELIANCE').
    Returns dict with security_id, exchange_segment, instrument or None.
    """
    from config import DHAN_SCRIP_MASTER
    import os, csv
    if not os.path.exists(DHAN_SCRIP_MASTER):
        return None

    sym_upper = symbol.upper().strip()
    with open(DHAN_SCRIP_MASTER, encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            seg   = (row.get('SEM_EXM_EXCH_ID') or row.get('SEM_SEGMENT') or '').strip()
            instr = (row.get('SEM_INSTRUMENT_NAME') or '').strip()
            tsym  = (row.get('SEM_TRADING_SYMBOL') or row.get('SEM_CUSTOM_SYMBOL') or '').strip().upper()
            sid   = (row.get('SEM_SMST_SECURITY_ID') or row.get('SECURITY_ID') or '').strip()

            # Scrip master stores 'NSE' but Dhan API expects 'NSE_EQ'
            if seg in ('NSE', 'NSE_EQ') and instr == 'EQUITY' and tsym == sym_upper and sid:
                return {
                    'symbol':           sym_upper,
                    'security_id':      sid,
                    'exchange_segment': 'NSE_EQ',
                    'instrument':       'EQUITY',
                }
    return None


# ── Main Tick ─────────────────────────────────────────────────────────────────

def run_tick():
    """
    Run one algo tick across all watchlist symbols.
    Returns summary dict for the frontend.
    """
    cfg = get_algo_config()
    if not cfg.get('running'):
        return {"running": False, "message": "Algo is stopped."}

    state = _get_state()
    if state['stopped']:
        return {
            "running":   False,
            "stopped":   True,
            "message":   f"Daily loss limit hit. Bot paused for today.",
            "daily_pnl": state['daily_pnl'],
        }

    dhan_cfg = get_config()
    if not dhan_cfg:
        return {"error": "Dhan credentials not configured. Please login via Strategy Lab."}

    watchlist = get_watchlist()
    if not watchlist:
        return {"running": True, "message": "Watchlist is empty.", "signals": [], "orders": get_orders()}

    orders  = get_orders()
    today   = date.today().isoformat()
    fast    = cfg['ema_fast']
    slow    = cfg['ema_slow']
    qty     = cfg['qty']
    signals = []

    for item in watchlist:
        symbol = item['symbol']
        sid    = item['security_id']
        seg    = item.get('exchange_segment', 'NSE_EQ')
        instr  = item.get('instrument', 'EQUITY')

        try:
            time.sleep(0.4)  # avoid Dhan rate limit DH-904
            candles = _fetch_candles(sid, seg, instr, today, dhan_cfg)
            if not candles:
                signals.append({"symbol": symbol, "signal": "NO_DATA", "candles": 0})
                continue

            signal, price, sig_time = _detect_signal(candles, fast, slow)

            open_pos = next(
                (o for o in orders if o['symbol'] == symbol and o['status'] == 'OPEN'),
                None,
            )

            if signal == 'BUY' and not open_pos:
                order = {
                    "id":          str(uuid.uuid4())[:8],
                    "symbol":      symbol,
                    "security_id": sid,
                    "side":        "BUY",
                    "entry_price": round(price, 2),
                    "entry_time":  f"{today} {sig_time}",
                    "qty":         qty,
                    "exit_price":  None,
                    "exit_time":   None,
                    "pnl":         None,
                    "status":      "OPEN",
                    "cmp":         round(candles[-1]['close'], 2),
                }
                orders.append(order)
                signals.append({"symbol": symbol, "signal": "BUY", "price": price, "time": sig_time, "candles": len(candles)})

            elif signal == 'SELL' and open_pos:
                pnl = round((price - open_pos['entry_price']) * qty, 2)
                open_pos.update({
                    "exit_price": round(price, 2),
                    "exit_time":  f"{today} {sig_time}",
                    "pnl":        pnl,
                    "status":     "CLOSED",
                    "cmp":        round(candles[-1]['close'], 2),
                })
                state['daily_pnl'] = round(state['daily_pnl'] + pnl, 2)
                signals.append({"symbol": symbol, "signal": "SELL", "price": price, "pnl": pnl, "time": sig_time, "candles": len(candles)})

            else:
                if open_pos:
                    open_pos['cmp'] = round(candles[-1]['close'], 2)
                signals.append({"symbol": symbol, "signal": "HOLD", "price": price, "candles": len(candles)})

        except Exception as e:
            msg = str(e)
            if 'Rate_Limit' in msg or '429' in msg:
                signals.append({"symbol": symbol, "signal": "RATE_LIMIT"})
            else:
                signals.append({"symbol": symbol, "signal": "ERROR", "message": msg[:80]})

    # Unrealized P&L on open positions
    unrealized = sum(
        round((o['cmp'] - o['entry_price']) * o['qty'], 2)
        for o in orders
        if o['status'] == 'OPEN' and o.get('cmp') is not None
    )
    total_pnl = round(state['daily_pnl'] + unrealized, 2)

    # Daily loss limit check
    loss_limit = abs(cfg['daily_loss_limit'])
    if total_pnl <= -loss_limit:
        state['stopped'] = True
        for o in orders:
            if o['status'] == 'OPEN' and o.get('cmp'):
                pnl = round((o['cmp'] - o['entry_price']) * o['qty'], 2)
                o.update({
                    "exit_price": o['cmp'],
                    "exit_time":  datetime.now().strftime('%Y-%m-%d %H:%M'),
                    "pnl":        pnl,
                    "status":     "CLOSED",
                })
                state['daily_pnl'] = round(state['daily_pnl'] + pnl, 2)

    save_orders(orders)
    _save_state(state)

    return {
        "running":    True,
        "stopped":    state['stopped'],
        "signals":    signals,
        "daily_pnl":  round(state['daily_pnl'], 2),
        "unrealized": round(unrealized, 2),
        "total_pnl":  round(total_pnl, 2),
        "orders":     orders,
        "tick_time":  datetime.now().strftime('%H:%M:%S'),
        "today":      today,
    }
