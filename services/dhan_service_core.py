"""
services/dhan_service_core.py
-----------------------------
Core Dhan utilities extracted from dhan_service.py to keep that file under 30 KB.
  - HTTP helper, credential storage, symbol map, scrip master
  - NSE symbol parser (_parse_nse_symbol)
  - Scrip-column finder (_find_col)
"""
import os
import json
import time
import urllib.request
import urllib.error
import urllib.parse
import pandas as pd
from datetime import datetime, timedelta

from config import OHLC_CACHE_DIR, DHAN_CONFIG_FILE, DHAN_SYMBOL_MAP_FILE, DHAN_SCRIP_MASTER

DHAN_API_BASE = "https://api.dhan.co"

os.makedirs(OHLC_CACHE_DIR, exist_ok=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _post_json(url, payload, headers):
    """Simple POST helper using stdlib urllib (no requests dependency)."""
    data = json.dumps(payload).encode('utf-8')
    req  = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"Dhan API {e.code}: {body[:300]}")


def _dhan_headers(config):
    return {
        'client-id':    config['client_id'],
        'access-token': config['access_token'],
        'Content-Type': 'application/json',
        'Accept':       'application/json',
    }


# ── Config ────────────────────────────────────────────────────────────────────

def save_config(client_id, access_token):
    with open(DHAN_CONFIG_FILE, 'w') as f:
        json.dump({
            'client_id':    client_id,
            'access_token': access_token,
            'saved_at':     datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }, f)


def get_config():
    if not os.path.exists(DHAN_CONFIG_FILE):
        return None
    with open(DHAN_CONFIG_FILE) as f:
        return json.load(f)


# ── Symbol Map ────────────────────────────────────────────────────────────────

def load_symbol_map():
    if not os.path.exists(DHAN_SYMBOL_MAP_FILE):
        return {}
    with open(DHAN_SYMBOL_MAP_FILE) as f:
        return json.load(f)


def save_symbol_map(mapping):
    with open(DHAN_SYMBOL_MAP_FILE, 'w') as f:
        json.dump(mapping, f, indent=2)


# ── Scrip Master ──────────────────────────────────────────────────────────────

SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv"

def download_scrip_master():
    urllib.request.urlretrieve(SCRIP_MASTER_URL, DHAN_SCRIP_MASTER)
    return True


def search_scrip(query, limit=25):
    """Search scrip master by keyword. Downloads if not present."""
    if not os.path.exists(DHAN_SCRIP_MASTER):
        download_scrip_master()

    df = pd.read_csv(DHAN_SCRIP_MASTER, low_memory=False)

    col_security_id = _find_col(df, ['SEM_SMST_SECURITY_ID', 'SECURITY_ID', 'security_id'])
    col_symbol      = _find_col(df, ['SEM_TRADING_SYMBOL',   'TRADING_SYMBOL', 'SEM_CUSTOM_SYMBOL'])
    col_segment     = _find_col(df, ['SEM_EXM_EXCH_ID',      'SEM_SEGMENT',    'EXCHANGE_SEGMENT'])
    col_instrument  = _find_col(df, ['SEM_INSTRUMENT_NAME',  'INSTRUMENT_NAME'])
    col_expiry      = _find_col(df, ['SEM_EXPIRY_DATE',       'EXPIRY_DATE'])
    col_strike      = _find_col(df, ['SEM_STRIKE_PRICE',      'STRIKE_PRICE'])
    col_option_type = _find_col(df, ['SEM_OPTION_TYPE',       'OPTION_TYPE'])

    q = query.upper().strip()
    mask = pd.Series(False, index=df.index)
    for col in df.columns:
        if df[col].dtype == object:
            mask |= df[col].astype(str).str.upper().str.contains(q, na=False, regex=False)

    results = df[mask].head(limit)

    out = []
    for _, row in results.iterrows():
        out.append({
            'security_id':      str(row.get(col_security_id, '')) if col_security_id else '',
            'symbol':           str(row.get(col_symbol, ''))      if col_symbol      else '',
            'exchange_segment': str(row.get(col_segment, ''))     if col_segment     else '',
            'instrument':       str(row.get(col_instrument, ''))  if col_instrument  else '',
            'expiry':           str(row.get(col_expiry, ''))      if col_expiry      else '',
            'strike':           str(row.get(col_strike, ''))      if col_strike      else '',
            'option_type':      str(row.get(col_option_type, '')) if col_option_type else '',
        })
    return out


# ── Auto-mapper helpers ───────────────────────────────────────────────────────

# Known index underlyings → OPTIDX, otherwise OPTSTK
_INDEX_UNDERLYINGS = {'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'}

import re as _re

