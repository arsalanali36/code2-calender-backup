"""
services/ohlc_service.py
-------------------------
Unified OHLC download, storage, and load service.
Single source of truth for all OHLC data in the app.

Storage layout:
  data/ohlc/equity/{SYMBOL}/{YYYY-MM-DD}.csv
  data/ohlc/index/{SYMBOL}/{YYYY-MM-DD}.csv
  data/ohlc/options/{SYMBOL}/{YYYY-MM-DD}.csv

Always 1-min candles. Resample on load via resample().
Broker: Dhan (abstracted — add Angel One etc. via _get_broker()).
"""
import os
import re
import json
import threading
import pandas as pd
from datetime import datetime, timedelta

from config import BASE_DIR, DHAN_SYMBOL_MAP_FILE
from services.dhan_service_core import DHAN_API_BASE, _post_json, _dhan_headers, get_config

# ── Storage paths ─────────────────────────────────────────────────────────────
OHLC_DIR       = os.path.join(BASE_DIR, 'data', 'ohlc')
WATCHLIST_FILE = os.path.join(BASE_DIR, 'data', 'ohlc_watchlist.json')

# ── Index registry (Dhan security IDs) ───────────────────────────────────────
_INDICES = {
    'NIFTY':      ('13',  'IDX_I', 'INDEX'),
    'BANKNIFTY':  ('25',  'IDX_I', 'INDEX'),
    'FINNIFTY':   ('27',  'IDX_I', 'INDEX'),
    'MIDCPNIFTY': ('442', 'IDX_I', 'INDEX'),
    'SENSEX':     ('1',   'BSE_I', 'INDEX'),
    'BANKEX':     ('12',  'BSE_I', 'INDEX'),
}

_STRIKE_STEP = {
    'NIFTY': 50, 'BANKNIFTY': 100, 'FINNIFTY': 50,
    'MIDCPNIFTY': 25, 'SENSEX': 100, 'BANKEX': 100,
}

_file_locks: dict = {}
_lock_mutex = threading.RLock()


def _get_lock(key: str) -> threading.RLock:
    with _lock_mutex:
        if key not in _file_locks:
            _file_locks[key] = threading.RLock()
        return _file_locks[key]


# ── Type detection ────────────────────────────────────────────────────────────

def detect_type(symbol: str) -> str:
    """Return 'index', 'option', or 'equity'."""
    s = symbol.upper().strip()
    if s in _INDICES:
        return 'index'
    if re.search(r'\d+(CE|PE)$', s):
        return 'option'
    return 'equity'


# ── Path helpers ──────────────────────────────────────────────────────────────

def ohlc_path(symbol: str, date: str) -> str:
    """Return canonical CSV path for symbol + date."""
    t = detect_type(symbol)
    return os.path.join(OHLC_DIR, t, symbol.upper(), f"{date}.csv")


# ── Completeness check ────────────────────────────────────────────────────────

def is_complete(symbol: str, date: str) -> bool:
    """True if 1-min data exists up through 15:29 on date."""
    path = ohlc_path(symbol, date)
    if not os.path.exists(path):
        return False
    try:
        df = pd.read_csv(path, usecols=['datetime'])
        if df.empty:
            return False
        return str(df['datetime'].max()) >= f"{date} 15:29"
    except Exception:
        return False


# ── Load ──────────────────────────────────────────────────────────────────────

def load(symbol: str, date: str) -> pd.DataFrame | None:
    """Load cached 1-min OHLC. Returns None if not found."""
    path = ohlc_path(symbol, date)
    if not os.path.exists(path):
        return None
    try:
        return pd.read_csv(path)
    except Exception:
        return None


# ── Load range (multi-date) ───────────────────────────────────────────────────

def load_range(symbol: str, start_date: str, end_date: str) -> pd.DataFrame | None:
    """Load and concatenate 1-min OHLC for all weekdays in [start_date, end_date].
    Returns None if no data found in new unified store."""
    from datetime import date as _date
    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end   = datetime.strptime(end_date,   '%Y-%m-%d').date()
    frames = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            df = load(symbol, d.strftime('%Y-%m-%d'))
            if df is not None and not df.empty:
                frames.append(df)
        d += timedelta(days=1)
    if not frames:
        return None
    out = (pd.concat(frames, ignore_index=True)
             .drop_duplicates('datetime')
             .sort_values('datetime')
             .reset_index(drop=True))
    return out


