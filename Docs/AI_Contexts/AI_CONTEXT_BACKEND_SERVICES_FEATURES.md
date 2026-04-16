# Backend - Feature Services (csvlog, strategy)
Consolidated code context for AI assistants.


## File: `services/csvlog_service.py`
```py
"""
services/csvlog_service.py
--------------------------
Parse LOGGER.xlsx schema and return structured JSON for the CSVLog modal.
No Flask imports, no request/response objects.
"""
import os
import re


def _to_key(head):
    return re.sub(r'^_|_$', '', re.sub(r'[^a-z0-9]+', '_', head.lower()))


def load_schema(schema_file):
    """
    Parse the csvlog_schema.xlsx file.
    Returns dict:
        {
          "groups": ["Zone", "Entry", "Exit", "PSy"],
          "fields": {
            "Zone": [
              { "head": "formed", "type": "Switch", "input": "Y/N", "options": ["Y", "N"] },
              ...
            ],
            ...
          }
        }
    Only rows with Display == "Show" are included.
    Returns None if file doesn't exist.
    Returns {"error": "..."} on parse failure.
    """
    if not os.path.exists(schema_file):
        return None

    try:
        import openpyxl
        wb = openpyxl.load_workbook(schema_file, data_only=True)
        ws = wb.active

        groups_order = []
        fields = {}

        for row in ws.iter_rows(min_row=2, values_only=True):
            # Columns: Group, Head, Input, Type, Display, Description
            padded = list(row) + [None] * 6
            group, head, input_val, type_val, display = (
                padded[0], padded[1], padded[2], padded[3], padded[4]
            )

            if not group or not head:
                continue
            if str(display or '').strip().lower() != 'show':
                continue

            group    = str(group).strip()
            head     = str(head).strip()
            type_val = str(type_val or '').strip()
            input_val = str(input_val).strip() if input_val is not None else None

            if group not in fields:
                groups_order.append(group)
                fields[group] = []

            # Parse options list for Dropdown / Range types
            options = None
            if input_val and type_val in ('Dropdown', 'Range'):
                # Strip surrounding quotes, normalise newlines → commas
                clean = input_val.strip('"').replace('\n', ',')
                options = [o.strip() for o in clean.split(',') if o.strip()]

            # Y/N Switch → options list
            if type_val == 'Switch' and input_val == 'Y/N':
                options = ['Y', 'N']

            fields[group].append({
                'head':    head,
                'type':    type_val,
                'input':   input_val,
                'options': options,
            })

        return {'groups': groups_order, 'fields': fields}

    except Exception as exc:
        return {'error': str(exc)}


def export_csvlog_excel(trades, schema_file=None):
    """
    Export all trades with csvlog data to an Excel BytesIO.
    Returns (BytesIO, None) on success, (None, error_str) on failure.
    """
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Side, Border
        from io import BytesIO
    except ImportError:
        return None, 'openpyxl not installed'

    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'CSVLog Export'

        # ── Build ordered list of csvlog columns ──────────────────────────────
        # (group_key, field_key, display_label)
        csvlog_cols = []
        seen_cols = set()

        schema = load_schema(schema_file) if schema_file and os.path.exists(schema_file) else None
        if schema:
            for group in schema.get('groups', []):
                gk = group.lower()
                section = ''
                for field in schema['fields'].get(group, []):
                    if field['type'] == '-':
                        section = _to_key(field['head'])
                        continue
                    fk = (_to_key(section + '_' + field['head']) if section
                          else _to_key(field['head']))
                    label = f"{group} / {field['head']}"
                    pair = (gk, fk)
                    if pair not in seen_cols:
                        seen_cols.add(pair)
                        csvlog_cols.append((gk, fk, label))

        # Explicitly add Body Vitals columns with nice labels
        _vitals_keys = [
            ('alertness', 'Body Vitals / Alertness'),
            ('neend',     'Body Vitals / Neend (Sleep)'),
            ('potty',     'Body Vitals / Potty'),
            ('sabar',     'Body Vitals / Sabar vs Impulsive'),
        ]
        for fk, label in _vitals_keys:
            pair = ('body_vitals', fk)
            if pair not in seen_cols:
                seen_cols.add(pair)
                csvlog_cols.append(('body_vitals', fk, label))

        # Pick up any extra keys from actual data
        for trade in trades:
            for gk, fdata in (trade.get('csvlog') or {}).items():
                if not isinstance(fdata, dict):
                    continue
                for fk in fdata:
                    if fk.endswith('_obs') or fk == '_meta':
                        continue
                    pair = (gk, fk)
                    if pair not in seen_cols:
                        seen_cols.add(pair)
                        csvlog_cols.append((gk, fk, f"{gk} / {fk}"))

        # ── Headers ───────────────────────────────────────────────────────────
        base_hdrs = ['Date', 'Instrument', 'TradeType', 'Qty',
                     'Entry Time', 'Exit Time', 'P/L (Rs)', 'Points', 'Note']
        obs_hdr = ['Observations']
        all_hdrs = base_hdrs + [c[2] for c in csvlog_cols] + obs_hdr
        ws.append(all_hdrs)

        # Style header row
        hdr_fill = PatternFill('solid', fgColor='1E2535')
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = hdr_fill
            cell.alignment = Alignment(horizontal='center')

        # ── Data rows ─────────────────────────────────────────────────────────
        def _pick(t, *keys):
            for k in keys:
                v = t.get(k)
                if v is not None and v != '':
                    return v
            return ''

        for trade in trades:
            date      = _pick(trade, 'trade_date', 'Date', 'date')
            instr     = _pick(trade, 'Instrument', 'instrument', 'INSTRUMENT')
            ttype     = _pick(trade, 'TradeType', 'tradetype', 'TRADETYPE')
            qty       = _pick(trade, 'Qty', 'qty', 'QTY')
            buy_t     = _pick(trade, 'Buy Time', 'buy_time', 'BUY TIME')
            sell_t    = _pick(trade, 'Sell Time', 'sell_time', 'SELL TIME')
            pnl       = _pick(trade, 'Net P/L', 'Gross P/L', 'Rs', 'rs', 'RS')
            points    = _pick(trade, 'Pt', 'pt')
            note      = _pick(trade, 'Note', 'note')

            # Entry = earlier time
            try:
                def _tsec(s):
                    p = str(s).split(':')
                    return int(p[0])*3600 + int(p[1])*60 + int(p[2] if len(p)>2 else 0)
                entry_t, exit_t = (buy_t, sell_t) if (_tsec(buy_t) <= _tsec(sell_t)) else (sell_t, buy_t)
            except Exception:
                entry_t, exit_t = buy_t, sell_t

            base_row = [date, instr, ttype, qty, entry_t, exit_t, pnl, points, note]

            csvlog = trade.get('csvlog') or {}
            csvlog_vals = []
            obs_parts = []
            for gk, fk, _ in csvlog_cols:
                gdata = csvlog.get(gk) or {}
                val = gdata.get(fk, '')
                csvlog_vals.append(val)
                obs_val = gdata.get(fk + '_obs', '')
                if obs_val:
                    obs_parts.append(f"[{gk}] {fk.replace('_',' ')}: {obs_val}")

            # Use manually edited obs text if exists
            meta = (csvlog.get('_meta') or {})
            compiled_obs = meta.get('obs_text', '') or '\n'.join(obs_parts)

            ws.append(base_row + csvlog_vals + [compiled_obs])

        # Auto-width columns
        for col in ws.columns:
            w = max((len(str(c.value or '')) for c in col), default=8)
            ws.column_dimensions[col[0].column_letter].width = min(max(w + 2, 10), 45)

        out = BytesIO()
        wb.save(out)
        out.seek(0)
        return out, None

    except Exception as exc:
        return None, str(exc)


def generate_logger_template(schema_file=None):
    """
    Generate a protected LOGGER.xlsx template BytesIO.
    - Preserves existing schema rows from schema_file (if available)
    - Appends Body Vitals group rows if not already present
    - Row 1 header is locked; sheet protected to prevent col delete/rename
    - No password → user can unprotect anytime (protects against accidents)
    Returns (BytesIO, None) or (None, error_str).
    """
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Protection
        from openpyxl.worksheet.protection import SheetProtection
        from io import BytesIO
    except ImportError:
        return None, 'openpyxl not installed'

    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'LOGGER Schema'

        # ── Header row ──────────────────────────────────────────────────────
        headers = ['Group', 'Head', 'Input', 'Type', 'Display', 'Description']
        ws.append(headers)
        hdr_fill = PatternFill('solid', fgColor='1A3050')
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = hdr_fill
            cell.alignment = Alignment(horizontal='center')
            cell.protection = Protection(locked=True)   # lock header cells

        # ── Column widths ────────────────────────────────────────────────────
        for col, w in zip('ABCDEF', [16, 22, 30, 12, 10, 35]):
            ws.column_dimensions[col].width = w

        # ── Load existing schema rows ────────────────────────────────────────
        existing_rows = []
        has_body_vitals = False
        if schema_file and os.path.exists(schema_file):
            try:
                src = openpyxl.load_workbook(schema_file, data_only=True)
                sw = src.active
                for row in sw.iter_rows(min_row=2, values_only=True):
                    vals = list(row) + [None] * 6
                    grp = str(vals[0] or '').strip()
                    if grp.lower() == 'body vitals' or grp.lower() == 'body_vitals':
                        has_body_vitals = True
                    if grp:
                        existing_rows.append(vals[:6])
            except Exception:
                pass

        # Fill existing rows — data cells unlocked so user can edit values
        for r in existing_rows:
            ws.append(r)

        # ── Append Body Vitals if not present ────────────────────────────────
        _VITALS_ROWS = [
            ['Body Vitals', 'Alertness',         '-5,5', 'Range', 'Show', 'Physical alertness level'],
            ['Body Vitals', 'Neend',             '-5,5', 'Range', 'Show', 'Sleep quality last night'],
            ['Body Vitals', 'Potty',             '-5,5', 'Range', 'Show', 'Gut health / comfort'],
            ['Body Vitals', 'Sabar vs Impulsive','-5,5', 'Range', 'Show', 'Patience vs impulsiveness'],
        ]
        if not has_body_vitals:
            ws.append([None] * 6)   # blank spacer row
            for r in _VITALS_ROWS:
                ws.append(r)

        # ── Style data rows: A-D locked (group/head/input/type), E-F editable ─
        # Note: only meaningful when sheet protection is on.
        # A,B = Group,Head locked so names stay stable; C,D,E,F editable.
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                locked = cell.column_letter in ('A', 'B')
                cell.protection = Protection(locked=locked)

        # ── Sheet protection (no password → easy to unprotect intentionally) ──
        ws.protection.sheet          = True
        ws.protection.deleteColumns  = True   # prevent column deletion
        ws.protection.insertColumns  = True   # prevent inserting columns
        ws.protection.sort           = True   # prevent sorting (rearranging)
        # Allow: editing unlocked cells (E=Display, C=Input, D=Type, F=Desc),
        #        inserting rows (adding new fields), selecting any cell.
        ws.protection.insertRows     = False
        ws.protection.deleteRows     = False
        ws.protection.selectLockedCells   = True
        ws.protection.selectUnlockedCells = True

        # ── Instructions sheet ───────────────────────────────────────────────
        ws2 = wb.create_sheet('Instructions')
        ws2.column_dimensions['A'].width = 70
        instructions = [
            ['LOGGER.xlsx — Instructions'],
            [''],
            ['Column guide:'],
            ['  A: Group    — e.g. Zone / Entry / Exit / Body Vitals  (LOCKED — do not rename)'],
            ['  B: Head     — field label shown in the app             (LOCKED — do not rename)'],
            ['  C: Input    — Y/N for Switch; options for Dropdown; min,max for Range'],
            ['  D: Type     — Switch | Input | Dropdown | Range | -    (- = section separator)'],
            ['  E: Display  — Show or Hide'],
            ['  F: Description — your notes (ignored by app)'],
            [''],
            ['Bidirectional sliders: set Input = "-5,5" (or any negative,positive range).'],
            ['  The slider will be centered at 0 and fill green(+) or red(-).'],
            [''],
            ['Conditional freeze rules (built into app, not in schema):'],
            ['  Zone  : If "Zone Created" = N  → Size and Candle fields are frozen'],
            ['  Entry : If "At"  contains "pehle" → Breakout Candle field is frozen'],
            [''],
            ['To add a new field: insert a row below existing ones (allowed).'],
            ['To hide a field:   change Display column from "Show" to "Hide".'],
            ['Columns A-B are locked to prevent accidental renaming.'],
        ]
        for r in instructions:
            ws2.append(r)
        ws2['A1'].font = Font(bold=True, size=13)

        out = BytesIO()
        wb.save(out)
        out.seek(0)
        return out, None

    except Exception as exc:
        return None, str(exc)

```

