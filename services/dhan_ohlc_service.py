"""
services/dhan_ohlc_service.py
------------------------------
Historical OHLC cache + Dhan API fetch (security_id path).
Expired-option / rollingoption logic lives in dhan_service.py.
"""
import os
import json
import threading
from datetime import datetime, timedelta

from config import OHLC_CACHE_DIR
from services.dhan_service_core import DHAN_API_BASE, _post_json, _dhan_headers, get_config


# ── Global Locks ──────────────────────────────────────────────────────────────
_file_locks = {}
_lock_mutex = threading.RLock()

def _get_lock(security_id, trade_date):
    key = f"{security_id}_{trade_date}"
    with _lock_mutex:
        if key not in _file_locks:
            _file_locks[key] = threading.RLock()
        return _file_locks[key]

# ── Cache Helpers ─────────────────────────────────────────────────────────────

def _cache_path(security_id, trade_date):
    return os.path.join(OHLC_CACHE_DIR, f"{security_id}_{trade_date}.csv")


def _meta_path(security_id, trade_date):
    if str(security_id).startswith('NIFTY'):
        return os.path.join(OHLC_CACHE_DIR, f"{security_id}.meta")
    return os.path.join(OHLC_CACHE_DIR, f"{security_id}_{trade_date}.meta")


def _read_meta(security_id, trade_date):
    mp = _meta_path(security_id, trade_date)
    if not os.path.exists(mp):
        return {}
    try:
        with open(mp) as f:
            data = json.load(f)
            if str(security_id).startswith('NIFTY'):
                return {'last_candle_time': data.get(trade_date)}
            return data
    except: return {}


def _write_meta(security_id, trade_date, last_candle_time):
    path = _meta_path(security_id, trade_date)
    if str(security_id).startswith('NIFTY'):
        meta = {}
        if os.path.exists(path):
            try:
                with open(path, 'r') as f: meta = json.load(f)
            except: pass
        meta[trade_date] = last_candle_time
        with open(path, 'w') as f: json.dump(meta, f)
    else:
        with open(path, 'w') as f:
            json.dump({
                'last_candle_time': last_candle_time,
                'fetched_at': datetime.now().isoformat()
            }, f)


def get_ohlc_status(security_id, trade_date):
    cp = _cache_path(security_id, trade_date)
    if not os.path.exists(cp):
        return {'status': 'missing', 'last_candle': None, 'candles': 0}
    meta = _read_meta(security_id, trade_date)
    last = meta.get('last_candle_time', '')
    complete = last >= f"{trade_date} 15:29" if last else False
    try:
        n = sum(1 for _ in open(cp)) - 1  # rows - header
    except Exception:
        n = 0
    return {'status': 'complete' if complete else 'partial', 'last_candle': last, 'candles': max(n, 0)}


def load_cached_ohlc(security_id, trade_date):
    import pandas as pd
    cp = _cache_path(security_id, trade_date)
    if not os.path.exists(cp):
        return None
    try:
        return pd.read_csv(cp)
    except Exception:
        return None


# ── OHLC Fetch ────────────────────────────────────────────────────────────────

def fetch_and_cache_ohlc(security_id, exchange_segment, instrument_type, trade_date, expiry_date=None, config=None):
    """Fetch 1-min OHLC from Dhan and save with thread safety."""
    lock = _get_lock(security_id, trade_date)
    with lock:
        return _perform_fetch_and_cache(security_id, exchange_segment, instrument_type, trade_date, expiry_date, config)

def _perform_fetch_and_cache(security_id, exchange_segment, instrument_type, trade_date, expiry_date, config):
    import pandas as pd
    if not config:
        config = get_config()

    if not config:
        raise ValueError("Dhan credentials not configured")

    headers = _dhan_headers(config)
    cp      = _cache_path(security_id, trade_date)
    meta    = _read_meta(security_id, trade_date)

    last_candle = meta.get('last_candle_time', '')
    if last_candle >= f"{trade_date} 15:29":
        return load_cached_ohlc(security_id, trade_date)

    # v2/charts/intraday works for both today and past dates (returns 1-min candles).
    # v2/charts/historical returns daily OHLC bars — do NOT use for intraday data.
    url = f"{DHAN_API_BASE}/v2/charts/intraday"
    payload = {
        "securityId":      str(security_id),
        "exchangeSegment": exchange_segment,
        "instrument":      instrument_type,
        "interval":        1,
        "fromDate":        trade_date,
        "toDate":          trade_date,
    }

    resp   = _post_json(url, payload, headers)
    df_new = _parse_dhan_response(resp, trade_date)

    if df_new.empty:
        return load_cached_ohlc(security_id, trade_date) or pd.DataFrame()

    if os.path.exists(cp):
        df_old = pd.read_csv(cp)
        df = (pd.concat([df_old, df_new])
                .drop_duplicates('datetime')
                .sort_values('datetime')
                .reset_index(drop=True))
    else:
        df = df_new

    df.to_csv(cp, index=False)
    _write_meta(security_id, trade_date, df['datetime'].max())
    return df


