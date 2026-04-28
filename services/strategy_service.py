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

def detect_candle_patterns(df, min_body_size=2.0, prev_body_min_pts=2.0):
    # Default parameters are kept tighter for the older Strategy Lab variants.
    # X2 passes Pine-exact values from the source script.
    wick_ratio = 2.5

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
                    if val is None or (isinstance(val, float) and val != val):
                        continue
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

def _load_daily_levels_map():
    json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'daily_pivot_levels.json')
    if not os.path.exists(json_path):
        return {}
    try:
        with open(json_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading pivot JSON: {e}")
        return {}

def _clean_level(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if value != value or value > 30000:
            return None
        return float(value)
    return None

def _line_type_for_level(name):
    n = name.lower()
    if n.startswith('r'):
        return "RESISTANCE"
    if n.startswith('s'):
        return "SUPPORT"
    if n in ('pp', 'cp'):
        return "CP"
    if n == 'pdh':
        return "PD_H"
    if n == 'pdl':
        return "PD_L"
    if n == 'pdc':
        return "PD_C"
    return "UNKNOWN"

def run_x2_common_strategy_logic(df, hawa_me_zone=False, use_fresh_zone=True):
    if df.empty: return df, []

    daily_levels_map = _load_daily_levels_map()
    df = df.copy()
    df['ema10'] = calculate_ema(df, 10)
    df['ema20'] = calculate_ema(df, 20)
    df = detect_candle_patterns(df, min_body_size=0.5, prev_body_min_pts=0.5)

    level_order = ['r5', 'r4', 'r3', 'r2', 'r1', 'pp', 's1', 's2', 's3', 's4', 's5', 'pdh', 'pdc', 'pdl']
    for col in ['pdh', 'pdl', 'pdc', 'pp', 'r1', 's1', 'r2', 's2', 'r3', 's3', 'r4', 's4', 'r5', 's5']:
        if col not in df.columns:
            df[col] = np.nan

    touch_active = False
    line_type = None
    tracked_high = None
    tracked_low = None
    latest_hh = None
    latest_ll = None
    touched_hh_prev = False
    touched_ll_prev = False

    green_zone = None
    red_zone = None
    green_zone_touch = False
    red_zone_touch = False
    last_green_zone_bar = None
    last_red_zone_bar = None
    max_zone_age = 2

    skip_big_long = False
    skip_big_short = False
    max_candle_size = 25

    df['bull_trigger'] = False
    df['bear_trigger'] = False
    final_zones = []

    def x2_zone_end_time(start_index):
        end_index = min(start_index + 10, len(df) - 1)
        return int(df.index[end_index].timestamp())

    for i in range(len(df)):
        curr_time = df.index[i]
        curr_date_str = curr_time.strftime('%Y-%m-%d')
        levels = daily_levels_map.get(curr_date_str, {})

        if i > 0 and df.index[i].date() != df.index[i-1].date():
            touch_active = False
            line_type = None
            tracked_high = None
            tracked_low = None
            latest_hh = None
            latest_ll = None
            touched_hh_prev = False
            touched_ll_prev = False
            green_zone = None
            red_zone = None
            green_zone_touch = False
            red_zone_touch = False
            last_green_zone_bar = None
            last_red_zone_bar = None
            skip_big_long = False
            skip_big_short = False

        for k in level_order:
            api_key = 'pp' if k == 'pp' else k
            v = _clean_level(levels.get(api_key, levels.get('cp') if api_key == 'pp' else None))
            if k in df.columns:
                df.iloc[i, df.columns.get_loc(k)] = v if v is not None else np.nan

        row = df.iloc[i]
        low, high, close, open_p = row['Low'], row['High'], row['Close'], row['Open']

        touched = False
        current_line_type = None
        for k in level_order:
            val = row[k] if k in row else np.nan
            if pd.notnull(val) and low <= val <= high:
                touched = True
                current_line_type = _line_type_for_level(k)
                break

        if touched:
            line_type = current_line_type
            if not touch_active:
                touch_active = True
                tracked_high = high
                tracked_low = low
            else:
                tracked_high = max(tracked_high, high) if tracked_high is not None else high
                tracked_low = min(tracked_low, low) if tracked_low is not None else low
            latest_hh = tracked_high
            latest_ll = tracked_low

        touch_hh = latest_hh is not None and high >= latest_hh
        touch_ll = latest_ll is not None and low <= latest_ll
        if touch_hh:
            touched_hh_prev = True
        if touch_ll:
            touched_ll_prev = True

        effective_touched_hh = touched_hh_prev if hawa_me_zone else False
        effective_touched_ll = touched_ll_prev if hawa_me_zone else False

        bullish_pattern = bool(row['bull_engulf'] or row['bull_harami'] or row['green_hammer'])
        bearish_pattern = bool(row['bear_engulf'] or row['bear_harami'] or row['inv_red_hammer'] or row['red_hammer'])
        is_green = close > open_p
        is_red = close < open_p

        bearish_zone_candle = (touched or effective_touched_hh) and bearish_pattern and line_type not in ["SUPPORT", "PD_L"]
        bullish_zone_candle = (touched or effective_touched_ll) and bullish_pattern and line_type not in ["RESISTANCE", "PD_H"]

        if bullish_zone_candle:
            last_green_zone_bar = i
        if bearish_zone_candle:
            last_red_zone_bar = i

        green_zone_fresh = last_green_zone_bar is not None and (i - last_green_zone_bar <= max_zone_age)
        red_zone_fresh = last_red_zone_bar is not None and (i - last_red_zone_bar <= max_zone_age)

        if bullish_zone_candle or bearish_zone_candle:
            zone_type = 'bear' if bearish_zone_candle else 'bull'
            zone = {'upper': float(high), 'lower': float(low), 'bar': i}
            if bullish_zone_candle:
                green_zone = zone
                green_zone_touch = True
                red_zone = None
            if bearish_zone_candle:
                red_zone = zone
                red_zone_touch = True
                green_zone = None

            final_zones.append({
                'start_time': int(curr_time.timestamp()),
                'end_time': x2_zone_end_time(i),
                'high': float(high),
                'low': float(low),
                'type': zone_type,
                'size': float(high - low)
            })
            touched_hh_prev = False
            touched_ll_prev = False

        close_above_green = green_zone is not None and close > green_zone['upper']
        close_below_red = red_zone is not None and close < red_zone['lower']
        candle_size = high - low
        if close_below_red:
            skip_big_short = candle_size > max_candle_size
        if close_above_green:
            skip_big_long = candle_size > max_candle_size

        prev_green = i > 0 and green_zone is not None and df.iloc[i-1]['Close'] > df.iloc[i-1]['Open']
        prev_red = i > 0 and red_zone is not None and df.iloc[i-1]['Close'] < df.iloc[i-1]['Open']
        long_below_tracked_high = tracked_high is None or close <= tracked_high
        short_above_tracked_low = tracked_low is None or close >= tracked_low

        long_ready = green_zone_fresh if use_fresh_zone else green_zone_touch
        short_ready = red_zone_fresh if use_fresh_zone else red_zone_touch

        if long_ready and green_zone is not None and close_above_green and prev_green and not skip_big_long and is_green and long_below_tracked_high:
            df.iloc[i, df.columns.get_loc('bull_trigger')] = True
            green_zone = None
            green_zone_touch = False

        if short_ready and red_zone is not None and close_below_red and prev_red and not skip_big_short and is_red and short_above_tracked_low:
            df.iloc[i, df.columns.get_loc('bear_trigger')] = True
            red_zone = None
            red_zone_touch = False

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
            if v is None or (isinstance(v, float) and v != v):
                continue
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

