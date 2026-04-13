import requests, json, time, sys, os
from datetime import datetime, timedelta
import pandas as pd

ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MTY3NTQzLCJpYXQiOjE3NzYwODExNDMsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.AUpYSyowfCeRwffirCJLyCbvdsML-sk75RxUjFlUqvSMQXcnJsvwJivpZQd7_dVdzDjV5c9lE6488cJZpFp6XA"
OUTPUT_FILE = "data/nifty_1m_dhan.csv"

def fetch(d):
    url = "https://api.dhan.co/charts/intraday"
    payload = {"securityId": "13", "exchangeSegment": "IDX_I", "instrument": "INDEX", "fromDate": d, "toDate": d}
    headers = {"Content-Type": "application/json", "access-token": ACCESS_TOKEN}
    try:
        r = requests.post(url, headers=headers, json=payload)
        return r.json() if r.status_code == 200 else None
    except: return None

def main():
    cur = datetime(2026,2,1)
    end = datetime(2026,4,13)
    os.makedirs('data', exist_ok=True)
    if os.path.exists(OUTPUT_FILE): os.remove(OUTPUT_FILE)
    
    while cur <= end:
        ds = cur.strftime('%Y-%m-%d')
        sys.stdout.write(f"Aligning {ds}...")
        sys.stdout.flush()
        res = fetch(ds)
        if res and isinstance(res, dict) and 'open' in res and res['open']:
            # Force current year/date from iteration to avoid API timestamp glitches
            start_ts = int(cur.replace(hour=9, minute=15).timestamp())
            candles = []
            for i in range(len(res['open'])):
                # We calculate timestamp manually to ensure it's 2026
                # Assuming Dhan returns candles sequentially from 09:15
                target_dt = cur.replace(hour=9, minute=15) + timedelta(minutes=i)
                candles.append({
                    'datetime': target_dt.strftime('%Y-%m-%d %H:%M:%S'),
                    'open': res['open'][i], 'high': res['high'][i],
                    'low': res['low'][i], 'close': res['close'][i]
                })
            df = pd.DataFrame(candles)
            df = df[(df[['open','high','low','close']] > 0).any(axis=1)]
            df.to_csv(OUTPUT_FILE, mode='a', index=False, header=not os.path.exists(OUTPUT_FILE))
            sys.stdout.write(f" -> Fixed {len(df)} candles.\n")
        else:
            sys.stdout.write(" -> Skip.\n")
        sys.stdout.flush()
        cur += timedelta(days=1)
        time.sleep(0.3)
    print("Alignment Complete!")

if __name__ == "__main__":
    main()
