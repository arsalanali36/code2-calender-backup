import requests
import time
import pandas as pd
from datetime import datetime, timedelta

DHAN_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"

def try_fetch_dhan(date_str, endpoint):
    url = f"https://api.dhan.co/charts/{endpoint}"
    # Try different intervals/payloads
    payload = {
        "securityId": "13", 
        "exchangeSegment": "IDX_I", 
        "instrument": "INDEX", 
        "fromDate": date_str, 
        "toDate": date_str
    }
    if endpoint == 'historical': payload['interval'] = '1'
    
    headers = {"Content-Type": "application/json", "access-token": DHAN_TOKEN}
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            d = res.json()
            if 'open' in d and d['open']:
                # GHOST CHECK against Today's price
                if abs(d['open'][0] - 23589.6) < 0.1 and date_str != datetime.now().strftime('%Y-%m-%d'):
                    return None
                return d
    except: pass
    return None

def power_sync():
    dates_to_sync = []
    end = datetime.now()
    for i in range(45): # Try last 45 days
        dates_to_sync.append((end - timedelta(days=i)).strftime('%Y-%m-%d'))
    
    all_dfs = []
    for d_str in dates_to_sync:
        print(f"Syncing {d_str}...", end=" ")
        # Try Intraday first
        data = try_fetch_dhan(d_str, 'intraday')
        if not data:
            # Try Historical if intraday fails or returns ghost
            data = try_fetch_dhan(d_str, 'historical')
        
        if data:
            base = datetime.strptime(f"{d_str} 09:15:00", "%Y-%m-%d %H:%M:%S")
            df = pd.DataFrame({
                'datetime': [base + timedelta(minutes=i) for i in range(len(data['open']))],
                'open': data['open'], 'high': data['high'], 'low': data['low'], 'close': data['close']
            })
            print(f"Success! ({len(df)} candles)")
            all_dfs.append(df)
        else:
            print("Failed (No genuine history found on Dhan server)")
        time.sleep(0.5)

    if all_dfs:
        new_data = pd.concat(all_dfs)
        path = 'data/nifty_1m_dhan.csv'
        
        if os.path.exists(path):
            existing_df = pd.read_csv(path)
            existing_df['datetime'] = pd.to_datetime(existing_df['datetime'])
            # Ensure new_data datetime is also pd.datetime
            new_data['datetime'] = pd.to_datetime(new_data['datetime'])
            final = pd.concat([existing_df, new_data]).drop_duplicates(subset=['datetime']).sort_values('datetime')
            print(f"Merged {len(new_data)} new candles into existing {len(existing_df)} candles.")
        else:
            final = new_data.drop_duplicates(subset=['datetime']).sort_values('datetime')
            print(f"Created new archive with {len(final)} candles.")

        final.to_csv(path, index=False)
        print(f"\nPower Sync Complete: {len(final)} total candles saved.")
    else:
        print("\nDhan servers didn't return any NEW historical 1m data for the requested dates.")

if __name__ == "__main__":
    power_sync()
