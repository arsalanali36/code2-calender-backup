"""
services/dhan_service.py
------------------------
Dhan API integration — expired options, auto-mapper, OHLC cache + fetch.
Core helpers (config, scrip, symbol parser) → dhan_service_core.py
"""
import os
import json
import time
import threading
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


def _expired_option_cache_path(symbol, trade_date=None):
    safe = symbol.replace('_', ' ')
    # Simple naming: just SYMBOL.csv (contains all days)
    return os.path.join(OHLC_CACHE_DIR, f"{safe}.csv")


def _fetch_underlying_spot(underlying, trade_date, headers, entry_time=None):
    """
    Fetch underlying index price at entry_time on trade_date.
    Tries multiple segment/instrument combos — Dhan API varies by version.
    Returns close price as float, or None on failure.
    """
    sec_id = _UNDERLYING_SECURITY_IDS.get(underlying)
    if not sec_id:
        return None

    # FIRST: Try local archive for NIFTY
    if underlying == 'NIFTY':
        path = "data/Historical_OHLC/nifty_1m_dhan.csv"
        if os.path.exists(path):
            try:
                import pandas as pd
                df = pd.read_csv(path)
                df['datetime'] = pd.to_datetime(df['datetime'])
                t = entry_time if entry_time else '09:30'
                dt_str = f"{trade_date} {t}"
                # Handle cases where exact second might not match
                target = pd.to_datetime(dt_str)
                mask = (df['datetime'] >= target) & (df['datetime'] < target + pd.Timedelta(minutes=5))
                match = df.loc[mask].head(1)
                if not match.empty:
                    return float(match.iloc[0]['close'])
            except: pass

    # SECOND: Try API
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


def fetch_expired_option_ohlc(symbol, trade_date, entry_time=None, config=None):
    # 1. SKIP check at TOP for speed
    meta = _read_meta(symbol, trade_date)
    last_candle = meta.get('last_candle_time') or ''
    if last_candle.endswith('15:29'):
        return "ALREADY_COMPLETE"

    if not config:
        config = get_config()
    if not config:
        raise ValueError("Dhan credentials not configured.")
    
    # STEP 1: Try Auto-Mapper to get real SecurityID
    try:
        mapping = auto_map_instruments({symbol: trade_date})
        m = mapping.get(symbol)
        if m and m.get('security_id'):
            print(f"DEBUG: Found SecurityID {m['security_id']} for {symbol}. Fetching via Historical API.")
            return fetch_and_cache_ohlc(m['security_id'], m['exchange_segment'], m['instrument'], trade_date, m.get('expiry'), config=config)
        else:
            print(f"DEBUG: Auto-mapper could not find ID for {symbol}. Falling back to RollingOptions.")
    except Exception as e:
        print(f"DEBUG: Auto-mapper fallback: {e}")

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

    # -- Build expiry candidates (rollingoption)
    # expiryCode: 1 = current, 2 = next, 3 = far. 0 is for cash which is invalid for options.
    expiry_candidates = [
        ('WEEK', 1), ('WEEK', 2), ('WEEK', 3),
        ('MONTH', 1), ('MONTH', 2), ('MONTH', 3),
    ]

    # ── Get underlying spot to determine ATM → compute N ─────────────────────
    spot = _fetch_underlying_spot(underlying, trade_date, headers, entry_time)
    print(f"DEBUG: Found spot for {trade_date}: {spot}")
    if spot is not None:
        atm    = round(spot / step) * step
        n_calc = round((strike - atm) / step)
        print(f"DEBUG: Targeting ATM {atm}, strike {strike}, n_calc {n_calc}")
        # Focused search: try exactly the calculated offset, then +/- 1 for spot variance
        n_tries = list(dict.fromkeys([n_calc, n_calc-1, n_calc+1]))
    else:
        # Without spot, we can't accurately use RollingOption for specific strikes.
        # Fallback to a very small range if absolutely needed, or fail early.
        n_tries = [0] 
        print("DEBUG: Spot missing, targeting ATM(0) only.")

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
            time.sleep(0.6)      # Relaxed throttle to avoid 429 Rate Limit Breach
            payload = {
                "securityId":      str(sec_id),
                "exchangeSegment": "NSE_FNO",
                "instrument":      str(parsed.get('instrument', 'OPTIDX')),
                "interval":        1,
                "expiryCode":      int(exp_code),
                "expiryFlag":      str(expiry_flag),
                "strike":          str(strike_str),
                "drvOptionType":   str(opt_type),
                "requiredData":    ["open", "high", "low", "close", "volume"],
                "fromDate":        str(trade_date),
                "toDate":          str(to_date),
            }
            try:
                resp = _post_json(url, payload, headers)
            except RuntimeError as e:
                if "401" in str(e):
                    print("CRITICAL: Dhan Authentication failed (401). Please re-login.")
                    return "AUTH_FAILED"
                if "429" in str(e):
                    print("ALERT: Rate Limit hit (429)! Sleeping 30s as backoff...")
                    time.sleep(30)
                    continue
                raise e # Other errors

            try:
                import pandas as pd
                df = _parse_rollingoption_response(resp, trade_date, opt_type)
                if not df.empty:
                    # Merge logic
                    cp = _expired_option_cache_path(symbol, trade_date)
                    if os.path.exists(cp):
                        import pandas as pd
                        df_old = pd.read_csv(cp)
                        df = (pd.concat([df_old, df])
                                .drop_duplicates('datetime')
                                .sort_values('datetime')
                                .reset_index(drop=True))
                    
                    df.to_csv(cp, index=False)
                    _write_meta(symbol, trade_date, df['datetime'].max())
                    return df
            except Exception as e:
                print(f"ERROR parsing response for {expiry_flag}/{exp_code} @ {strike_str}: {e}")
                continue
    raise ValueError(f"Could not fetch data for {symbol} on {trade_date} even after trying all strikes/expiries.")

