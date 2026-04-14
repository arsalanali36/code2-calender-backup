import pandas as pd
import numpy as np
import yfinance as yf
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
    # Cache invalidation via pivot file mtime
    pivot_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'daily_pivot_levels.json')
    pivot_mtime = os.path.getmtime(pivot_path) if os.path.exists(pivot_path) else 0
    
    # Convert dict to string for caching
    params_str = json.dumps(strategy_params, sort_keys=True) if strategy_params else "{}"
    res = get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params_str, pivot_mtime)
    print(f"DEBUG: get_nifty_data took {time.time()-st:.4f}s")
    return res

@functools.lru_cache(maxsize=128)
def get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params_str, pivot_mtime):
    params = json.loads(params_str) if params_str else {}
    print(f"CACHE MISS: Calculating data for {symbol} @ {timeframe} ({strategy_type}) - Pivot MTime: {pivot_mtime}")
    return _get_nifty_data_impl(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params)

def _get_nifty_data_impl(symbol, start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30', source='yfinance', strategy_type='Arsalan Continuation', strategy_params=None):
    df = pd.DataFrame()
    today_str = datetime.now().strftime('%Y-%m-%d')
    # Use cached CSV loader for speed
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
        # Fallback to yfinance if local missing or api requested for past
        yf_end = (datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        yf_interval = '1m' if timeframe == '3m' else timeframe
        try:
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
        try: t_dt = datetime.strptime(d_str, '%Y-%m-%d').date()
        except: continue
        if s_dt <= t_dt <= e_dt:
            inst = t.get('Instrument', '')
            if symbol and symbol != 'Nifty 50 (^NSEI)' and inst != symbol:
                continue
            
            tr_type = t.get('TradeType', 'buy'); entry_t = t.get('Sell Time' if tr_type == 'sell' else 'Buy Time'); exit_t = t.get('Buy Time' if tr_type == 'sell' else 'Sell Time')
            if entry_t and exit_t:
                try:
                    e_dt_n = datetime.strptime(f"{d_str} {entry_t if len(entry_t.split(':'))==3 else f'{entry_t}:00'}", '%Y-%m-%d %H:%M:%S')
                    x_dt_n = datetime.strptime(f"{d_str} {exit_t if len(exit_t.split(':'))==3 else f'{exit_t}:00'}", '%Y-%m-%d %H:%M:%S')
                    processed.append({'entry_time': calendar.timegm(e_dt_n.timetuple()), 'exit_time': calendar.timegm(x_dt_n.timetuple()), 'type': tr_type.upper(), 'instrument': t.get('Instrument', ''), 'pl': float(t.get('Net P/L', 0)), 'qty': int(t.get('Quantity', 0))})
                except: pass
    return processed

def get_archive_dates():
    path = "data/Historical_OHLC/nifty_1m_dhan.csv"
    if not os.path.exists(path): return []
    try:
        df = pd.read_csv(path)
        df['datetime'] = pd.to_datetime(df['datetime'])
        df['date'] = df['datetime'].dt.strftime('%Y-%m-%d')
        
        # Extract traded instruments and calculate total P/L per date
        trades_map = {}
        total_pl_map = {}
        t_path = os.path.join('data', 'trades_1.json')
        if os.path.exists(t_path):
            try:
                with open(t_path, 'r') as f:
                    for t in json.load(f).get('trades', []):
                        d_str = t.get('trade_date', t.get('date', ''))
                        inst = t.get('Instrument', '').strip()
                        pl = float(t.get('Net P/L', 0))
                        if d_str and inst:
                            if d_str not in trades_map: trades_map[d_str] = []
                            trades_map[d_str].append({'symbol': inst, 'pl': pl})
                            total_pl_map[d_str] = total_pl_map.get(d_str, 0) + pl
            except Exception as e: 
                print(f"Error parsing trades_1.json: {e}")

        results = []
        for date, group in df.groupby('date'):
            if len(group) > 1:
                median_diff = group['datetime'].diff().dropna().dt.total_seconds().median() / 60
                res_str = f"{int(median_diff)}m" if median_diff >= 1 else "High"
            else:
                res_str = "N/A"
            
            day_total_pl = total_pl_map.get(date, 0)
            day_insts = []
            seen_insts = {} # Map symbol -> total_pl for that day
            
            for inst_batch in trades_map.get(date, []):
                sym = inst_batch['symbol']
                pl = inst_batch['pl']
                seen_insts[sym] = seen_insts.get(sym, 0) + pl

            for sym, pl in seen_insts.items():
                cp = f"data/Historical_OHLC/Options/{sym}.csv"
                day_insts.append({
                    'symbol': sym, 
                    'has_data': os.path.exists(cp),
                    'pl': round(pl, 2)
                })

            results.append({
                'date': date, 
                'resolution': res_str, 
                'instruments': day_insts,
                'total_pl': round(day_total_pl, 2)
            })
            
        return sorted(results, key=lambda x: x['date'], reverse=True)
    except Exception as e:
        print(f"Error reading archive dates: {e}")
        return []
