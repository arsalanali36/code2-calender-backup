import requests
import time
import os
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

OUTPUT_FILE = "data/Historical_OHLC/nifty_1m_dhan.csv"

def fetch_dhan_1m(date_str, token):
    url = "https://api.dhan.co/charts/intraday"
    payload = {"securityId": "13", "exchangeSegment": "IDX_I", "instrument": "INDEX", "fromDate": date_str, "toDate": date_str}
    headers = {"Content-Type": "application/json", "access-token": token}
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            d = res.json()
            if 'open' in d and d['open']:
                # GHOST CHECK
                if abs(d['open'][0] - 23589.6) < 0.1 and date_str != datetime.now().strftime('%Y-%m-%d'):
                    return pd.DataFrame()
                base = datetime.strptime(f"{date_str} 09:15:00", "%Y-%m-%d %H:%M:%S")
                df_day = pd.DataFrame({
                    'datetime': [base + timedelta(minutes=i) for i in range(len(d['open']))],
                    'open': d['open'], 'high': d['high'], 'low': d['low'], 'close': d['close'], 'volume': 0
                })
                df_day['datetime'] = pd.to_datetime(df_day['datetime']).dt.tz_localize(None)
                return df_day
    except: pass
    return pd.DataFrame()

def rebuild_local_data():
    os.makedirs('data', exist_ok=True)
    DHAN_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"
    
    existing_df = pd.DataFrame()
    if os.path.exists(OUTPUT_FILE):
        try:
            existing_df = pd.read_csv(OUTPUT_FILE)
            existing_df['datetime'] = pd.to_datetime(existing_df['datetime']).dt.tz_localize(None)
            # Tag resolution for existing
            existing_df['resolution'] = 1 # Assume existing was high-res or we want to preserve it
        except: pass
    
    end_dt = datetime.now()
    all_new_data = []

    # New stage: Fill holes with 5m but only if no data exists
    yf5_start = (end_dt - timedelta(days=59)).strftime('%Y-%m-%d')
    yf5 = yf.download("^NSEI", start=yf5_start, end=end_dt.strftime('%Y-%m-%d'), interval="5m")
    if not yf5.empty:
        if isinstance(yf5.columns, pd.MultiIndex): yf5.columns = yf5.columns.get_level_values(0)
        yf5 = yf5.reset_index().rename(columns={'Datetime': 'datetime', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume', 'Date': 'datetime'})
        yf5['datetime'] = pd.to_datetime(yf5['datetime']).dt.tz_convert('Asia/Kolkata').dt.tz_localize(None)
        yf5['resolution'] = 5 # Mark as low-res
        all_new_data.append(yf5)

    # Latest 7d 1m
    yf1 = yf.download("^NSEI", start=(end_dt - timedelta(days=6)).strftime('%Y-%m-%d'), end=end_dt.strftime('%Y-%m-%d'), interval="1m")
    if not yf1.empty:
        if isinstance(yf1.columns, pd.MultiIndex): yf1.columns = yf1.columns.get_level_values(0)
        yf1 = yf1.reset_index().rename(columns={'Datetime': 'datetime', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume', 'Date': 'datetime'})
        yf1['datetime'] = pd.to_datetime(yf1['datetime']).dt.tz_convert('Asia/Kolkata').dt.tz_localize(None)
        yf1['resolution'] = 1
        all_new_data.append(yf1)

    today_str = end_dt.strftime('%Y-%m-%d')
    day_df = fetch_dhan_1m(today_str, DHAN_TOKEN)
    if not day_df.empty:
        day_df['resolution'] = 1
        all_new_data.append(day_df)

    if all_new_data:
        # MERGE LOGIC: Sort by resolution ASC (1 first) then drop duplicates (keep first)
        # This keeps 1m data and only uses 5m if 1m is missing
        combined = pd.concat([existing_df] + all_new_data).sort_values(['datetime', 'resolution'])
        final_df = combined.drop_duplicates(subset=['datetime'], keep='first').sort_values('datetime')
        final_df.drop(columns=['resolution']).to_csv(OUTPUT_FILE, index=False)
        print(f"SUCCESS! Archive updated. High-res preserved. Total: {len(final_df)} candles.")

if __name__ == "__main__":
    rebuild_local_data()
