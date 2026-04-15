
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

def fetch_and_stitch(sym, target_strike, otype):
    dates = ["2026-04-08", "2026-04-09", "2026-04-10", "2026-04-13"]
    nifty_df = pd.read_csv(os.path.join(BASE_DIR, "data", "Historical_OHLC", "nifty_1m_dhan.csv"))
    nifty_df['datetime'] = pd.to_datetime(nifty_df['datetime'])
    all_rows = []
    actual_synced_dates = []
    
    for d in dates:
        print(f"Deep Syncing {sym} for {d}...")
        strikedata = {}
        # Use wider range to ensure we find the strike
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
            if found_any: actual_synced_dates.append(d)
            
    if all_rows:
        final_df = pd.DataFrame(all_rows).sort_values('datetime')
        csv_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{sym}.csv")
        final_df.to_csv(csv_path, index=False)
        meta_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{sym}.meta")
        meta_data = {d: f"{d} 15:29:00" for d in actual_synced_dates}
        with open(meta_path, 'w') as f: json.dump(meta_data, f)
        print(f"DONE: {sym} updated.")

# FIX BOTH PROBLEM INSTRUMENTS
fetch_and_stitch("NIFTY2641323600CE", 23600, "CALL")
fetch_and_stitch("NIFTY2641324000PE", 24000, "PUT")
