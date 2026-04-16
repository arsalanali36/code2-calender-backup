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

from processors.data_processors import get_user_data_file

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

def get_nifty_data(symbol, start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30', source='yfinance', dhan_token='', dhan_cid='', strategy_type='Arsalan Continuation', strategy_params=None, user_id=None):
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
    res = get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params_str, pivot_mtime, csv_mtime, user_id)
    print(f"DEBUG: get_nifty_data took {time.time()-st:.4f}s")
    return res

@functools.lru_cache(maxsize=128)
def get_nifty_data_cached(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params_str, pivot_mtime, csv_mtime, user_id):
    params = json.loads(params_str) if params_str else {}
    print(f"CACHE MISS: Calculating data for {symbol} @ {timeframe} ({strategy_type}) - Pivot MTime: {pivot_mtime}, CSV MTime: {csv_mtime}, User: {user_id}")
    df, zones = _get_nifty_data_impl(symbol, start_date, end_date, timeframe, start_time, end_time, source, strategy_type, params)
    
    # We don't cache real_trades as they might change without csv/pivot change
    real_trades = get_real_trades(start_date, end_date, symbol, user_id=user_id)
    return df, zones, real_trades

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

def get_real_trades(start_date, end_date, symbol=None, user_id=None):
    path = get_user_data_file(user_id)
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

def get_archive_dates(user_id=None):
    path = "data/Historical_OHLC/nifty_1m_dhan.csv"
    if not os.path.exists(path): return []
    try:
        df = pd.read_csv(path)
        df['datetime'] = pd.to_datetime(df['datetime'])
        df['date'] = df['datetime'].dt.strftime('%Y-%m-%d')

        trades_map = {}
        total_pl_map = {}
        t_path = get_user_data_file(user_id)
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