_MON_TO_NUM = {'JAN':'01','FEB':'02','MAR':'03','APR':'04','MAY':'05','JUN':'06',
               'JUL':'07','AUG':'08','SEP':'09','OCT':'10','NOV':'11','DEC':'12'}
_MCODE_TO_MON = {'1':'JAN','2':'FEB','3':'MAR','4':'APR','5':'MAY','6':'JUN',
                 '7':'JUL','8':'AUG','9':'SEP','O':'OCT','N':'NOV','D':'DEC'}

# ── Pattern 1: Monthly option (Zerodha) ─────────────────────────────────────
# NIFTY26FEB25850PE  → underlying=NIFTY, day=26, month=FEB, strike=25850, type=PE
_RE_MONTHLY = _re.compile(
    r'^([A-Z]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+(?:\.\d+)?)(CE|PE)$'
)

# ── Pattern 2: Weekly option (Zerodha) ──────────────────────────────────────
# NIFTY2621025900CE  → underlying=NIFTY, YY=26, M_code=2(Feb), DD=10, strike=25900, CE
_RE_WEEKLY = _re.compile(
    r'^([A-Z]+?)(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$'
)

# ── Pattern 3: Dhan space-separated format ───────────────────────────────────
# "NIFTY 17 FEB 26000 PUT"   "NIFTY 24 FEB 25500 CALL"
_RE_DHAN_SPACE = _re.compile(
    r'^([A-Z]+)\s+(\d{1,2})(?:ST|ND|RD|TH)?\s+'
    r'(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+'
    r'(\d+)\s+(CALL|PUT|CE|PE)$'
)

# ── Pattern 4: Monthly Futures (Zerodha) ────────────────────────────────────
# NIFTY26FEBFUT
_RE_FUT = _re.compile(
    r'^([A-Z]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$'
)


def _parse_nse_symbol(symbol, trade_date=None):
    """
    Parse an NSE option/futures symbol (Zerodha or Dhan format).
    Returns a dict with components, or None if unrecognised.
    """
    s = symbol.upper().strip()

    if trade_date:
        trade_year  = int(str(trade_date)[:4])
        trade_month = int(str(trade_date)[5:7])
    else:
        from datetime import date as _date
        _t = _date.today()
        trade_year, trade_month = _t.year, _t.month

    def _year_for_month(exp_mon_num):
        return trade_year if exp_mon_num >= trade_month else trade_year + 1

    def _make(underlying, dd, mon, strike, opt_type, year, expiry_type='WEEK'):
        instrument = 'OPTIDX' if underlying in _INDEX_UNDERLYINGS else 'OPTSTK'
        yr2 = str(year)[-2:]
        return {
            'underlying': underlying, 'day': str(dd).zfill(2),
            'month': mon, 'month_num': _MON_TO_NUM[mon],
            'year': str(year), 'year2': yr2,
            'strike': str(strike), 'option_type': opt_type,
            'instrument': instrument, 'exchange_segment': 'NSE_FNO',
            'expiry_type': expiry_type,
        }

    m = _RE_MONTHLY.match(s)
    if m:
        underlying, dd, mon, strike, opt_type = m.groups()
        exp_mon = int(_MON_TO_NUM[mon])
        return _make(underlying, dd, mon, strike, opt_type, _year_for_month(exp_mon), expiry_type='MONTH')

    m = _RE_WEEKLY.match(s)
    if m:
        underlying, yy, mcode, dd, strike, opt_type = m.groups()
        mon = _MCODE_TO_MON.get(mcode)
        if mon:
            year = 2000 + int(yy)
            return _make(underlying, dd, mon, strike, opt_type, year, expiry_type='WEEK')

    m = _RE_DHAN_SPACE.match(s)
    if m:
        underlying, dd, mon, strike, callput = m.groups()
        opt_type = 'CE' if callput in ('CALL', 'CE') else 'PE'
        exp_mon  = int(_MON_TO_NUM[mon])
        return _make(underlying, dd, mon, strike, opt_type, _year_for_month(exp_mon), expiry_type='WEEK')

    m = _RE_FUT.match(s)
    if m:
        underlying, dd, mon = m.groups()
        instrument = 'FUTIDX' if underlying in _INDEX_UNDERLYINGS else 'FUTSTK'
        exp_mon    = int(_MON_TO_NUM[mon])
        year       = _year_for_month(exp_mon)
        return {
            'underlying': underlying, 'day': dd, 'month': mon,
            'month_num': _MON_TO_NUM[mon],
            'year': str(year), 'year2': str(year)[-2:],
            'instrument': instrument, 'exchange_segment': 'NSE_FNO',
        }
    return None


# ── Scrip column finder ───────────────────────────────────────────────────────

def _find_col(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    for c in candidates:
        for col in df.columns:
            if c.lower() in col.lower():
                return col
    return None
