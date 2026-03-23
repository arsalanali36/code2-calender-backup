"""
services/dhan_service.py
------------------------
Dhan API integration — expired options, auto-mapper, OHLC cache + fetch.
Core helpers (config, scrip, symbol parser) → dhan_service_core.py
"""
import os
import json
import time
import pandas as pd
from datetime import datetime, timedelta

from config import OHLC_CACHE_DIR, DHAN_SCRIP_MASTER, SYMBOL_EXPIRY_MAP_FILE, TRADEBOOK_SYNC_QUEUE_FILE
from services.dhan_service_core import (
    DHAN_API_BASE,
    _post_json, _dhan_headers,
    get_config, save_config,
    load_symbol_map, save_symbol_map,
    download_scrip_master, search_scrip,
    _parse_nse_symbol, _find_col,
    _INDEX_UNDERLYINGS, _MON_TO_NUM, _MCODE_TO_MON,
)


# ── Symbol → Actual Expiry Map (from Zerodha tradebook import) ───────────────

def load_symbol_expiry_map():
    """Load { symbol: 'YYYY-MM-DD' } from file (holiday-adjusted actual expiry dates)."""
    if not os.path.exists(SYMBOL_EXPIRY_MAP_FILE):
        return {}
    try:
        with open(SYMBOL_EXPIRY_MAP_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def save_symbol_expiry_map(mapping):
    os.makedirs(os.path.dirname(SYMBOL_EXPIRY_MAP_FILE), exist_ok=True)
    with open(SYMBOL_EXPIRY_MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)


def load_tradebook_queue():
    """Load saved tradebook sync queue (list of {symbol, trade_date, expiry_date, entry_time})."""
    if not os.path.exists(TRADEBOOK_SYNC_QUEUE_FILE):
        return []
    try:
        with open(TRADEBOOK_SYNC_QUEUE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def save_tradebook_queue(pairs):
    os.makedirs(os.path.dirname(TRADEBOOK_SYNC_QUEUE_FILE), exist_ok=True)
    with open(TRADEBOOK_SYNC_QUEUE_FILE, 'w', encoding='utf-8') as f:
        json.dump(pairs, f, indent=2)


# ── Expired Options via rollingoption ─────────────────────────────────────────

# Dhan underlying security IDs (always active — index cash instruments)
_UNDERLYING_SECURITY_IDS = {
    'NIFTY':      '13',
    'BANKNIFTY':  '25',
    'FINNIFTY':   '27',
    'MIDCPNIFTY': '442',
    'SENSEX':     '1',
    'BANKEX':     '12',
}

# Strike grid step sizes
_STRIKE_STEP = {
    'NIFTY': 50, 'BANKNIFTY': 100, 'FINNIFTY': 50,
    'MIDCPNIFTY': 25, 'SENSEX': 100, 'BANKEX': 100,
}


def _expired_option_cache_path(symbol, trade_date):
    safe = symbol.replace(' ', '_').replace('/', '_')
    return os.path.join(OHLC_CACHE_DIR, f"EXP_{safe}_{trade_date}.csv")


def _fetch_underlying_spot(underlying, trade_date, headers, entry_time=None):
    """
    Fetch underlying index price at entry_time on trade_date.
    Tries multiple segment/instrument combos — Dhan API varies by version.
    Returns close price as float, or None on failure.
    """
    sec_id = _UNDERLYING_SECURITY_IDS.get(underlying)
    if not sec_id:
        return None

    t = entry_time[:5] if entry_time else '09:30'
    from_str = f"{trade_date} {t}:00"
    try:
        to_dt  = datetime.strptime(from_str, '%Y-%m-%d %H:%M:%S') + timedelta(minutes=5)
        to_str = to_dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        to_str = f"{trade_date} {t}:05"

    url = f"{DHAN_API_BASE}/v2/charts/historical"
    # Try all known segment/instrument combos for index data
    combos = [
        ("IDX_I",   "INDEX"),
        ("NSE_EQ",  "INDEX"),
        ("IDX_I",   "EQUITY"),
        ("NSE_FNO", "INDEX"),
    ]
    for seg, inst in combos:
        try:
            resp   = _post_json(url, {
                "securityId":      sec_id,
                "exchangeSegment": seg,
                "instrument":      inst,
                "interval":        1,
                "fromDate":        from_str,
                "toDate":          to_str,
            }, headers)
            closes = resp.get('close', [])
            if closes:
                return float(closes[0])
        except Exception:
            continue
    return None


def fetch_expired_option_ohlc(symbol, trade_date, entry_time=None):
    """
    Fetch 1-min OHLC for an expired option via Dhan /v2/charts/rollingoption.

    Steps:
      1. Parse symbol → underlying, strike, expiry day/month, option type
      2. Fetch underlying spot at entry_time → calculate ATM
      3. Compute strike offset N (ATM±N)
      4. Try WEEK/MONTH × expiryCode 0,1,2 until we get data for trade_date
      5. Cache and return DataFrame
    """
    config = get_config()
    if not config:
        raise ValueError("Dhan credentials not configured")

    parsed = _parse_nse_symbol(symbol, trade_date)
    if not parsed:
        raise ValueError(f"Cannot parse symbol: {symbol}")

    underlying = parsed['underlying']
    sec_id     = _UNDERLYING_SECURITY_IDS.get(underlying)
    if not sec_id:
        raise ValueError(f"Unknown underlying '{underlying}' — add to _UNDERLYING_SECURITY_IDS")

    headers  = _dhan_headers(config)
    step     = _STRIKE_STEP.get(underlying, 50)
    strike   = float(parsed['strike'])
    opt_type = 'CALL' if parsed['option_type'] == 'CE' else 'PUT'

    # ── Build expiry candidates — try ALL (flag, code) combos ───────────────
    # Monthly options on a Thursday: expiryCode=1 = today's weekly (wrong!),
    # expiryCode=2 = the monthly. We don't know which is correct without Dhan's
    # internal calendar, so just try all 6 combinations.
    expiry_candidates = [
        ('WEEK', 1), ('WEEK', 2), ('WEEK', 3),
        ('MONTH', 1), ('MONTH', 2), ('MONTH', 3),
    ]

    # ── Get underlying spot to determine ATM → compute N ─────────────────────
    spot = _fetch_underlying_spot(underlying, trade_date, headers, entry_time)
    if spot is not None:
        atm    = round(spot / step) * step
        n_calc = round((strike - atm) / step)
        # Try exact N ± small window. NO abs cap — the old abs(n)<=15 was wrong
        # and dropped correct values for strikes that are OTM/ITM > 15 ticks.
        n_tries = list(dict.fromkeys([n_calc, n_calc-1, n_calc+1, n_calc-2, n_calc+2]))
    else:
        # Spot unavailable — search ±10 around 0 (covers near-ATM trades)
        n_tries = list(range(-10, 11))

    # toDate must be exclusive (next day)
    from_dt = datetime.strptime(trade_date, '%Y-%m-%d')
    to_date = (from_dt + timedelta(days=1)).strftime('%Y-%m-%d')

    url = f"{DHAN_API_BASE}/v2/charts/rollingoption"

    spot_debug = f"spot={'ok:'+str(round(spot)) if spot else 'failed'}"
    last_error = None
    # Outer loop: try each (expiryFlag, expiryCode) combo; inner loop: try each N
    for expiry_flag, exp_code in expiry_candidates:
      for n in n_tries:
        strike_str = 'ATM' if n == 0 else (f'ATM+{n}' if n > 0 else f'ATM{n}')
        time.sleep(0.3)      # stay under Dhan rate limit
        payload = {
            "securityId":      sec_id,
            "exchangeSegment": "NSE_FNO",
            "instrument":      parsed['instrument'],
            "interval":        1,
            "expiryCode":      exp_code,
            "expiryFlag":      expiry_flag,
            "strike":          strike_str,
            "drvOptionType":   opt_type,
            "requiredData":    ["open", "high", "low", "close", "volume"],
            "fromDate":        trade_date,
            "toDate":          to_date,
        }
        try:
            resp = _post_json(url, payload, headers)
            df   = _parse_rollingoption_response(resp, trade_date, opt_type)
            if df.empty:
                last_error = f"no_data strike={strike_str} expCode={exp_code}"
                continue
            cp = _expired_option_cache_path(symbol, trade_date)
            df.to_csv(cp, index=False)
            _write_meta(f"EXP_{symbol}", trade_date, df['datetime'].max())
            return df
        except Exception as e:
            last_error = str(e)
            continue

    raise ValueError(f"{spot_debug} | tried={expiry_candidates} | n={n_tries} | {last_error}")


def get_expired_option_ohlc_status(symbol, trade_date):
    cp = _expired_option_cache_path(symbol, trade_date)
    if not os.path.exists(cp):
        return {'status': 'missing', 'candles': 0, 'last_candle': None}
    try:
        n = sum(1 for _ in open(cp)) - 1
    except Exception:
        n = 0
    return {'status': 'complete' if n > 0 else 'missing', 'candles': max(n, 0), 'last_candle': None}


def load_cached_expired_option_ohlc(symbol, trade_date):
    cp = _expired_option_cache_path(symbol, trade_date)
    if not os.path.exists(cp):
        return None
    try:
        return pd.read_csv(cp)
    except Exception:
        return None


def auto_map_instruments(symbol_date_map):
    """
    Auto-map trade instruments to Dhan security IDs using scrip master.

    Args:
        symbol_date_map: dict { symbol: trade_date_str } OR list of symbols
                         trade_date is used to determine expiry year.

    Returns dict: { symbol: { security_id, exchange_segment, instrument,
                               confidence (0-100), matched_symbol, error? } }
    """
    # Normalise input
    if isinstance(symbol_date_map, (list, set)):
        symbol_date_map = {s: None for s in symbol_date_map}

    if not os.path.exists(DHAN_SCRIP_MASTER):
        download_scrip_master()

    df = pd.read_csv(DHAN_SCRIP_MASTER, low_memory=False)

    cid   = _find_col(df, ['SEM_SMST_SECURITY_ID', 'SECURITY_ID'])
    csym  = _find_col(df, ['SEM_TRADING_SYMBOL',   'TRADING_SYMBOL', 'SEM_CUSTOM_SYMBOL'])
    cseg  = _find_col(df, ['SEM_EXM_EXCH_ID',      'SEM_SEGMENT',    'EXCHANGE_SEGMENT'])
    cinst = _find_col(df, ['SEM_INSTRUMENT_NAME',  'INSTRUMENT_NAME'])
    cstk  = _find_col(df, ['SEM_STRIKE_PRICE',      'STRIKE_PRICE'])
    copt  = _find_col(df, ['SEM_OPTION_TYPE',       'OPTION_TYPE'])
    cexp  = _find_col(df, ['SEM_EXPIRY_DATE',       'EXPIRY_DATE'])

    sym_index = df.groupby(df[csym].astype(str).str.upper()) if csym else None

    results = {}
    for symbol, trade_date in symbol_date_map.items():
        results[symbol] = _try_match(
            symbol, trade_date, df, sym_index,
            cid, csym, cseg, cinst, cstk, copt, cexp
        )
    return results


def _try_match(symbol, trade_date, df, sym_index, cid, csym, cseg, cinst, cstk, copt, cexp):
    s = symbol.upper().strip()

    # ── Early exit for expired options ────────────────────────────────────────
    # Expired contracts are removed from Dhan's scrip master.
    # They don't need a security_id — OHLC is fetched via rollingoption instead.
    _parsed = _parse_nse_symbol(symbol, trade_date)
    if _parsed and _parsed.get('day') and _parsed.get('month_num') and _parsed.get('year'):
        _exp_str = f"{_parsed['year']}-{_parsed['month_num']}-{_parsed['day'].zfill(2)}"
        try:
            from datetime import date as _d
            if _d.fromisoformat(_exp_str) < _d.today():
                return {
                    'security_id':      '',
                    'exchange_segment': 'NSE_FNO',
                    'instrument':       _parsed.get('instrument', 'OPTIDX'),
                    'confidence':       0,
                    'matched_symbol':   '',
                    'expiry':           _exp_str,
                    'expired_opt':      True,
                }
        except Exception:
            pass

    def _row_to_result(row, confidence, matched_sym=''):
        seg  = str(row.get(cseg,  'NSE_FNO')) if cseg  else 'NSE_FNO'
        inst = str(row.get(cinst, 'OPTIDX'))  if cinst else 'OPTIDX'
        # Normalise segment: Dhan sometimes uses short codes like 'NSE'
        if seg in ('NSE', 'nse'):
            inst_val = str(row.get(cinst, '')) if cinst else ''
            seg = 'NSE_FNO' if 'OPT' in inst_val.upper() or 'FUT' in inst_val.upper() else 'NSE_EQ'
        # Expiry date — normalise to YYYY-MM-DD (first 10 chars covers most formats)
        raw_expiry = str(row.get(cexp, '')) if cexp else ''
        expiry = raw_expiry[:10] if len(raw_expiry) >= 10 else raw_expiry
        return {
            'security_id':      str(row[cid]) if cid else '',
            'exchange_segment': seg,
            'instrument':       inst,
            'confidence':       confidence,
            'matched_symbol':   matched_sym or s,
            'expiry':           expiry,
        }

    # 0 ── Construct Dhan custom-symbol format and look up in SEM_CUSTOM_SYMBOL
    # Dhan stores: "NIFTY 24 MAR 22800 PUT" in SEM_CUSTOM_SYMBOL
    # We can build this from parsed components.
    ccustom = _find_col(df, ['SEM_CUSTOM_SYMBOL'])
    if _parsed and ccustom:
        try:
            _mon  = _parsed['month'][:3].upper()  # 'MAR'
            _day  = _parsed['day'].lstrip('0') or '0'
            _str  = _parsed['strike']
            _und  = _parsed['underlying']
            _ot   = _parsed.get('option_type', '')
            _cpt  = 'CALL' if _ot in ('CE', 'CALL') else 'PUT' if _ot in ('PE', 'PUT') else ''
            if _cpt:
                _custom_q = f"{_und} {_day} {_mon} {_str} {_cpt}"
                _cm = df[df[ccustom].astype(str).str.upper() == _custom_q.upper()]
                if not _cm.empty:
                    return _row_to_result(_cm.iloc[0], 100, str(_cm.iloc[0].get(ccustom, '')))
        except Exception:
            pass

    # 1 ── Exact match on trading symbol column
    if sym_index is not None and s in sym_index.groups:
        rows = sym_index.get_group(s)
        # Prefer NSE_FNO rows
        if cseg:
            fno = rows[rows[cseg].astype(str).str.contains('FNO|NSE_FNO', na=False)]
            if not fno.empty:
                return _row_to_result(fno.iloc[0], 100, s)
        return _row_to_result(rows.iloc[0], 100, s)

    # 2 ── Component-based match for options/futures
    parsed = _parse_nse_symbol(symbol, trade_date)
    if parsed:
        sub = df.copy()

        # Filter by instrument type (OPTIDX / OPTSTK / FUTIDX / FUTSTK)
        if cinst and parsed.get('instrument'):
            sub = sub[sub[cinst].astype(str).str.upper() == parsed['instrument'].upper()]

        # Filter by option type (CE/PE)
        if copt and parsed.get('option_type'):
            sub = sub[sub[copt].astype(str).str.upper() == parsed['option_type'].upper()]

        # Filter by strike price
        if cstk and parsed.get('strike'):
            try:
                sv = float(parsed['strike'])
                sub = sub[sub[cstk].astype(str).str.replace(',', '').apply(
                    lambda x: abs(float(x) - sv) < 0.01
                    if _re.sub(r'[^0-9.]', '', x) else False
                )]
            except Exception:
                pass

        # Filter by expiry date
        # Dhan scrip master expiry can be: "2026-02-10", "10-FEB-2026", "2026-02-10 00:00:00" etc.
        if cexp and parsed.get('month') and parsed.get('year'):
            mon   = parsed['month'][:3].upper()   # 'FEB'
            yr4   = parsed['year']                # '2026'
            yr2   = parsed['year2']               # '26'
            dd    = parsed.get('day', '')         # '10'
            exp_s = sub[cexp].astype(str)

            # Must contain month + year
            month_mask = (
                exp_s.str.upper().str.contains(mon, na=False) |
                exp_s.str.contains(parsed.get('month_num',''), na=False)
            )
            year_mask = exp_s.str.contains(yr4, na=False) | exp_s.str.contains(yr2, na=False)
            sub = sub[month_mask & year_mask]

            # For weekly options, filter by exact expiry day (crucial — same month has multiple weekly expiries)
            # Regex allows end-of-string after the day number (e.g. "2026-03-17" ends with "17")
            if dd:
                day_mask = exp_s.str.contains(
                    r'[-/\s]0?' + dd + r'(?:[-/\sT]|$)', regex=True, na=False
                )
                narrowed = sub[day_mask]
                if not narrowed.empty:
                    sub = narrowed

        # Filter by underlying at start of trading symbol
        if csym and parsed.get('underlying'):
            und = parsed['underlying']
            sub = sub[sub[csym].astype(str).str.upper().str.startswith(und)]

        if len(sub) == 1:
            return _row_to_result(sub.iloc[0], 95, str(sub.iloc[0].get(csym, '')))
        if 0 < len(sub) <= 3:
            return _row_to_result(sub.iloc[0], 70, str(sub.iloc[0].get(csym, '')))

    # 3 ── Partial text search (first 6 chars of symbol)
    if csym:
        q   = s[:max(6, len(s)//2)]
        sub = df[df[csym].astype(str).str.upper().str.contains(q, na=False, regex=False)]
        if cseg:
            fno = sub[sub[cseg].astype(str).str.contains('FNO', na=False)]
            if not fno.empty:
                sub = fno
        if not sub.empty:
            return _row_to_result(sub.iloc[0], 40, str(sub.iloc[0].get(csym, '')))

    return {'security_id': '', 'exchange_segment': 'NSE_FNO', 'instrument': 'OPTIDX',
            'confidence': 0, 'matched_symbol': '', 'error': 'no_match'}


# ── OHLC Cache helpers ────────────────────────────────────────────────────────

def _cache_path(security_id, trade_date):
    return os.path.join(OHLC_CACHE_DIR, f"{security_id}_{trade_date}.csv")


def _meta_path(security_id, trade_date):
    return os.path.join(OHLC_CACHE_DIR, f"{security_id}_{trade_date}.meta.json")


def _read_meta(security_id, trade_date):
    mp = _meta_path(security_id, trade_date)
    if not os.path.exists(mp):
        return {}
    with open(mp) as f:
        return json.load(f)


def _write_meta(security_id, trade_date, last_candle_time):
    with open(_meta_path(security_id, trade_date), 'w') as f:
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
    cp = _cache_path(security_id, trade_date)
    if not os.path.exists(cp):
        return None
    try:
        return pd.read_csv(cp)
    except Exception:
        return None


# ── OHLC Fetch ────────────────────────────────────────────────────────────────

def fetch_and_cache_ohlc(security_id, exchange_segment, instrument_type, trade_date, expiry_date=None):
    """
    Fetch 1-min OHLC from Dhan for given security + date.
    - Today  → intraday endpoint (live session)
    - Past   → historical endpoint
    - Auto-fill: if cache partial, fetches only missing candles
    """
    config = get_config()
    if not config:
        raise ValueError("Dhan credentials not configured")

    headers = _dhan_headers(config)
    today   = datetime.now().strftime('%Y-%m-%d')
    cp      = _cache_path(security_id, trade_date)
    meta    = _read_meta(security_id, trade_date)

    # ── Already complete? ──────────────────────────────────────────────────────
    last_candle = meta.get('last_candle_time', '')
    if last_candle >= f"{trade_date} 15:29":
        return load_cached_ohlc(security_id, trade_date)

    # ── Determine fetch range ──────────────────────────────────────────────────
    if trade_date == today:
        # Intraday — full current session
        url = f"{DHAN_API_BASE}/v2/charts/intraday"
        payload = {
            "securityId":      str(security_id),
            "exchangeSegment": exchange_segment,
            "instrument":      instrument_type,
            "interval":        1,
            "fromDate":        trade_date,
            "toDate":          trade_date,
        }
    else:
        # Historical — full day (Dhan historical accepts date-only; filter by date in parser)
        # expiryCode: 0 = non-derivative; for options/futures must be 1/2/3
        if expiry_date:
            try:
                from datetime import date as _date_cls
                days = (_date_cls.fromisoformat(expiry_date) - _date_cls.fromisoformat(trade_date)).days
                exp_code = 1 if days <= 7 else 2 if days <= 14 else 3
            except Exception:
                exp_code = 1
        else:
            exp_code = 0
        to_date = (datetime.strptime(trade_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        url = f"{DHAN_API_BASE}/v2/charts/historical"
        payload = {
            "securityId":      str(security_id),
            "exchangeSegment": exchange_segment,
            "instrument":      instrument_type,
            "expiryCode":      exp_code,
            "interval":        "1",
            "fromDate":        trade_date,
            "toDate":          to_date,
        }

    resp = _post_json(url, payload, headers)
    df_new = _parse_dhan_response(resp, trade_date)

    if df_new.empty:
        return load_cached_ohlc(security_id, trade_date) or pd.DataFrame()

    # ── Merge with existing cache ──────────────────────────────────────────────
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
    """
    Parse Dhan rollingoption response.
    Structure: resp['data']['ce' or 'pe']['open','high','low','close',...]
    Timestamps are not returned — generated from 09:15 at 1-min intervals.
    """
    data    = resp.get('data', {}) or {}
    key     = 'ce' if opt_type == 'CALL' else 'pe'
    opt     = data.get(key) or {}
    if not opt:
        return pd.DataFrame()

    opens  = opt.get('open',   []) or []
    highs  = opt.get('high',   []) or []
    lows   = opt.get('low',    []) or []
    closes = opt.get('close',  []) or []
    vols   = opt.get('volume', []) or []
    stamps = opt.get('timestamp', []) or []

    if not opens:
        return pd.DataFrame()

    rows = []
    if stamps:
        # Timestamps provided (future Dhan API versions may include them)
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
        # No timestamps — NSE market hours start 09:15, 1-min candles
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
    """Convert Dhan array response → DataFrame with datetime/time/open/high/low/close."""
    timestamps = resp.get('timestamp', [])
    if not timestamps:
        return pd.DataFrame()

    rows = []
    for ts, o, h, l, c, v in zip(
        timestamps,
        resp.get('open',   []),
        resp.get('high',   []),
        resp.get('low',    []),
        resp.get('close',  []),
        resp.get('volume', [None] * len(timestamps)),
    ):
        dt = datetime.fromtimestamp(int(ts))
        if dt.strftime('%Y-%m-%d') != trade_date:
            continue
        rows.append({
            'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
            'time':     dt.strftime('%H:%M:%S'),
            'open':  float(o), 'high': float(h),
            'low':   float(l), 'close': float(c),
            'volume': int(v) if v is not None else 0,
        })

    return pd.DataFrame(rows)