## File: `services/strategy_service.py`
```py
import pandas as pd
import numpy as np
try:
    import yfinance as yf
except ImportError:
    yf = None
import json
import os
import pytz
import calendar
import requests
import time
import sys
import functools
from datetime import datetime, timedelta

ist_tz = pytz.timezone('Asia/Kolkata')

# Import auto sync service
try:
    from services.auto_sync_service import add_to_sync
except ImportError:
    def add_to_sync(inst, dt): pass

# Global cache for OHLC Dataframes to make switching near-instant
@functools.lru_cache(maxsize=128)
def _get_cached_raw_data(path, mtime):
    # mtime is passed so that if file changes, cache is invalidated
    df = pd.read_csv(path)
    if 'datetime' in df.columns:
        df['datetime'] = pd.to_datetime(df['datetime'])
    return df

# DHAN CREDENTIALS
DHAN_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"

def calculate_ema(df, length):
    return df['Close'].ewm(span=length, adjust=False).mean()

def detect_candle_patterns(df):
    # Parameters from Arsalan_Reversal_NIFTY.txt (Tightened to reduce noise)
    min_body_size = 2.0
    wick_ratio = 2.5
    prev_body_min_pts = 2.0

    body = (df['Close'] - df['Open']).abs()
    is_green = df['Close'] > df['Open']
    is_red = df['Close'] < df['Open']
    high = df['High']; low = df['Low']; open_p = df['Open']; close_p = df['Close']
    
    upper_wick = high - close_p.where(is_green, open_p)
    lower_wick = open_p.where(is_green, close_p) - low
    
    # 1. Hammer Logic (Exact from your script)
    valid_body = body >= min_body_size
    df['green_hammer'] = valid_body & is_green & (lower_wick >= 2.5 * body) & (upper_wick <= body)
    df['red_hammer'] = valid_body & is_red & (lower_wick >= 2.5 * body) & (upper_wick <= body)
    
    # 2. Inverted Hammer Logic
    inverted_shape = valid_body & (upper_wick >= 2.5 * body) & (lower_wick <= body)
    df['inv_red_hammer'] = inverted_shape & is_red
    
    # 3. Engulfing Logic (Strict Match: Strictly larger and covers)
    prev_body = body.shift(1)
    df['bull_engulf'] = (is_red.shift(1)) & (is_green) & (open_p < close_p.shift(1)) & (close_p > open_p.shift(1)) & (body > prev_body) & (prev_body >= prev_body_min_pts)
    df['bear_engulf'] = (is_green.shift(1)) & (is_red) & (open_p > close_p.shift(1)) & (close_p < open_p.shift(1)) & (body > prev_body) & (prev_body >= prev_body_min_pts)
    
    # 4. Harami Logic (Strict Match: Strictly inside and 50% rule)
    body_50_pct = body >= prev_body * 0.5
    df['bull_harami'] = (is_red.shift(1)) & (is_green) & (open_p > close_p.shift(1)) & (close_p < open_p.shift(1)) & body_50_pct
    df['bear_harami'] = (is_green.shift(1)) & (is_red) & (open_p < close_p.shift(1)) & (close_p > open_p.shift(1)) & body_50_pct
    
    # 5. Stars (Existing)
    ms_cond = (is_red.shift(2)) & (body.shift(1) < body.shift(2) * 0.5) & (is_green) & (close_p > (open_p.shift(2) + close_p.shift(2)) / 2)
    df['morning_star'] = ms_cond
    es_cond = (is_green.shift(2)) & (body.shift(1) < body.shift(2) * 0.5) & (is_red) & (close_p < (open_p.shift(2) + close_p.shift(2)) / 2)
    df['evening_star'] = es_cond
    
    # Apply Colors
    df['bar_color'] = None # Clear old colors
    df.loc[df['bull_engulf'], 'bar_color'] = '#000000'
    df.loc[df['bear_engulf'], 'bar_color'] = '#020000'
    df.loc[df['bull_harami'], 'bar_color'] = 'rgba(0, 255, 0, 0.3)'
    df.loc[df['bear_harami'], 'bar_color'] = 'rgba(255, 0, 0, 0.3)'
    
    return df

def run_pinned_strategy_logic(df):
    if df.empty: return df
    df['ema10'] = calculate_ema(df, 10); df['ema20'] = calculate_ema(df, 20)
    df = detect_candle_patterns(df)
    df['ema_touch'] = (df['Low'] <= df['ema10']) & (df['High'] >= df['ema10']) | (df['Low'] <= df['ema20']) & (df['High'] >= df['ema20'])
    df['bull_trigger'] = df['ema_touch'] & (df['bull_engulf'] | df['morning_star'] | df['green_hammer'])
    df['bear_trigger'] = df['ema_touch'] & (df['bear_engulf'] | df['evening_star'] | df['inv_red_hammer'] | df['red_hammer'])
    return df

def run_sandbox_strategy_logic(df):
    if df.empty: return df, []
    
    # Pre-calculate Indicators
    df['ema10'] = calculate_ema(df, 10)
    df['ema20'] = calculate_ema(df, 20)
    df = detect_candle_patterns(df)
    
    # 1. Load Manual Levels from JSON
    manual_data = {}
    json_path = os.path.join('data', 'manual_pivots.json')
    if os.path.exists(json_path):
        import json
        with open(json_path, 'r') as f:
            manual_data = json.load(f)

    sym_key = 'NIFTY' if 'Nifty' in df.attrs.get('symbol', 'Nifty') else df.attrs.get('symbol', 'NIFTY')
    
    df = df.copy()
    # Add columns for levels
    for col in ['pdh', 'pdl', 'pdc', 'pp', 'r1', 's1', 'r2', 's2', 'r3', 's3', 'r4', 's4', 'r5', 's5']:
        df[col] = np.nan

    unique_dates = pd.Series(df.index.date).unique()
    
    for d in unique_dates:
        d_str = d.strftime('%Y-%m-%d')
        m_levels = None
        if sym_key in manual_data and d_str in manual_data[sym_key]:
            m_levels = manual_data[sym_key][d_str]
        
        mask = df.index.date == d
        if m_levels:
            day_indices = np.where(mask)[0]
            active_levels = {k: False for k in m_levels.keys()}
            
            for idx in day_indices:
                row = df.iloc[idx]
                low, high = row['Low'], row['High']
                
                for k, val in m_levels.items():
                    # If already active, keep filling
                    if active_levels[k]:
                        df.iloc[idx, df.columns.get_loc(k)] = val
                    # If not active, check for touch (Key Candle)
                    elif low <= val <= high:
                        active_levels[k] = True
                        df.iloc[idx, df.columns.get_loc(k)] = val
        else:
            # Explicitly skip/leave as NaN if manual data is missing
            pass
    
    # 2. Logic state variables
    touch_active = False
    line_type = None 
    hh_price = None; ll_price = None
    active_green_zone = None; active_red_zone = None
    
    df['bull_trigger'] = False
    df['bear_trigger'] = False
    final_zones = []
    level_cols = ['pp', 'r1', 's1', 'r2', 's2', 'r3', 's3', 'pdh', 'pdl', 'pdc']
    
    for i in range(len(df)):
        row = df.iloc[i]
        curr_time = df.index[i]
        if i > 0 and df.index[i].date() != df.index[i-1].date():
            touch_active = False; active_green_zone = None; active_red_zone = None; hh_price = None; ll_price = None

        touched = False; current_line_type = None
        low, high = row['Low'], row['High']
        
        for col in level_cols:
            val = row[col]
            if pd.notnull(val) and low <= val <= high:
                touched = True
                if col in ['r1', 'r2', 'r3']: current_line_type = 'RESISTANCE'
                elif col in ['s1', 's2', 's3']: current_line_type = 'SUPPORT'
                elif col == 'pp': current_line_type = 'CP'
                elif col == 'pdh': current_line_type = 'PD_H'
                elif col == 'pdl': current_line_type = 'PD_L'
                elif col == 'pdc': current_line_type = 'PD_C'
                break
        
        if touched:
            if not touch_active:
                touch_active = True
                hh_price = high; ll_price = low
                line_type = current_line_type
            else:
                hh_price = max(hh_price, high) if hh_price else high
                ll_price = min(ll_price, low) if ll_price else low
            
        is_bullish = row['Close'] > row['Open']; is_bearish = row['Close'] < row['Open']
        
        if touch_active and is_bullish and line_type not in ['RESISTANCE', 'PD_H']:
            active_green_zone = {'upper': high, 'lower': low}
            touch_active = False
            final_zones.append({'start_time': int(curr_time.timestamp()), 'end_time': int((curr_time + timedelta(minutes=45)).timestamp()), 'high': float(high), 'low': float(low), 'type': 'bull', 'size': float(high - low)})
            
        if touch_active and is_bearish and line_type not in ['SUPPORT', 'PD_L']:
            active_red_zone = {'upper': high, 'lower': low}
            touch_active = False
            final_zones.append({'start_time': int(curr_time.timestamp()), 'end_time': int((curr_time + timedelta(minutes=45)).timestamp()), 'high': float(high), 'low': float(low), 'type': 'bear', 'size': float(high - low)})

        if active_green_zone and row['Close'] > active_green_zone['upper']:
            if i > 0 and df.iloc[i-1]['Close'] > df.iloc[i-1]['Open']:
                df.iloc[i, df.columns.get_loc('bull_trigger')] = True
                active_green_zone = None
        
        if active_red_zone and row['Close'] < active_red_zone['lower']:
            if i > 0 and df.iloc[i-1]['Close'] < df.iloc[i-1]['Open']:
                df.iloc[i, df.columns.get_loc('bear_trigger')] = True
                active_red_zone = None

    return df, final_zones

def run_reversal_strategy_logic(df, hawa_me_zone=False):
    if df.empty: return df, []
    
    # 1. Dynamic Level Loader (from parsed Excel)
    json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'daily_pivot_levels.json')
    daily_levels_map = {}
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                daily_levels_map = json.load(f)
        except Exception as e:
            print(f"Error loading pivot JSON: {e}")
    
    # Fallback/Default levels for days not in the map
    default_levels = {
        'pdh': 24074.05, 'pdc': 24050.6, 'pdl': 23856.35,
        'r5': 25623.3, 'r4': 24486.0, 'r3': 24348.7, 'r2': 24211.35, 'r1': 24131.0,
        'pp': 23993.65, 's1': 23913.3, 's2': 23775.95, 's3': 23695.6, 's4': 23615.2, 's5': 23534.8
    }
    
    df = df.copy()
    # Pre-calculate Indicators
    df['ema10'] = calculate_ema(df, 10); df['ema20'] = calculate_ema(df, 20)
    df = detect_candle_patterns(df)
    
    # State Variables
    green_zone = None; red_zone = None
    touch_active_bull = False; touch_active_bear = False
    active_line_type_bull = None; active_line_type_bear = None
    
    df['bull_trigger'] = False; df['bear_trigger'] = False
    final_zones = []
    
    def get_line_type(name):
        n = name.lower()
        if n.startswith('r'): return "RESISTANCE"
        if n.startswith('s'): return "SUPPORT"
        if n == 'pp': return "PIVOT"
        if n == 'pdh': return "PD_H"
        if n == 'pdl': return "PD_L"
        if n == 'pdc': return "PD_C"
        return "UNKNOWN"

    for i in range(len(df)):
        curr_time = df.index[i]
        curr_date_str = curr_time.strftime('%Y-%m-%d')
        # Load levels for THIS specific day
        levels = daily_levels_map.get(curr_date_str, default_levels)
        # Apply levels to dataframe columns for chart display
        # Apply levels with sanity cap (Prevent 30k+ scaling bugs)
        for k, v in levels.items():
            if k not in df.columns: df[k] = None
            if v is not None and isinstance(v, (int, float)) and v > 30000: v = None
            df.iloc[i, df.columns.get_loc(k)] = v
        
        row = df.iloc[i]
        low, high, close, open_p = row['Low'], row['High'], row['Close'], row['Open']
        
        # Reset on new day
        if i > 0 and df.index[i].date() != df.index[i-1].date():
            green_zone = None; red_zone = None
            touch_active_bull = False; touch_active_bear = False

        # Check for touches
        touched = False
        active_line_type = None
        buffer_val = 5.0 if hawa_me_zone else 0.0
        for k, v in levels.items():
            if (low - buffer_val) <= v <= (high + buffer_val):
                touched = True
                active_line_type = get_line_type(k)
                break
        
        # Candle Pattern Detection 
        is_bullish_candle = close > open_p
        is_bearish_candle = close < open_p
        
        # Specific Patterns (Hammer, Engulfing, etc.)
        pattern_bull = row['green_hammer'] or row['bull_engulf'] or row['morning_star'] or row['bull_harami']
        pattern_bear = row['red_hammer'] or row['inv_red_hammer'] or row['bear_engulf'] or row['evening_star'] or row['bear_harami']

        # 3. Zone Creation Logic: (touched and pattern in the SAME candle)
        if touched:
            if pattern_bull and not green_zone and active_line_type not in ["RESISTANCE", "PD_H"]:
                green_zone = {'upper': float(high), 'lower': float(low), 'start_time': curr_time}
                final_zones.append({
                    'start_time': int(curr_time.timestamp()), 
                    'end_time': int((curr_time + timedelta(minutes=45)).timestamp()), 
                    'high': float(high), 'low': float(low), 'type': 'bull', 'size': float(high - low)
                })
            elif pattern_bear and not red_zone and active_line_type not in ["SUPPORT", "PD_L"]:
                red_zone = {'upper': float(high), 'lower': float(low), 'start_time': curr_time}
                final_zones.append({
                    'start_time': int(curr_time.timestamp()), 
                    'end_time': int((curr_time + timedelta(minutes=45)).timestamp()), 
                    'high': float(high), 'low': float(low), 'type': 'bear', 'size': float(high - low)
                })

        # Entry logic: Close above/below zone
        if green_zone and close > green_zone['upper'] and is_bullish_candle:
            # Check if this is relatively fresh (Max 10 bars)
            if (curr_time - green_zone['start_time']).total_seconds() < 3600: # approx 10x3m or 20x3m
                df.iloc[i, df.columns.get_loc('bull_trigger')] = True
            green_zone = None # Action taken or zone cleared
            
        if red_zone and close < red_zone['lower'] and is_bearish_candle:
            if (curr_time - red_zone['start_time']).total_seconds() < 3600:
                df.iloc[i, df.columns.get_loc('bear_trigger')] = True
            red_zone = None

    return df, final_zones

def resample_ohlc(df, timeframe):
    if timeframe == '1m': return df
    freq = timeframe.replace('m', 'min').replace('M', 'min')
    # Normalize input columns to match rules
    df.columns = [c.capitalize() if c.lower() in ['open','high','low','close','volume'] else c for c in df.columns]
    rules = {'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last'}
    # origin='start_day' ensures 09:15 aligns perfectly with 3min/5min bins
    resampled = df.resample(freq, label='left', closed='left', origin='start_day').agg(rules)
    return resampled.dropna()


```