def available_dates(symbol: str) -> list:
    """Return sorted list of dates that have data in the unified store."""
    folder = os.path.dirname(ohlc_path(symbol, '2000-01-01'))
    if not os.path.isdir(folder):
        return []
    return sorted(
        f[:-4] for f in os.listdir(folder)
        if f.endswith('.csv') and len(f) == 14
    )


# ── Resample ──────────────────────────────────────────────────────────────────

def resample(df: pd.DataFrame, timeframe_min: int) -> pd.DataFrame:
    """Resample 1-min DataFrame to higher timeframe (3, 5, 15 etc.)."""
    if timeframe_min <= 1 or df is None or df.empty:
        return df
    out = df.copy()
    out['datetime'] = pd.to_datetime(out['datetime'])
    out = (out.set_index('datetime')
              .resample(f"{timeframe_min}min", closed='left', label='left')
              .agg({'open': 'first', 'high': 'max', 'low': 'min',
                    'close': 'last', 'volume': 'sum'})
              .dropna(subset=['open'])
              .reset_index())
    out['datetime'] = out['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    return out


# ── Status ────────────────────────────────────────────────────────────────────

def get_status(symbol: str, date: str) -> dict:
    """Return completeness info for a (symbol, date) pair."""
    path = ohlc_path(symbol, date)
    if not os.path.exists(path):
        return {'status': 'missing', 'candles': 0, 'last_candle': None}
    try:
        df = pd.read_csv(path)
        last = df['datetime'].max() if not df.empty else None
        complete = str(last) >= f"{date} 15:29" if last else False
        return {'status': 'complete' if complete else 'partial',
                'candles': len(df), 'last_candle': last}
    except Exception:
        return {'status': 'corrupt', 'candles': 0, 'last_candle': None}


# ── Save (thread-safe merge) ──────────────────────────────────────────────────

def _save(symbol: str, date: str, df: pd.DataFrame) -> None:
    path = ohlc_path(symbol, date)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        try:
            existing = pd.read_csv(path)
            df = (pd.concat([existing, df])
                    .drop_duplicates('datetime')
                    .sort_values('datetime')
                    .reset_index(drop=True))
        except Exception:
            pass
    df.to_csv(path, index=False)


# ── Symbol map lookup ─────────────────────────────────────────────────────────

def _lookup_symbol_map(symbol: str):
    """Return (security_id, exchange_segment, instrument) from dhan_symbol_map.json."""
    if not os.path.exists(DHAN_SYMBOL_MAP_FILE):
        return None, None, None
    try:
        with open(DHAN_SYMBOL_MAP_FILE) as f:
            m = json.load(f)
        entry = m.get(symbol.upper(), {})
        return (entry.get('security_id'),
                entry.get('exchange_segment', 'NSE_EQ'),
                entry.get('instrument', 'EQUITY'))
    except Exception:
        return None, None, None


# ── Parse API responses ───────────────────────────────────────────────────────

def _parse_intraday_response(resp: dict, date: str) -> pd.DataFrame:
    opens  = resp.get('open',      []) or []
    highs  = resp.get('high',      []) or []
    lows   = resp.get('low',       []) or []
    closes = resp.get('close',     []) or []
    vols   = resp.get('volume',    []) or []
    stamps = resp.get('timestamp', []) or []
    if not opens:
        return pd.DataFrame()
    start = datetime.strptime(f"{date} 09:15:00", '%Y-%m-%d %H:%M:%S')
    rows = []
    for i, (o, h, l, c) in enumerate(zip(opens, highs, lows, closes)):
        dt = datetime.fromtimestamp(int(stamps[i])) if stamps else start + timedelta(minutes=i)
        v  = vols[i] if i < len(vols) else 0
        rows.append({'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                     'open': float(o), 'high': float(h),
                     'low':  float(l), 'close': float(c),
                     'volume': int(v) if v is not None else 0})
    df = pd.DataFrame(rows)
    return df[df['datetime'].str.startswith(date)].reset_index(drop=True)


def _parse_rollingoption_response(resp: dict, date: str, opt_type: str) -> pd.DataFrame:
    data  = resp.get('data', {}) or {}
    key   = 'ce' if opt_type == 'CE' else 'pe'
    opt   = data.get(key) or {}
    opens  = opt.get('open',      []) or []
    highs  = opt.get('high',      []) or []
    lows   = opt.get('low',       []) or []
    closes = opt.get('close',     []) or []
    vols   = opt.get('volume',    []) or []
    stamps = opt.get('timestamp', []) or []
    if not opens:
        return pd.DataFrame()
    start = datetime.strptime(f"{date} 09:15:00", '%Y-%m-%d %H:%M:%S')
    rows = []
    for i, (o, h, l, c) in enumerate(zip(opens, highs, lows, closes)):
        if stamps:
            dt = datetime.fromtimestamp(int(stamps[i]))
            if dt.strftime('%Y-%m-%d') != date:
                continue
        else:
            dt = start + timedelta(minutes=i)
        v = vols[i] if i < len(vols) else 0
        rows.append({'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                     'open': float(o), 'high': float(h),
                     'low':  float(l), 'close': float(c),
                     'volume': int(v) if v is not None else 0})
    df = pd.DataFrame(rows)
    return df[df['datetime'].str.startswith(date)].reset_index(drop=True) if not df.empty else df


# ── Fetch: equity / index ─────────────────────────────────────────────────────

def _fetch_spot(underlying: str, date: str, headers: dict, entry_time: str = None) -> float | None:
    """Fetch underlying index close price near entry_time."""
    entry = _INDICES.get(underlying)
    if not entry:
        return None
    sid, seg, inst = entry
    url    = f"{DHAN_API_BASE}/v2/charts/intraday"
    combos = [(seg, inst), ('NSE_EQ', 'INDEX'), ('IDX_I', 'EQUITY')]
    for s, i in combos:
        try:
            resp   = _post_json(url, {"securityId": sid, "exchangeSegment": s,
                                       "instrument": i, "interval": 1,
                                       "fromDate": date, "toDate": date}, headers)
            closes = resp.get('close', [])
            if closes:
                t = (entry_time or '09:30')[:5]
                mins = int(t.split(':')[0]) * 60 + int(t.split(':')[1]) - 555
                return float(closes[max(0, min(mins, len(closes) - 1))])
        except Exception:
            continue
    return None


def _download_equity_index(symbol: str, date: str, config: dict,
                            security_id: str = None,
                            exchange_segment: str = None,
                            instrument_type: str = None) -> pd.DataFrame:
    sym = symbol.upper()
    if sym in _INDICES:
        sid, seg, inst = _INDICES[sym]
    elif security_id and exchange_segment and instrument_type:
        sid, seg, inst = security_id, exchange_segment, instrument_type
    else:
        sid, seg, inst = _lookup_symbol_map(sym)
        if not sid:
            raise ValueError(f"No security_id for '{symbol}'. Resolve via Dhan scrip master first.")

    resp = _post_json(f"{DHAN_API_BASE}/v2/charts/intraday", {
        "securityId":      str(sid),
        "exchangeSegment": seg,
        "instrument":      inst,
        "interval":        1,
        "fromDate":        date,
        "toDate":          date,
    }, _dhan_headers(config))
    return _parse_intraday_response(resp, date)


# ── Fetch: options ────────────────────────────────────────────────────────────

def _parse_option_symbol(symbol: str) -> dict | None:
    """Parse option symbols — both monthly and weekly NSE formats.

    Monthly: NIFTY26MAR22500CE  (3-letter month)
    Weekly:  NIFTY2640722800CE  (single-char month 1-9/O/N/D + 2-digit day)
    """
    s = symbol.upper()
    # Monthly format: SYMBOL + YY + MON(3alpha) + STRIKE + TYPE
    m = re.match(r'^([A-Z&-]+?)(\d{2})([A-Z]{3})(\d+)(CE|PE)$', s)
    if m:
        return {'underlying': m.group(1), 'strike': float(m.group(4)), 'option_type': m.group(5)}
    # Weekly format: SYMBOL + YY + M(1 char: 1-9 or O/N/D) + DD(2 digits) + STRIKE + TYPE
    m = re.match(r'^([A-Z&-]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$', s)
    if m:
        return {'underlying': m.group(1), 'strike': float(m.group(5)), 'option_type': m.group(6)}
    return None


def _download_option(symbol: str, date: str, config: dict, entry_time: str = None) -> pd.DataFrame:
    parsed = _parse_option_symbol(symbol)
    if not parsed:
        raise ValueError(f"Cannot parse option symbol: {symbol}")

    underlying = parsed['underlying']
    strike     = parsed['strike']
    opt_type   = parsed['option_type']
    step       = _STRIKE_STEP.get(underlying, 50)
    headers    = _dhan_headers(config)

    if underlying not in _INDICES:
        raise ValueError(f"Unknown underlying '{underlying}' — add to _INDICES in ohlc_service.py")
    sid = _INDICES[underlying][0]

    # Preferred path: intraday API via resolved security_id
    map_sid, map_seg, map_inst = _lookup_symbol_map(symbol)
    if map_sid:
        try:
            resp = _post_json(f"{DHAN_API_BASE}/v2/charts/intraday", {
                "securityId": str(map_sid), "exchangeSegment": map_seg,
                "instrument": map_inst, "interval": 1,
                "fromDate": date, "toDate": date,
            }, headers)
            df = _parse_intraday_response(resp, date)
            if not df.empty:
                return df
        except Exception:
            pass

    # Fallback: rollingoption (ATM-offset approximation for expired options)
    spot = _fetch_spot(underlying, date, headers, entry_time)
    if spot:
        atm    = round(spot / step) * step
        n_calc = round((strike - atm) / step)
        n_tries = list(dict.fromkeys([n_calc, n_calc - 1, n_calc + 1]))
    else:
        n_tries = [0]

    expiry_candidates = [
        ('WEEK', 1), ('WEEK', 2), ('WEEK', 3),
        ('MONTH', 1), ('MONTH', 2), ('MONTH', 3),
    ]
    url = f"{DHAN_API_BASE}/v2/charts/rollingoption"
    for n in n_tries:
        for exp_type, exp_code in expiry_candidates:
            try:
                resp = _post_json(url, {
                    "UnderlyingScrip": sid,
                    "UnderlyingSeg":   "IDX_I",
                    "Instrument":      "OPTIDX",
                    "ExpiryCode":      exp_code,
                    "ExpiryType":      exp_type,
                    "OptionType":      "CALL" if opt_type == 'CE' else 'PUT',
                    "ProductType":     "INTRADAY",
                    "FromDate":        date,
                    "ToDate":          date,
                    "N":               n,
                    "Interval":        1,
                }, headers)
                df = _parse_rollingoption_response(resp, date, opt_type)
                if not df.empty and len(df) >= 10:
                    return df
            except Exception:
                continue
    return pd.DataFrame()


# ── Main entry point ──────────────────────────────────────────────────────────

def download(symbol: str, date: str,
             security_id: str = None,
             exchange_segment: str = None,
             instrument_type: str = None,
             entry_time: str = None,
             force: bool = False) -> pd.DataFrame:
    """
    Download and cache 1-min OHLC for symbol on date.
    Skips if already complete unless force=True.
    Returns DataFrame (may be empty on API failure).
    """
    if not force and is_complete(symbol, date):
        return load(symbol, date)

    config = get_config()
    if not config:
        raise ValueError("Dhan credentials not configured — set via app Settings")

    lock = _get_lock(f"{symbol}_{date}")
    with lock:
        if not force and is_complete(symbol, date):
            return load(symbol, date)

        t = detect_type(symbol)
        if t == 'option':
            df = _download_option(symbol, date, config, entry_time)
        else:
            df = _download_equity_index(symbol, date, config,
                                        security_id, exchange_segment, instrument_type)

        if df is not None and not df.empty:
            _save(symbol, date, df)
            df = load(symbol, date)

        return df if df is not None else pd.DataFrame()


# ── Watchlist helpers ─────────────────────────────────────────────────────────

def load_watchlist() -> list:
    if not os.path.exists(WATCHLIST_FILE):
        return []
    try:
        with open(WATCHLIST_FILE) as f:
            return json.load(f)
    except Exception:
        return []


def save_watchlist(symbols: list) -> None:
    cleaned = sorted({s.strip().upper() for s in symbols if s.strip()})
    os.makedirs(os.path.dirname(WATCHLIST_FILE), exist_ok=True)
    with open(WATCHLIST_FILE, 'w') as f:
        json.dump(cleaned, f, indent=2)