def get_sync_tasks(start_date=None, end_date=None):
    """Extract unique instrument-week tasks from trades_1.json within date range"""
    import pandas as pd
    trades_path = os.path.join('data', 'trades_1.json')
    if not os.path.exists(trades_path): return []
    try:
        with open(trades_path, 'r') as f:
            trades = json.load(f).get('trades', [])
    except: return []
    
    unique_tasks = []
    seen = set()
    
    # Range check - be very explicit
    s_filter = start_date if (start_date and str(start_date) != 'None' and str(start_date) != '') else "0000-00-00"
    e_filter = end_date if (end_date and str(end_date) != 'None' and str(end_date) != '') else "9999-99-99"
    
    for t in trades:
        sym = t.get('Instrument', '').strip()
        dt_str = t.get('trade_date', t.get('date', ''))
        if sym and dt_str and sym.upper() != 'INDEX' and '^' not in sym:
            # STRICT STRING COMPARISON (YYYY-MM-DD is lexicographical)
            if dt_str < s_filter or dt_str > e_filter:
                continue
            
            # Group by instrument and trade date (Exact task)
            key = f"{sym}_{dt_str}"
            if key not in seen:
                unique_tasks.append({'symbol': sym, 'start_date': dt_str, 'date': dt_str})
                seen.add(key)
    return unique_tasks

