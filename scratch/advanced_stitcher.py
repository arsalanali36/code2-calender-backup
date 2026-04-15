
import os
import sys
import json
import time
import pandas as pd
from datetime import datetime, timedelta

os.environ['FLASK_DEBUG'] = 'true'
BASE_DIR = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER"
sys.path.append(BASE_DIR)

from services.dhan_service_core import get_config, _dhan_headers, _post_json, DHAN_API_BASE
from services.dhan_service import _parse_rollingoption_response

config = get_config()
headers = _dhan_headers(config)

symbol = "NIFTY2641323750CE"
target_strike = 23750
step = 50

# Days we want to fix/fill
dates = ["2026-04-08", "2026-04-09", "2026-04-10", "2026-04-13"]

# Load Nifty Spot for ATM calculation
nifty_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "nifty_1m_dhan.csv")
nifty_df = pd.read_csv(nifty_path)
nifty_df['datetime'] = pd.to_datetime(nifty_df['datetime'])

# Fetch a range of offsets
offsets = range(-8, 9) # ATM-8 to ATM+8 should cover April 8-13 range
results = {}

def fetch_rolling(d, strike_str):
    url = f"{DHAN_API_BASE}/v2/charts/rollingoption"
    to_date = (datetime.strptime(d, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
    payload = {
        "securityId": "13",
        "exchangeSegment": "NSE_FNO",
        "instrument": "OPTIDX",
        "interval": 1,
        "expiryCode": 1,
        "expiryFlag": "WEEK",
        "strike": strike_str,
        "drvOptionType": "CALL",
        "requiredData": ["open", "high", "low", "close", "volume"],
        "fromDate": d,
        "toDate": to_date,
    }
    try:
        resp = _post_json(url, payload, headers)
        df = _parse_rollingoption_response(resp, d, "CALL")
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
            return df
    except Exception as e:
        print(f"Error fetching {strike_str} on {d}: {e}")
    return pd.DataFrame()

all_final_data = []

for d in dates:
    print(f"--- Processing {d} ---")
    strikedata = {}
    for n in offsets:
        s_str = "ATM" if n == 0 else (f"ATM+{n}" if n > 0 else f"ATM{n}")
        print(f"Fetching {s_str}...")
        df_n = fetch_rolling(d, s_str)
        if not df_n.empty:
            strikedata[n] = df_n
        time.sleep(0.6) # Avoid rate limit
    
    if not strikedata:
        print(f"No data for {d}")
        continue
    
    # Stitch for this day
    day_nifty = nifty_df[nifty_df['datetime'].dt.strftime('%Y-%m-%d') == d]
    day_rows = []
    
    for _, spot_row in day_nifty.iterrows():
        ts = spot_row['datetime']
        spot = spot_row['close']
        atm = round(spot / step) * step
        n_needed = int((target_strike - atm) / step)
        
        if n_needed in strikedata:
            df_strike = strikedata[n_needed]
            match = df_strike[df_strike['datetime'] == ts]
            if not match.empty:
                # Add it to our final set
                day_rows.append(match.iloc[0])
    
    if day_rows:
        day_df = pd.DataFrame(day_rows)
        all_final_data.append(day_df)
        print(f"Stitched {len(day_df)} minutes for {d}")

if all_final_data:
    final_csv_df = pd.concat(all_final_data).sort_values('datetime')
    output_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{symbol}.csv")
    final_csv_df.to_csv(output_path, index=False)
    print(f"STITCHING COMPLETE! Saved to {output_path}")
    
    # Update meta
    meta_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{symbol}.meta")
    meta_data = {d: f"{d} 15:29:00" for d in dates if any(final_csv_df['datetime'].dt.strftime('%Y-%m-%d') == d)}
    with open(meta_path, 'w') as f:
        json.dump(meta_data, f)
else:
    print("Failed to stitch any data.")
