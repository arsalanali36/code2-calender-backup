"""
services/algo_engine.py
-----------------------
Algo engine — broker-agnostic, strategy-agnostic.
  mode='paper' → JSON paper orders only (default, safe)
  mode='live'  → JSON log + real broker order placement
"""
import os
import json
import uuid
import time
from datetime import datetime, date

from config import (
    ALGO_CONFIG_FILE, ALGO_WATCHLIST_FILE,
    ALGO_ORDERS_FILE, ALGO_STATE_FILE, ALGO_OHLC_DIR,
)
os.makedirs(ALGO_OHLC_DIR, exist_ok=True)

# ── In-memory candle cache ────────────────────────────────────────────────────
_candle_cache = {}   # { security_id: {candles, ema_fast, ema_slow, fetched_at} }
_CACHE_TTL    = 300  # seconds

def get_cached_candles(security_id):
    e = _candle_cache.get(str(security_id))
    if not e:
        return None
    if (datetime.now() - e['fetched_at']).total_seconds() > _CACHE_TTL:
        return None
    return e

def _store_cache(security_id, symbol, candles, ema_fast, ema_slow):
    _candle_cache[str(security_id)] = {
        'symbol':     symbol,
        'candles':    candles,
        'ema_fast':   ema_fast,
        'ema_slow':   ema_slow,
        'fetched_at': datetime.now(),
    }
    _save_ohlc_disk(security_id, symbol, candles, ema_fast, ema_slow)


def _save_ohlc_disk(security_id, symbol, candles, ema_fast, ema_slow):
    today = date.today().isoformat()
    cfg   = get_algo_config()
    path  = os.path.join(ALGO_OHLC_DIR, f"{symbol}_{today}.json")
    with open(path, 'w') as f:
        json.dump({
            'symbol':          symbol,
            'security_id':     str(security_id),
            'date':            today,
            'ema_fast_period': cfg['ema_fast'],
            'ema_slow_period': cfg['ema_slow'],
            'candles':         candles,
            'ema_fast':        ema_fast,
            'ema_slow':        ema_slow,
            'saved_at':        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'candle_count':    len(candles),
        }, f)


def list_saved_ohlc():
    files = []
    for fname in sorted(os.listdir(ALGO_OHLC_DIR)):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(ALGO_OHLC_DIR, fname)
        try:
            with open(fpath) as f:
                d = json.load(f)
            files.append({
                'file':         fname,
                'symbol':       d.get('symbol', ''),
                'date':         d.get('date', ''),
                'candle_count': d.get('candle_count', 0),
                'saved_at':     d.get('saved_at', ''),
                'size_kb':      round(os.path.getsize(fpath) / 1024, 1),
            })
        except Exception:
            pass
    return files


def load_ohlc_file(symbol, date_str):
    path = os.path.join(ALGO_OHLC_DIR, f"{symbol}_{date_str}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "broker":           "dhan",
    "strategy":         "EMA Crossover",
    "mode":             "paper",
    "order_type":       "MARKET",
    "product_type":     "INTRADAY",
    "ema_fast":         9,
    "ema_slow":         20,
    "timeframe":        1,
    "entry_mode":       "candle_close",
    "sl_type":          "crossover",
    "daily_loss_limit": 100,
    "qty":              1,
    "running":          False,
    "strategy_params":  {},
}


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


# ── EMA helper (kept for OHLC disk saves) ────────────────────────────────────

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


# ── Symbol resolve ────────────────────────────────────────────────────────────