def _parse_rollingoption_response(resp, trade_date, opt_type):
    """Parse Dhan rollingoption response → DataFrame."""
    import pandas as pd
    data = resp.get('data', {}) or {}
    key  = 'ce' if opt_type == 'CALL' else 'pe'
    opt  = data.get(key) or {}
    if not opt:
        return pd.DataFrame()

    opens  = opt.get('open',      []) or []
    highs  = opt.get('high',      []) or []
    lows   = opt.get('low',       []) or []
    closes = opt.get('close',     []) or []
    vols   = opt.get('volume',    []) or []
    stamps = opt.get('timestamp', []) or []

    if not opens:
        return pd.DataFrame()

    rows = []
    if stamps:
        for i, (o, h, l, c) in enumerate(zip(opens, highs, lows, closes)):
            ts = stamps[i]
            dt = datetime.fromtimestamp(int(ts))
            if dt.strftime('%Y-%m-%d') != trade_date:
                continue
            v = vols[i] if i < len(vols) else 0
            rows.append({
                'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                'time':     dt.strftime('%H:%M:%S'),
                'open': float(o), 'high': float(h),
                'low':  float(l), 'close': float(c),
                'volume': int(v) if v is not None else 0,
            })
    else:
        start = datetime.strptime(f"{trade_date} 09:15:00", '%Y-%m-%d %H:%M:%S')
        for i, (o, h, l, c) in enumerate(zip(opens, highs, lows, closes)):
            dt = start + timedelta(minutes=i)
            v  = vols[i] if i < len(vols) else 0
            rows.append({
                'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                'time':     dt.strftime('%H:%M:%S'),
                'open': float(o), 'high': float(h),
                'low':  float(l), 'close': float(c),
                'volume': int(v) if v is not None else 0,
            })

    return pd.DataFrame(rows)


def _parse_dhan_response(resp, trade_date):
    """Convert Dhan array response -> DataFrame with datetime/time/open/high/low/close.
    Handles both responses with timestamps (epoch) and without (intraday, starts 09:15)."""
    import pandas as pd
    opens  = resp.get('open',   [])
    highs  = resp.get('high',   [])
    lows   = resp.get('low',    [])
    closes = resp.get('close',  [])
    vols   = resp.get('volume', [])
    stamps = resp.get('timestamp', [])

    if not opens:
        return pd.DataFrame()

    rows = []
    if stamps:
        for i, (ts, o, h, l, c) in enumerate(zip(stamps, opens, highs, lows, closes)):
            dt = datetime.fromtimestamp(int(ts))
            if dt.strftime('%Y-%m-%d') != trade_date:
                continue
            v = vols[i] if i < len(vols) else 0
            rows.append({
                'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                'time':     dt.strftime('%H:%M:%S'),
                'open': float(o), 'high': float(h),
                'low':  float(l), 'close': float(c),
                'volume': int(v) if v is not None else 0,
            })
    else:
        # intraday endpoint: no timestamps, candles start at 09:15
        start = datetime.strptime(f"{trade_date} 09:15:00", '%Y-%m-%d %H:%M:%S')
        for i, (o, h, l, c) in enumerate(zip(opens, highs, lows, closes)):
            dt = start + timedelta(minutes=i)
            v  = vols[i] if i < len(vols) else 0
            rows.append({
                'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                'time':     dt.strftime('%H:%M:%S'),
                'open': float(o), 'high': float(h),
                'low':  float(l), 'close': float(c),
                'volume': int(v) if v is not None else 0,
            })

    return pd.DataFrame(rows)
