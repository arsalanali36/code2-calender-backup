
import os
import sys
import json
from datetime import datetime, timedelta

os.environ['FLASK_DEBUG'] = 'true'
BASE_DIR = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER"
sys.path.append(BASE_DIR)

from services.dhan_service_core import get_config
from services.dhan_service import fetch_and_cache_ohlc

config = get_config()
symbol = "NIFTY2641323750CE"
security_id = "54802"
segment = "NSE_FNO"
inst_type = "OPTIDX"
expiry = "2026-04-13"

# Fetch for the whole week
dates = ["2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-13"]

# DELETE old bad CSV first
csv_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{symbol}.csv")
if os.path.exists(csv_path):
    os.remove(csv_path)
    print(f"Deleted old bad data: {csv_path}")

# DELETE old meta too
meta_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{symbol}.meta")
if os.path.exists(meta_path):
    os.remove(meta_path)

for d in dates:
    print(f"Fetching accurate data for {d} using ID {security_id}...")
    try:
        fetch_and_cache_ohlc(security_id, segment, inst_type, d, expiry, config=config)
    except Exception as e:
        print(f"Error for {d}: {e}")

# FINAL STEP: Ensure the file is named correctly for the dashboard
# dhan_service saves it as {security_id}_{date}.csv by default in _cache_path.
# BUT Strategy Service expects {symbol}.csv in _expired_option_cache_path.
# So we must merge them into {symbol}.csv

import pandas as pd
all_dfs = []
for d in dates:
    p = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{security_id}_{d}.csv")
    if os.path.exists(p):
        all_dfs.append(pd.read_csv(p))

if all_dfs:
    final_df = pd.concat(all_dfs).drop_duplicates('datetime').sort_values('datetime')
    final_df.to_csv(csv_path, index=False)
    print(f"SUCCESS! Perfectly accurate data saved to {csv_path}")
    
    # Update meta for the UI dots
    with open(meta_path, 'w') as f:
        meta_data = {d: f"{d} 15:29:00" for d in dates}
        json.dump(meta_data, f)
else:
    print("FAILED: No data was fetched.")