## File: `services/strategy_data_service.py`
```py
"""
services/strategy_data_service.py
----------------------------------
Data-fetching layer for Strategy Lab: Dhan API, yfinance, archive dates.
Strategy logic (EMA, candle patterns, run_* functions) lives in strategy_service.py.
"""
import pandas as pd
import numpy as np
try:
    import yfinance as yf
except ImportError:
    yf = None
import json
import os
import functools
import requests
import time
from datetime import datetime, timedelta

from services.strategy_service import (
    DHAN_ACCESS_TOKEN,
    _get_cached_raw_data,
    resample_ohlc,
    run_pinned_strategy_logic,
    run_sandbox_strategy_logic,
    run_reversal_strategy_logic,
)

try:
    from services.auto_sync_service import add_to_sync
except ImportError:
    def add_to_sync(inst, dt): pass


def fetch_dhan_api_data(from_date, to_date, token=DHAN_ACCESS_TOKEN):
    url = "https://api.dhan.co/charts/intraday"
    all_data = []
    curr = datetime.strptime(from_date, '%Y-%m-%d'); end = datetime.strptime(to_date, '%Y-%m-%d')
    while curr <= end:
        ds = curr.strftime('%Y-%m-%d')
        payload = {"securityId": "13", "exchangeSegment": "IDX_I", "instrument": "INDEX", "fromDate": ds, "toDate": ds}
        headers = {"Content-Type": "application/json", "access-token": token}
        try:
            res = requests.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                d = res.json()
                if 'open' in d and d['open']:
                    for i in range(len(d['open'])):
                        dt = curr.replace(hour=9, minute=15) + timedelta(minutes=i)
                        all_data.append({'Datetime': dt, 'Open': d['open'][i], 'High': d['high'][i], 'Low': d['low'][i], 'Close': d['close'][i]})
        except: pass
        curr += timedelta(days=1); time.sleep(0.4)
    if not all_data: return pd.DataFrame()
    return pd.DataFrame(all_data).set_index('Datetime')

def get_nifty_data(symbol, start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30', source='yfinance', dhan_token='', dhan_cid='', strategy_type='Arsalan Continuation', strategy_params=None):
    st = time.time()
    pivot_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'daily_pivot_levels.json')
    pivot_mtime = os.path.getmtime(pivot_path) if os.path.exists(pivot_path) else 0

    csv_mtime = 0
    if source == 'dhan_local':
        if symbol == 'Nifty 50 (^NSEI)':
            path = "data/Historical_OHLC/nifty_1m_dhan.csv"
        else:
            path = f"data/Historical_OHLC/Options/{symbol}.csv"
        if os.path.exists(path):
            csv_mtime = os.path.getmtime(path)

    params_str = json.dumps(strategy_params, sort_keys=True) if strategy_params else "{}"
    res = get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params_str, pivot_mtime, csv_mtime)
    print(f"DEBUG: get_nifty_data took {time.time()-st:.4f}s")
    return res

@functools.lru_cache(maxsize=128)
def get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params_str, pivot_mtime, csv_mtime):
    params = json.loads(params_str) if params_str else {}
    print(f"CACHE MISS: Calculating data for {symbol} @ {timeframe} ({strategy_type}) - Pivot MTime: {pivot_mtime}, CSV MTime: {csv_mtime}")
    return _get_nifty_data_impl(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params)

def _get_nifty_data_impl(symbol, start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30', source='yfinance', strategy_type='Arsalan Continuation', strategy_params=None):
    df = pd.DataFrame()
    today_str = datetime.now().strftime('%Y-%m-%d')
    if source == 'dhan_local':
        if symbol == 'Nifty 50 (^NSEI)':
            path = "data/Historical_OHLC/nifty_1m_dhan.csv"
            if os.path.exists(path):
                mtime = os.path.getmtime(path)
                df_raw = _get_cached_raw_data(path, mtime)
                warmup_start = pd.to_datetime(start_date) - timedelta(days=5)
                mask = (df_raw['datetime'] >= warmup_start) & (df_raw['datetime'] <= pd.to_datetime(end_date) + timedelta(days=1))
                df = df_raw.loc[mask].rename(columns={'datetime': 'Datetime', 'open':'Open', 'high':'High', 'low':'Low', 'close':'Close'}).set_index('Datetime')
                df = df[~df.index.duplicated(keep='first')]
        else:
            path = f"data/Historical_OHLC/Options/{symbol}.csv"
            if os.path.exists(path):
                mtime = os.path.getmtime(path)
                df_raw = _get_cached_raw_data(path, mtime)
                warmup_start = pd.to_datetime(start_date) - timedelta(days=5)
                mask = (df_raw['datetime'] >= warmup_start) & (df_raw['datetime'] <= pd.to_datetime(end_date) + timedelta(days=1))
                df = df_raw.loc[mask].copy()
                df.columns = [c.capitalize() if c.lower() in ['open','high','low','close','volume','datetime'] else c for c in df.columns]
                if 'Datetime' in df.columns: df = df.set_index('Datetime')

    if source == 'yfinance' or (source == 'dhan_api' and start_date != today_str):
        yf_end = (datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        yf_interval = '1m' if timeframe == '3m' else timeframe
        try:
            if yf is None:
                raise ImportError("yfinance not installed")
            df = yf.download("^NSEI", start=start_date, end=yf_end, interval=yf_interval)
            if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
            if not df.empty: df = df[df.index >= pd.to_datetime(start_date)]
        except: df = pd.DataFrame()

    if df.empty: return pd.DataFrame(), []
    df.columns = [c.capitalize() if c.lower() in ['open','high','low','close','volume'] else c for c in df.columns]
    if source != 'yfinance' or timeframe == '3m': df = resample_ohlc(df, timeframe)
    df = df.dropna(subset=['Open', 'High', 'Low', 'Close'])
    if df.index.tz is not None: df.index = df.index.tz_convert('Asia/Kolkata').tz_localize(None)

    df_all = df
    zones = []
    start_ts = pd.to_datetime(start_date); end_ts = pd.to_datetime(end_date) + timedelta(days=2)
    df_filtered = df_all[(df_all.index >= start_ts) & (df_all.index < end_ts)]
    df_filtered = df_filtered.sort_index()

    if df_filtered.empty: return pd.DataFrame(), []

    if strategy_type == 'Arsalan Sandbox':
        df_filtered, strategy_zones = run_sandbox_strategy_logic(df_filtered)
        zones = strategy_zones
    elif strategy_type == 'Arsalan Reversal':
        hawa = strategy_params.get('hawa_me_zone', False) if strategy_params else False
        df_filtered, strategy_zones = run_reversal_strategy_logic(df_filtered, hawa_me_zone=hawa)
        zones = strategy_zones
    else:
        df_filtered = run_pinned_strategy_logic(df_filtered)

    if strategy_type != 'Arsalan Sandbox':
        if not df_filtered.empty:
            for i in range(len(df_filtered)):
                if df_filtered['bull_trigger'].iloc[i] or df_filtered['bear_trigger'].iloc[i]:
                    z_type = 'bull' if df_filtered['bull_trigger'].iloc[i] else 'bear'
                    end_idx = min(i+10, len(df_filtered)-1)
                    zones.append({
                        'start_time': int(df_filtered.index[i].timestamp()), 'end_time': int(df_filtered.index[end_idx].timestamp()),
                        'high': float(df_filtered['High'].iloc[i]), 'low': float(df_filtered['Low'].iloc[i]),
                        'type': z_type, 'size': float(df_filtered['High'].iloc[i] - df_filtered['Low'].iloc[i])
                    })

    return df_filtered, zones

def get_real_trades(start_date, end_date, symbol=None):
    path = os.path.join('data', 'trades_1.json')
    if not os.path.exists(path): return []
    try:
        with open(path, 'r') as f: data = json.load(f); raw = data.get('trades', [])
    except: return []
    processed = []; s_dt = datetime.strptime(start_date, '%Y-%m-%d').date(); e_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
    for t in raw:
        d_str = t.get('trade_date', t.get('date', ''))
        if not d_str: continue
        try:
            t_dt = datetime.strptime(d_str, '%Y-%m-%d').date()
            if not (s_dt <= t_dt <= e_dt): continue
        except: continue
        inst = t.get('Instrument', '').strip()
        if symbol and inst.upper() != symbol.upper(): continue
        tr_type = t.get('TradeType', 'buy').lower()
        entry_p = float(t.get('Sell Price (Avg)' if tr_type == 'sell' else 'Buy Price (Avg)', 0) or 0)
        exit_p  = float(t.get('Buy Price (Avg)'  if tr_type == 'sell' else 'Sell Price (Avg)', 0) or 0)
        entry_t = t.get('Sell Time' if tr_type == 'sell' else 'Buy Time', '')
        exit_t  = t.get('Buy Time'  if tr_type == 'sell' else 'Sell Time', '')
        qty     = float(t.get('Qty', 0) or 0)
        try:
            entry_dt = datetime.strptime(f"{d_str} {entry_t}", '%Y-%m-%d %H:%M:%S') if entry_t else None
            exit_dt  = datetime.strptime(f"{d_str} {exit_t}",  '%Y-%m-%d %H:%M:%S') if exit_t  else None
        except: entry_dt = exit_dt = None
        processed.append({
            'date': d_str, 'instrument': inst,
            'type': 'SHORT' if tr_type == 'sell' else 'LONG',
            'entry_price': entry_p, 'exit_price': exit_p,
            'entry_time': entry_t, 'exit_time': exit_t,
            'entry_dt': entry_dt.isoformat() if entry_dt else None,
            'exit_dt':  exit_dt.isoformat()  if exit_dt  else None,
            'qty': qty, 'pnl': float(t.get('Net P/L', 0) or 0),
        })
        try: pass
        except: pass
    return processed

def get_archive_dates():
    path = "data/Historical_OHLC/nifty_1m_dhan.csv"
    if not os.path.exists(path): return []
    try:
        df = pd.read_csv(path)
        df['datetime'] = pd.to_datetime(df['datetime'])
        df['date'] = df['datetime'].dt.strftime('%Y-%m-%d')

        trades_map = {}
        total_pl_map = {}
        t_path = os.path.join('data', 'trades_1.json')
        if os.path.exists(t_path):
            try:
                with open(t_path, 'r') as f:
                    for t in json.load(f).get('trades', []):
                        d_str = t.get('trade_date', t.get('date', ''))
                        raw_inst = t.get('Instrument', '').strip()
                        if not raw_inst: continue
                        inst = raw_inst.replace('/', '').strip().upper()
                        pl = float(t.get('Net P/L', 0))
                        qty = float(t.get('Qty', 0))
                        tr_type = t.get('TradeType', 'buy').lower()
                        entry_t = t.get('Sell Time' if tr_type == 'sell' else 'Buy Time', '')
                        exit_t = t.get('Buy Time' if tr_type == 'sell' else 'Sell Time', '')
                        entry_p = float(t.get('Sell Price (Avg)' if tr_type == 'sell' else 'Buy Price (Avg)', 0))
                        exit_p = float(t.get('Buy Price (Avg)' if tr_type == 'sell' else 'Sell Price (Avg)', 0))
                        pt = float(t.get('Pt', 0))
                        duration = ""
                        if entry_t and exit_t:
                            try:
                                t1 = datetime.strptime(entry_t, '%H:%M:%S')
                                t2 = datetime.strptime(exit_t, '%H:%M:%S')
                                diff = (t2 - t1).total_seconds() / 60
                                duration = f"{int(abs(diff))}m"
                            except: pass
                        if d_str and inst:
                            if d_str not in trades_map: trades_map[d_str] = []
                            trades_map[d_str].append({
                                'symbol': inst, 'pl': pl, 'qty': qty,
                                'entry_time': entry_t, 'exit_time': exit_t,
                                'entry_price': entry_p, 'exit_price': exit_p,
                                'pt': pt, 'duration': duration
                            })
                            total_pl_map[d_str] = total_pl_map.get(d_str, 0) + pl
            except Exception as e:
                print(f"Error parsing trades_1.json: {e}")

        all_unique_syms = set()
        for d_trades in trades_map.values():
            for t in d_trades:
                all_unique_syms.add(t['symbol'])

        INVENTORY_FILE = "data/archive_inventory.json"
        INVENTORY_META = "data/inventory_meta.json"
        sym_availability = {}

        stale = True
        if os.path.exists(INVENTORY_META):
            try:
                with open(INVENTORY_META, 'r') as f: m = json.load(f)
                if time.time() - m.get('updated_at', 0) < 1800:
                    stale = False
            except: pass

        if not stale and os.path.exists(INVENTORY_FILE):
            try:
                with open(INVENTORY_FILE, 'r') as f:
                    raw_inv = json.load(f)
                    sym_availability = {k: set(v) for k,v in raw_inv.items()}
            except: stale = True

        if stale:
            print("Refreshing Archive Inventory (Background Scan)...")
            for sym in all_unique_syms:
                csv_path = f"data/Historical_OHLC/Options/{sym}.csv"
                if os.path.exists(csv_path):
                    try:
                        temp_df = pd.read_csv(csv_path, usecols=['datetime'], dtype={'datetime': str})
                        if not temp_df.empty:
                            dates = temp_df['datetime'].str.slice(0, 10).unique()
                            sym_availability[sym] = set(dates)
                        else: sym_availability[sym] = set()
                    except: sym_availability[sym] = set()
            try:
                os.makedirs('data', exist_ok=True)
                with open(INVENTORY_FILE, 'w') as f:
                    json.dump({k: list(v) for k,v in sym_availability.items()}, f)
                with open(INVENTORY_META, 'w') as f:
                    json.dump({'updated_at': time.time()}, f)
            except: pass

        all_trade_dates = sorted(list(trades_map.keys()), reverse=True)

        results = []
        for date in all_trade_dates:
            day_index_df = df[df['date'] == date] if not df.empty else pd.DataFrame()
            if not day_index_df.empty:
                median_diff = day_index_df['datetime'].diff().dropna().dt.total_seconds().median() / 60
                res_str = f"{int(median_diff)}m" if median_diff >= 1 else "High"
            else:
                res_str = "MISSING"

            day_total_pl = total_pl_map.get(date, 0)
            day_trades = []

            for t_raw in trades_map.get(date, []):
                sym = t_raw['symbol']
                pl = t_raw['pl']
                qty = t_raw.get('qty', 0)
                d_obj = datetime.strptime(date, '%Y-%m-%d')
                weekly_history = []
                weekly_dates = []
                for i in range(5):
                    check_day = d_obj
                    offset = 0
                    count = 0
                    while count < i:
                        offset += 1
                        prev = d_obj - timedelta(days=offset)
                        if prev.weekday() < 5:
                            count += 1
                            check_day = prev
                    day_str = check_day.strftime('%Y-%m-%d')
                    has_day_data = day_str in sym_availability.get(sym, set())
                    if not has_day_data:
                        try:
                            add_to_sync(sym, day_str)
                        except: pass
                    weekly_history.insert(0, has_day_data)
                    weekly_dates.insert(0, day_str)

                day_trades.append({
                    'symbol': sym,
                    'pl': round(pl, 2),
                    'qty': qty,
                    'entry_time': t_raw.get('entry_time', ''),
                    'exit_time': t_raw.get('exit_time', ''),
                    'duration': t_raw.get('duration', ''),
                    'pt': t_raw.get('pt', 0),
                    'has_data': os.path.exists(f"data/Historical_OHLC/Options/{sym}.csv"),
                    'weekly_history': weekly_history,
                    'weekly_dates': weekly_dates
                })

            results.append({
                'date': date,
                'resolution': res_str,
                'trades': day_trades,
                'total_pl': round(day_total_pl, 2)
            })

        return sorted(results, key=lambda x: x['date'], reverse=True)
    except Exception as e:
        print(f"Error reading archive dates: {e}")
        return []

```
