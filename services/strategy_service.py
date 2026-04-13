import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta

def calculate_ema(df, length):
    return df['Close'].ewm(span=length, adjust=False).mean()

def calculate_dema(df, length):
    ema1 = calculate_ema(df, length)
    ema2 = ema1.ewm(span=length, adjust=False).mean()
    return 2 * ema1 - ema2

def detect_candle_patterns(df):
    body = (df['Close'] - df['Open']).abs()
    is_green = df['Close'] > df['Open']
    is_red = df['Close'] < df['Open']
    body_size = body
    candle_range = df['High'] - df['Low']
    upper_wick = df['High'] - df[['Open', 'Close']].max(axis=1)
    lower_wick = df[['Open', 'Close']].min(axis=1) - df['Low']
    
    df['green_hammer'] = is_green & (lower_wick > body * 2.5) & (upper_wick < body * 0.5)
    df['red_hammer'] = is_red & (lower_wick > body * 2.5) & (upper_wick < body * 0.5)
    df['inv_red_hammer'] = is_red & (upper_wick > body * 2.5) & (lower_wick < body * 0.5)
    
    df['bull_engulf'] = is_green & (df['Close'] > df['Open'].shift(1)) & (df['Open'] < df['Close'].shift(1)) & (body > body.shift(1))
    df['bear_engulf'] = is_red & (df['Close'] < df['Open'].shift(1)) & (df['Open'] > df['Close'].shift(1)) & (body > body.shift(1))
    
    ms_cond = (is_red.shift(2)) & (body.shift(2) > body.shift(1)) & (body.shift(1) < body.shift(2) * 0.5) & (is_green) & (df['Close'] > (df['Open'].shift(2) + df['Close'].shift(2)) / 2)
    df['morning_star'] = ms_cond
    
    es_cond = (is_green.shift(2)) & (body.shift(2) > body.shift(1)) & (body.shift(1) < body.shift(2) * 0.5) & (is_red) & (df['Close'] < (df['Open'].shift(2) + df['Close'].shift(2)) / 2)
    df['evening_star'] = es_cond
    
    return df

def run_arsalan_continuation_logic(df):
    df['ema10'] = calculate_ema(df, 10)
    df['ema20'] = calculate_ema(df, 20)
    df['dema100'] = calculate_dema(df, 100)
    
    df = detect_candle_patterns(df)
    
    df['ema_touch'] = (df['Low'] <= df['ema10']) & (df['High'] >= df['ema10']) | \
                      (df['Low'] <= df['ema20']) & (df['High'] >= df['ema20'])
    
    df['bull_trigger'] = df['ema_touch'] & (df['bull_engulf'] | df['morning_star'] | df['green_hammer'])
    df['bear_trigger'] = df['ema_touch'] & (df['bear_engulf'] | df['evening_star'] | df['inv_red_hammer'])
    
    last_upper = np.nan
    last_lower = np.nan
    last_type = None
    last_trigger_idx = -100
    
    buy_signals = np.zeros(len(df), dtype=bool)
    sell_signals = np.zeros(len(df), dtype=bool)
    
    for i in range(len(df)):
        if df['bull_trigger'].iloc[i]:
            last_upper, last_lower, last_type, last_trigger_idx = df['High'].iloc[i], df['Low'].iloc[i], 'bull', i
        elif df['bear_trigger'].iloc[i]:
            last_upper, last_lower, last_type, last_trigger_idx = df['High'].iloc[i], df['Low'].iloc[i], 'bear', i
            
        if last_type and (i - last_trigger_idx <= 10):
            if last_type == 'bull' and df['Close'].iloc[i] > last_upper and df['Close'].iloc[i] > df['dema100'].iloc[i]:
                if not buy_signals[last_trigger_idx:i].any(): buy_signals[i] = True
            elif last_type == 'bear' and df['Close'].iloc[i] < last_lower and df['Close'].iloc[i] < df['dema100'].iloc[i]:
                if not sell_signals[last_trigger_idx:i].any(): sell_signals[i] = True
                    
    df['buy_signal'] = buy_signals
    df['sell_signal'] = sell_signals
    return df

def run_arsalan_continuation(df):
    # This is used for generating the final zones list after filtering
    df = run_arsalan_continuation_logic(df)
    zones = []
    # Re-calculate triggers for final zone list
    for i in range(len(df)):
        if df['bull_trigger'].iloc[i] or df['bear_trigger'].iloc[i]:
            z_type = 'bull' if df['bull_trigger'].iloc[i] else 'bear'
            # Look ahead for actual bars in the filtered df
            end_idx = min(i+10, len(df)-1)
            zones.append({
                'start_time': int(df.index[i].timestamp()),
                'end_time': int(df.index[end_idx].timestamp()),
                'high': float(df['High'].iloc[i]),
                'low': float(df['Low'].iloc[i]),
                'type': z_type,
                'size': float(df['High'].iloc[i] - df['Low'].iloc[i])
            })
    return df, zones

def get_nifty_data(start_date, end_date, timeframe='5m', start_time='09:15', end_time='15:30'):
    symbol = "^NSEI"
    # Fetch extra 20 days of history (enough for DEMA 100 on intraday)
    # yfinance limit for 3m/5m is 60 days total.
    fetch_start = (datetime.strptime(start_date, '%Y-%m-%d') - timedelta(days=20)).strftime('%Y-%m-%d')
    data = yf.download(symbol, start=fetch_start, end=end_date, interval=timeframe)
    if data.empty: return pd.DataFrame(), []
    
    # Clean multi-index columns FIRST if they exist
    if isinstance(data.columns, pd.MultiIndex): 
        data.columns = data.columns.get_level_values(0)
    
    # Clean data: drop rows with 0 or NaN in Close/Open
    data = data.dropna(subset=['Open', 'High', 'Low', 'Close'])
    data = data[(data[['Open', 'High', 'Low', 'Close']] > 0).all(axis=1)]
    
    # Ensure index is in local time (naive) for between_time to work with simple strings
    if data.index.tz is not None:
        data.index = data.index.tz_convert('Asia/Kolkata').tz_localize(None)
    
    df_all = run_arsalan_continuation_logic(data)
    
    start_ts = pd.to_datetime(start_date)
    df_filtered = df_all[df_all.index >= start_ts]
    df_filtered = df_filtered.between_time(start_time, end_time)
    
    print(f"DEBUG: Symbol={symbol}, Fetched={len(data)}, AfterFilter={len(df_filtered)}")
    
    # Generate zones based on the filtered data points
    _, zones = run_arsalan_continuation(df_filtered)
    
    return df_filtered, zones