def sync_single_task(symbol, trade_date, config=None):
    """Sync specific instrument for 10 days lookback to ensure indicator warmup"""
    if not config:
        config = get_config()

    if not config:
        return {'status': 'error', 'error': 'Dhan credentials not found. Please login.'}

    # Ensure clean credentials for headers
    if 'access_token' in config:
        config['access_token'] = str(config['access_token']).strip()
    if 'client_id' in config:
        config['client_id'] = str(config['client_id']).strip()

    # Debug: Confirm active session
    masked = (config['access_token'][:8] + "...") if len(config['access_token']) > 8 else "***"
    print(f"DEBUG: Syncing {symbol} for {trade_date} | CID: {config.get('client_id')} | Token: {masked}")

    end_dt = datetime.strptime(trade_date, '%Y-%m-%d')
    start_dt = end_dt - timedelta(days=10) # 10 days lookback for EMA warmup
    
    synced = 0
    errors = 0
    curr = start_dt
    day_results = []
    while curr <= end_dt:
        if curr.weekday() < 5: 
            c_str = curr.strftime('%Y-%m-%d')
            try:
                res = fetch_expired_option_ohlc(symbol, c_str, config=config)
                
                # Use isinstance checks to avoid DataFrame ambiguity errors
                if isinstance(res, str) and res == "AUTH_FAILED":
                    print("CRITICAL: Sync aborted due to Auth Failure.")
                    return {'status': 'error', 'error': 'Dhan Authentication Failed. Please check your Access Token.', 'synced': synced, 'results': day_results}
                
                synced += 1
                status = 'OK'
                if isinstance(res, str) and res == "ALREADY_COMPLETE": 
                    status = 'SKIP'
                day_results.append({'date': c_str, 'status': status, 'weekday': curr.weekday()})
            except Exception as e:
                print(f"Sync error for {symbol} on {c_str}: {e}")
                errors += 1
                day_results.append({'date': c_str, 'status': 'ERR', 'weekday': curr.weekday()})
        curr += timedelta(days=1)
    return {'status': 'success', 'synced': synced, 'errors': errors, 'day_results': day_results}

def sync_all_traded_instruments():
    """
    Sync all instruments found in trades_1.json from their trade date 
    back to the start of that week (to ensure EMA warmup).
    """
    import pandas as pd
    trades_path = os.path.join('data', 'trades_1.json')
    if not os.path.exists(trades_path): return {"error": "trades_1.json not found"}
    
    try:
        with open(trades_path, 'r') as f:
            trades = json.load(f).get('trades', [])
    except: return {"error": "could not parse trades_1.json"}
    
    if not trades: return {"status": "success", "synced": 0}
    
    synced_count = 0
    errors = []
    
    # Group by instrument to avoid redundant hits
    unique_insts = {}
    for t in trades:
        sym = t.get('Instrument', '').strip()
        dt = t.get('trade_date', t.get('date', ''))
        if sym and dt:
            if sym not in unique_insts: unique_insts[sym] = set()
            unique_insts[sym].add(dt)
            
    for sym, dates in unique_insts.items():
        if sym.upper() == 'INDEX' or '^' in sym: continue
        
        # For each date this instrument was traded, fetch week-to-date
        for dt_str in sorted(list(dates)):
            try:
                # Find start of week (Monday)
                dt_obj = datetime.strptime(dt_str, '%Y-%m-%d')
                days_to_subtract = dt_obj.weekday() # 0 = Monday
                start_of_week = (dt_obj - timedelta(days=days_to_subtract)).strftime('%Y-%m-%d')
                
                # We fetch day by day from start_of_week to dt_str to ensure good merge
                curr = datetime.strptime(start_of_week, '%Y-%m-%d')
                end = datetime.strptime(dt_str, '%Y-%m-%d')
                
                while curr <= end:
                    c_str = curr.strftime('%Y-%m-%d')
                    # Weekends check
                    if curr.weekday() < 5: 
                        try:
                            # Use existing fetch logic (it handles merging internally now)
                            fetch_expired_option_ohlc(sym, c_str)
                            synced_count += 1
                        except Exception as e:
                            errors.append(f"{sym} on {c_str}: {str(e)}")
                    curr += timedelta(days=1)
            except Exception as e:
                errors.append(f"Global error for {sym}: {str(e)}")
                
    return {"status": "success", "synced": synced_count, "errors": errors}


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
    import pandas as pd
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
    import pandas as pd
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


# ── Historical OHLC (security_id path) — thin re-exports ─────────────────────
# Full implementation lives in dhan_ohlc_service to keep this file under 30 KB.
from services.dhan_ohlc_service import (
    get_ohlc_status,
    load_cached_ohlc,
    fetch_and_cache_ohlc,
    _parse_rollingoption_response,
    _parse_dhan_response,
    _cache_path,
)
# ── Removed from this file (now in dhan_ohlc_service.py) ─────────────────────
# _get_lock, _cache_path, _meta_path, _read_meta, _write_meta,
# get_ohlc_status, load_cached_ohlc, fetch_and_cache_ohlc,
# _perform_fetch_and_cache, _parse_rollingoption_response, _parse_dhan_response