def resolve_equity_symbol(symbol):
    from config import DHAN_SCRIP_MASTER
    import csv
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
    Uses configured broker (data fetch) and strategy (signal detection).
    In live mode, also sends real orders to the broker.
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
            "message":   "Daily loss limit hit. Bot paused for today.",
            "daily_pnl": state['daily_pnl'],
        }

    # Load broker + strategy from registry
    from services.brokers.broker_registry   import get_broker
    from services.strategies.strategy_registry import get_strategy

    broker_key   = cfg.get('broker',   'dhan')
    strategy_key = cfg.get('strategy', 'EMA Crossover')
    mode         = cfg.get('mode',     'paper')
    order_type   = cfg.get('order_type',   'MARKET')
    product_type = cfg.get('product_type', 'INTRADAY')

    try:
        broker   = get_broker(broker_key)
        strategy = get_strategy(strategy_key)
    except ValueError as e:
        return {"error": str(e)}

    # Strategy-specific params (e.g. hawa_me_zone for X2)
    strategy_params = cfg.get('strategy_params', {})

    watchlist = get_watchlist()
    if not watchlist:
        return {"running": True, "message": "Watchlist is empty.", "signals": [], "orders": get_orders()}

    orders  = get_orders()
    today   = date.today().isoformat()
    qty     = cfg['qty']
    signals = []

    for item in watchlist:
        symbol = item['symbol']
        sid    = item['security_id']
        seg    = item.get('exchange_segment', 'NSE_EQ')
        instr  = item.get('instrument', 'EQUITY')

        try:
            time.sleep(0.4)  # avoid Dhan rate limit DH-904
            candles = broker.fetch_candles(sid, seg, instr, today)
            if not candles:
                signals.append({"symbol": symbol, "signal": "NO_DATA", "candles": 0})
                continue

            # Cache + disk save (EMA for chart display)
            closes   = [c['close'] for c in candles]
            ef       = _calc_ema(closes, cfg['ema_fast'])
            es       = _calc_ema(closes, cfg['ema_slow'])
            _store_cache(sid, symbol, candles, ef, es)

            # Get signal from strategy
            signal, price, sl_price = strategy.generate_signal(candles, strategy_params)

            open_pos = next(
                (o for o in orders if o['symbol'] == symbol and o['status'] == 'OPEN'),
                None,
            )

            if signal == 'BUY' and not open_pos:
                broker_order_id = None
                if mode == 'live':
                    try:
                        resp = broker.place_order(
                            symbol=symbol, security_id=sid,
                            exchange_segment=seg,
                            transaction_type='BUY',
                            order_type=order_type,
                            product_type=product_type,
                            qty=qty, price=0.0 if order_type == 'MARKET' else price,
                        )
                        broker_order_id = resp.get('order_id')
                    except Exception as oe:
                        signals.append({"symbol": symbol, "signal": "ORDER_ERROR", "message": str(oe)[:80]})
                        continue

                order = {
                    "id":               str(uuid.uuid4())[:8],
                    "symbol":           symbol,
                    "security_id":      sid,
                    "side":             "BUY",
                    "entry_price":      round(price, 2),
                    "entry_time":       f"{today} {candles[-2]['time'] if len(candles) >= 2 else candles[-1]['time']}",
                    "qty":              qty,
                    "sl_price":         round(sl_price, 2) if sl_price else None,
                    "exit_price":       None,
                    "exit_time":        None,
                    "pnl":              None,
                    "status":           "OPEN",
                    "cmp":              round(candles[-1]['close'], 2),
                    "mode":             mode,
                    "broker_order_id":  broker_order_id,
                    "strategy":         strategy_key,
                    "order_type":       order_type,
                    "product_type":     product_type,
                }
                orders.append(order)
                signals.append({"symbol": symbol, "signal": "BUY", "price": price, "sl": sl_price,
                                 "time": candles[-2]['time'] if len(candles) >= 2 else '--',
                                 "candles": len(candles), "mode": mode})

            elif signal == 'SELL' and open_pos:
                broker_order_id = None
                if mode == 'live':
                    try:
                        resp = broker.place_order(
                            symbol=symbol, security_id=sid,
                            exchange_segment=seg,
                            transaction_type='SELL',
                            order_type=order_type,
                            product_type=product_type,
                            qty=open_pos['qty'],
                            price=0.0 if order_type == 'MARKET' else price,
                        )
                        broker_order_id = resp.get('order_id')
                    except Exception as oe:
                        signals.append({"symbol": symbol, "signal": "ORDER_ERROR", "message": str(oe)[:80]})
                        continue

                pnl = round((price - open_pos['entry_price']) * open_pos['qty'], 2)
                open_pos.update({
                    "exit_price":       round(price, 2),
                    "exit_time":        f"{today} {candles[-2]['time'] if len(candles) >= 2 else candles[-1]['time']}",
                    "pnl":              pnl,
                    "status":           "CLOSED",
                    "cmp":              round(candles[-1]['close'], 2),
                    "broker_order_id":  broker_order_id,
                })
                state['daily_pnl'] = round(state['daily_pnl'] + pnl, 2)
                signals.append({"symbol": symbol, "signal": "SELL", "price": price, "pnl": pnl,
                                 "time": candles[-2]['time'] if len(candles) >= 2 else '--',
                                 "candles": len(candles), "mode": mode})

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

    # Unrealized P&L
    unrealized = sum(
        round((o['cmp'] - o['entry_price']) * o['qty'], 2)
        for o in orders
        if o['status'] == 'OPEN' and o.get('cmp') is not None
    )
    total_pnl = round(state['daily_pnl'] + unrealized, 2)

    # Daily loss limit
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
        "broker":     broker_key,
        "strategy":   strategy_key,
        "mode":       mode,
    }
