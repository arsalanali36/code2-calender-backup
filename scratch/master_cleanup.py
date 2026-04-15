
import os
import sys
import json
import time
import pandas as pd
import re
from datetime import datetime, timedelta

os.environ['FLASK_DEBUG'] = 'true'
BASE_DIR = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER"
sys.path.append(BASE_DIR)

from services.dhan_service_core import get_config, _dhan_headers, _post_json, DHAN_API_BASE
from services.dhan_service import _parse_rollingoption_response

config = get_config()
headers = _dhan_headers(config)
step = 50

# Load Nifty Spot for ATM calculation
nifty_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "nifty_1m_dhan.csv")
nifty_df = pd.read_csv(nifty_path)
nifty_df['datetime'] = pd.to_datetime(nifty_df['datetime'])

MONTH_MAP = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
}

def parse_symbol(sym):
    # Weekly: NIFTY2641323750CE -> 26 4 13 23750 CE
    # Monthly: NIFTY26FEB25350CE -> 26 FEB 25350 CE
    
    # Try Weekly pattern first (assuming month is 1 char or 10/11/12)
    # Actually, Dhan Weekly uses 1-9 for Jan-Sep, then O, N, D for Oct, Nov, Dec usually?
    # No, look at filenames: NIFTY26210... likely 2 = Feb, 10 = Day.
    # So Month is 1 char always? (1-9, O, N, D)
    
    match_w = re.match(r"NIFTY(\d{2})([1-9OND])(\d{2})(\d+)([CP]E)", sym)
    if match_w:
        y, m, d, strike, otype = match_w.groups()
        m_num = int(m) if m.isdigit() else {'O':10, 'N':11, 'D':12}[m]
        expiry = f"20{y}-{m_num:02d}-{int(d):02d}"
        return {"expiry": expiry, "strike": int(strike), "type": "CALL" if otype == "CE" else "PUT"}
        
    # Try Monthly pattern
    match_m = re.match(r"NIFTY(\d{2})([A-Z]{3})(\d+)([CP]E)", sym)
    if match_m:
        y, m_name, strike, otype = match_m.groups()
        m_num = MONTH_MAP.get(m_name)
        if m_num:
            # For monthly, we should find the last Thursday of the month
            # For now, let's just use a dummy day and search for data near it
            # Actually, without the exact day, stitching is harder.
            # But the filenames in the list like NIFTY26FEB25350CE didn't have a day.
            # I'll just skip monthly for now or assume a logic.
            return None 

    return None

def fetch_rolling(d, strike_str, otype):
    # ... (same as before)
    url = f"{DHAN_API_BASE}/v2/charts/rollingoption"
    to_date = (datetime.strptime(d, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
    payload = {
        "securityId": "13", "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX",
        "interval": 1, "expiryCode": 1, "expiryFlag": "WEEK",
        "strike": strike_str, "drvOptionType": otype,
        "requiredData": ["open", "high", "low", "close", "volume"],
        "fromDate": d, "toDate": to_date,
    }
    try:
        resp = _post_json(url, payload, headers)
        df = _parse_rollingoption_response(resp, d, otype)
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
            return df
    except: pass
    return pd.DataFrame()

def stitch_instrument(sym):
    info = parse_symbol(sym)
    if not info: return False
    
    target_strike = info['strike']
    otype = info['type']
    try:
        expiry_dt = datetime.strptime(info['expiry'], '%Y-%m-%d')
    except: return False
    
    lookback_dates = []
    curr = expiry_dt
    while len(lookback_dates) < 5:
        if curr.weekday() < 5:
            lookback_dates.append(curr.strftime('%Y-%m-%d'))
        curr -= timedelta(days=1)
        if (expiry_dt - curr).days > 15: break
    
    csv_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{sym}.csv")
    meta_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{sym}.meta")
    
    all_final_data = []
    offsets = range(-8, 9)
    print(f"Stitching {sym} (Expiry: {info['expiry']})")
    
    for d in reversed(lookback_dates):
        strikedata = {}
        for n in offsets:
            s_str = "ATM" if n == 0 else (f"ATM+{n}" if n > 0 else f"ATM{n}")
            df_n = fetch_rolling(d, s_str, otype)
            if not df_n.empty: strikedata[n] = df_n
            time.sleep(0.3)
            
        day_nifty = nifty_df[nifty_df['datetime'].dt.strftime('%Y-%m-%d') == d]
        day_rows = []
        for _, spot_row in day_nifty.iterrows():
            ts = spot_row['datetime']
            spot = spot_row['close']
            atm = round(spot / step) * step
            n_needed = int((target_strike - atm) / step)
            if n_needed in strikedata:
                match = strikedata[n_needed][strikedata[n_needed]['datetime'] == ts]
                if not match.empty: day_rows.append(match.iloc[0])
        if day_rows: all_final_data.append(pd.DataFrame(day_rows))
        
    if all_final_data:
        final_df = pd.concat(all_final_data).drop_duplicates('datetime').sort_values('datetime')
        final_df.to_csv(csv_path, index=False)
        meta_data = {d: f"{d} 15:29:00" for d in lookback_dates}
        with open(meta_path, 'w') as f: json.dump(meta_data, f)
        print(f"DONE: {sym}")
        return True
    return False

if __name__ == "__main__":
    opt_dir = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options")
    files = sorted([f.replace('.csv', '') for f in os.listdir(opt_dir) if f.endswith('.csv')], reverse=True)
    total = len(files)
    progress_log = os.path.join(BASE_DIR, "scratch", "cleanup_progress.txt")
    
    for idx, f in enumerate(files):
        if "23750" in f: continue
        
        # STATUS UPDATE
        with open(progress_log, "w") as pl:
            pl.write(f"Progress: {idx+1}/{total}\n")
            pl.write(f"Currently processing: {f}\n")
            pl.write(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # RESUME LOGIC: Check if already done
        meta_path = os.path.join(opt_dir, f"{f}.meta")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r') as m:
                    meta_data = json.load(m)
                    # If we have 5 or more days, it's likely already cleaned/stitched
                    if len(meta_data) >= 5:
                        print(f"Skipping {f} (Already stitched)")
                        continue
            except: pass

        print(f"\n>>> Processing {f}...")
        stitch_instrument(f)
        print("Waiting 5s between instruments...")
        time.sleep(5)
