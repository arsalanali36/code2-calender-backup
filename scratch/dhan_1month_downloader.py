import requests
import json
import time
import pandas as pd
from datetime import datetime, timedelta
import os

# Using the token found in the current scripts
ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"
OUTPUT_FILE = "data/nifty_1m_dhan_one_month.csv"

def fetch_intraday(date_str):
    url = "https://api.dhan.co/charts/intraday"
    payload = {
        "securityId": "13", 
        "exchangeSegment": "IDX_I", 
        "instrument": "INDEX", 
        "fromDate": date_str, 
        "toDate": date_str
    }
    headers = {
        "Content-Type": "application/json", 
        "access-token": ACCESS_TOKEN
    }
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Error fetching {date_str}: {e}")
    return None

def download_last_month():
    print(f"Starting 1-month download from Dhan API for SecurityID 13 (Nifty)...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    all_data = []
    
    current = start_date
    while current <= end_date:
        ds = current.strftime('%Y-%m-%d')
        print(f"Requesting {ds}...", end=" ")
        
        data = fetch_intraday(ds)
        if data and 'open' in data and data['open']:
            print(f"Success! {len(data['open'])} candles.", end=" ")
            
            # GHOST CHECK vs today's known open 23589.6
            is_ghost = abs(data['open'][0] - 23589.6) < 0.1 and ds != end_date.strftime('%Y-%m-%d')
            if is_ghost:
                print("[GHOST DATA DETECTED - Same as Today]")
            else:
                print("[VALID DATA]")
            
            # We save it anyway because the user asked to see it in a file
            for i in range(len(data['open'])):
                dt = current.replace(hour=9, minute=15) + timedelta(minutes=i)
                all_data.append({
                    'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                    'open': data['open'][i],
                    'high': data['high'][i],
                    'low': data['low'][i],
                    'close': data['close'][i],
                    'is_ghost': is_ghost
                })
        else:
            print("Failed or Empty.")
            
        current += timedelta(days=1)
        time.sleep(0.5) # Dhan rate limiting

    if all_data:
        df = pd.DataFrame(all_data)
        df.to_csv(OUTPUT_FILE, index=False)
        print(f"\nCompleted! Saved {len(df)} candles to {OUTPUT_FILE}")
        
        # summary of ghosts
        ghost_count = df[df['is_ghost'] == True].shape[0] / 375 # approx days
        valid_count = df[df['is_ghost'] == False].shape[0] / 375 # approx days
        print(f"Summary: ~{int(valid_count)} valid days, ~{int(ghost_count)} ghost days recorded.")
    else:
        print("\nNo data retrieved from Dhan API.")

if __name__ == "__main__":
    download_last_month()
