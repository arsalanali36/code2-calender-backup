import requests
import time
import os
import pandas as pd
from datetime import datetime, timedelta

OUTPUT_FILE = "data/nifty_1m_fresh.csv"
DHAN_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"

def fetch_dhan_1m(date_str):
    url = "https://api.dhan.co/charts/intraday"
    payload = {"securityId": "13", "exchangeSegment": "IDX_I", "instrument": "INDEX", "fromDate": date_str, "toDate": date_str}
    headers = {"Content-Type": "application/json", "access-token": DHAN_TOKEN}
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            d = res.json()
            if 'open' in d and d['open']:
                # GHOST CHECK: Reject if it matches Today's data (April 13)
                # Note: Today's open candle for ^NSEI is ~23589.6
                if abs(d['open'][0] - 23589.6) < 0.1 and date_str != datetime.now().strftime('%Y-%m-%d'):
                    return pd.DataFrame()

                base = datetime.strptime(f"{date_str} 09:15:00", "%Y-%m-%d %H:%M:%S")
                df_day = pd.DataFrame({
                    'datetime': [base + timedelta(minutes=i) for i in range(len(d['open']))],
                    'open': d['open'], 'high': d['high'], 'low': d['low'], 'close': d['close']
                })
                return df_day
    except: pass
    return pd.DataFrame()

def start_fresh_download():
    all_data = []
    end_dt = datetime.now()
    print(f"Starting Fresh Download for 30 days into {OUTPUT_FILE}...")
    
    for i in range(30):
        d_str = (end_dt - timedelta(days=i)).strftime('%Y-%m-%d')
        print(f"  Fetching {d_str}...", end=" ")
        day_df = fetch_dhan_1m(d_str)
        if not day_df.empty:
            print(f"Done ({len(day_df)} candles)")
            all_data.append(day_df)
        else:
            print("Skipped (No data or Ghost data)")
        time.sleep(0.5)

    if all_data:
        final_df = pd.concat(all_data).sort_values('datetime')
        final_df.to_csv(OUTPUT_FILE, index=False)
        print(f"\nSUCCESS! Fresh archive created with {len(final_df)} validated candles.")
    else:
        print("\nFailed to download any valid data.")

if __name__ == "__main__":
    start_fresh_download()
