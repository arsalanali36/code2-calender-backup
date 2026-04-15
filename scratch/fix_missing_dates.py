
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

def fetch_and_stitch(sym, target_strike, otype, dates=None):
    if dates is None:
        dates = ["2026-04-08", "2026-04-09", "2026-04-10", "2026-04-13", "2026-04-15"]
    
    nifty_df = pd.read_csv(os.path.join(BASE_DIR, "data", "Historical_OHLC", "nifty_1m_dhan.csv"))
    nifty_df['datetime'] = pd.to_datetime(nifty_df['datetime'])
    
    csv_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{sym}.csv")
    meta_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{sym}.meta")
    
    # Load existing data
    existing_df = pd.DataFrame()
    existing_meta = {}
    if os.path.exists(csv_path):
        try:
            existing_df = pd.read_csv(csv_path)
            existing_df['datetime'] = pd.to_datetime(existing_df['datetime'])
        except: pass
    
    if os.path.exists(meta_path):
        try:
            with open(meta_path, 'r') as f:
                existing_meta = json.load(f)
        except: pass

    all_rows = []
    actual_synced_dates = []
    
    for d in dates:
        # Skip if already in meta (optimization)
        if d in existing_meta:
            print(f"Skipping {sym} for {d} (Already in meta)")
            continue
            
        print(f"Deep Syncing {sym} for {d}...")
        strikedata = {}
        # Use range to find the strike
        for n in range(-10, 11):
            s_str = "ATM" if n == 0 else (f"ATM+{n}" if n > 0 else f"ATM{n}")
            url = f"{DHAN_API_BASE}/v2/charts/rollingoption"
            to_date = (datetime.strptime(d, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
            payload = {
                "securityId": "13", "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX",
                "interval": 1, "expiryCode": 1, "expiryFlag": "WEEK",
                "strike": s_str, "drvOptionType": otype,
                "requiredData": ["open", "high", "low", "close", "volume"],
                "fromDate": d, "toDate": to_date,
            }
            try:
                resp = _post_json(url, payload, headers)
                df = _parse_rollingoption_response(resp, d, otype)
                if not df.empty:
                    df['datetime'] = pd.to_datetime(df['datetime'])
                    strikedata[n] = df
                time.sleep(0.4)
            except: pass
        
        if strikedata:
            day_nifty = nifty_df[nifty_df['datetime'].dt.strftime('%Y-%m-%d') == d]
            found_any = False
            for _, spot_row in day_nifty.iterrows():
                ts = spot_row['datetime']
                spot = spot_row['close']
                atm = round(spot / 50) * 50
                n_needed = int((target_strike - atm) / 50)
                if n_needed in strikedata:
                    match = strikedata[n_needed][strikedata[n_needed]['datetime'] == ts]
                    if not match.empty:
                        all_rows.append(match.iloc[0])
                        found_any = True
            if found_any: 
                actual_synced_dates.append(d)
                existing_meta[d] = f"{d} 15:29:00"
            
    if all_rows:
        new_df = pd.DataFrame(all_rows)
        if not existing_df.empty:
            final_df = pd.concat([existing_df, new_df]).drop_duplicates(subset=['datetime']).sort_values('datetime')
        else:
            final_df = new_df.sort_values('datetime')
            
        final_df.to_csv(csv_path, index=False)
        with open(meta_path, 'w') as f: 
            json.dump(existing_meta, f, indent=2)
        print(f"DONE: {sym} updated with {len(new_df)} new rows.")
    else:
        print(f"NO DATA: Nothing found for {sym} on requested dates.")

if __name__ == "__main__":
    # Test/Example
    if len(sys.argv) > 1:
        # Can run from CLI if needed
        pass
    else:
        # fetch_and_stitch("NIFTY2641323600CE", 23600, "CALL")
        # fetch_and_stitch("NIFTY2641324000PE", 24000, "PUT")
        pass

