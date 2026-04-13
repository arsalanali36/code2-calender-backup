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

def calculate_dema(df, length):
    ema1 = calculate_ema(df, length)
    ema2 = ema1.ewm(span=length, adjust=False).mean()
    return 2 * ema1 - ema2

def detect_candle_patterns(df):
    body = (df['Close'] - df['Open']).abs()
    is_green = df['Close'] > df['Open']; is_red = df['Close'] < df['Open']
    high = df['High']; low = df['Low']; open_p = df['Open']; close_p = df['Close']
    upper_wick = high - close_p.where(is_green, open_p)
    lower_wick = open_p.where(is_green, close_p) - low
    df['green_hammer'] = is_green & (lower_wick > body * 2.5) & (upper_wick < body * 0.5)
    df['red_hammer'] = is_red & (lower_wick > body * 2.5) & (upper_wick < body * 0.5)
    df['inv_red_hammer'] = is_red & (upper_wick > body * 2.5) & (lower_wick < body * 0.5)
    df['bull_engulf'] = is_green & (close_p > open_p.shift(1)) & (open_p < close_p.shift(1)) & (body > body.shift(1))
    df['bear_engulf'] = is_red & (close_p < open_p.shift(1)) & (open_p > close_p.shift(1)) & (body > body.shift(1))
    ms_cond = (is_red.shift(2)) & (body.shift(2) > body.shift(1)) & (body.shift(1) < body.shift(2) * 0.5) & (is_green) & (close_p > (open_p.shift(2) + close_p.shift(2)) / 2)
    df['morning_star'] = ms_cond
    es_cond = (is_green.shift(2)) & (body.shift(2) > body.shift(1)) & (body.shift(1) < body.shift(2) * 0.5) & (is_red) & (close_p < (open_p.shift(2) + close_p.shift(2)) / 2)
    df['evening_star'] = es_cond
    return df

def run_pinned_strategy_logic(df):
    if df.empty: return df
    df['ema10'] = calculate_ema(df, 10); df['ema20'] = calculate_ema(df, 20); df['dema100'] = calculate_dema(df, 100)
    df = detect_candle_patterns(df)
    df['ema_touch'] = (df['Low'] <= df['ema10']) & (df['High'] >= df['ema10']) | (df['Low'] <= df['ema20']) & (df['High'] >= df['ema20'])
    df['bull_trigger'] = df['ema_touch'] & (df['bull_engulf'] | df['morning_star'] | df['green_hammer'])
    df['bear_trigger'] = df['ema_touch'] & (df['bear_engulf'] | df['evening_star'] | df['inv_red_hammer'] | df['red_hammer'])
    return df

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

@functools.lru_cache(maxsize=128)
def get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source):
    print(f"CACHE MISS: Calculating data for {symbol} @ {timeframe}")
    return _get_nifty_data_impl(symbol, start_date, end_date, timeframe, start_time, end_time, source)

def get_nifty_data(symbol, start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30', source='yfinance', dhan_token='', dhan_cid=''):
    st = time.time()
    res = get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source)
    print(f"DEBUG: get_nifty_data took {time.time()-st:.4f}s")
    return res

def _get_nifty_data_impl(symbol, start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30', source='yfinance'):
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
    
    df_all = run_pinned_strategy_logic(df)
    start_ts = pd.to_datetime(start_date); end_ts = pd.to_datetime(end_date) + timedelta(days=1)
    df_filtered = df_all[(df_all.index >= start_ts) & (df_all.index < end_ts)]
    df_filtered = df_filtered.between_time('09:14', '15:31') 
    df_filtered = df_filtered[df_filtered.index.strftime('%H:%M') >= '09:15']

    zones = []
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
        
        # Extract traded instruments
        trades_map = {}
        t_path = os.path.join('data', 'trades_1.json')
        if os.path.exists(t_path):
            try:
                with open(t_path, 'r') as f:
                    for t in json.load(f).get('trades', []):
                        d_str = t.get('trade_date', t.get('date', ''))
                        inst = t.get('Instrument', '').strip()
                        if d_str and inst:
                            if d_str not in trades_map: trades_map[d_str] = set()
                            trades_map[d_str].add(inst)
            except: pass

        results = []
        for date, group in df.groupby('date'):
            if len(group) > 1:
                median_diff = group['datetime'].diff().dropna().dt.total_seconds().median() / 60
                res_str = f"{int(median_diff)}m" if median_diff >= 1 else "High"
            else:
                res_str = "N/A"
            
            insts = []
            for inst in trades_map.get(date, set()):
                cp = f"data/Historical_OHLC/Options/{inst}.csv"
                insts.append({'symbol': inst, 'has_data': os.path.exists(cp)})
            results.append({'date': date, 'resolution': res_str, 'instruments': insts})
            
        return sorted(results, key=lambda x: x['date'], reverse=True)
    except Exception as e:
        print(f"Error reading archive dates: {e}")
        return []
