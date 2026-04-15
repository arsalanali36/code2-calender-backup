
import pandas as pd
import os
import time
from services.dhan_service import fetch_and_cache_ohlc, get_config

config = get_config()
symbol = "NIFTY26FEB25650PE"
csv_path = f"data/Historical_OHLC/Options/{symbol}.csv"
sec_id = "72360" # Correct ID for PUT
dates_to_sync = ["2026-02-20", "2026-02-24", "2026-02-25", "2026-02-26"]

print(f"POWER SYNC: Starting for {symbol}...")

for d in dates_to_sync:
    print(f"   Fetching {d}...")
    try:
        # We use a 2-second sleep to avoid Rate Limits (429)
        time.sleep(2)
        fetch_and_cache_ohlc(sec_id, "NSE_FNO", "OPTIDX", d, "2026-02-26", config=config)
        
        cached_file = f"data/Historical_OHLC/{sec_id}_{d}.csv"
        if os.path.exists(cached_file):
            df_new = pd.read_csv(cached_file)
            if os.path.exists(csv_path):
                df_old = pd.read_csv(csv_path)
                # Cleanup existing for this date
                df_old['date_only'] = df_old['datetime'].str.slice(0, 10)
                df_old = df_old[df_old['date_only'] != d].drop(columns=['date_only'])
                df_final = pd.concat([df_old, df_new]).drop_duplicates('datetime').sort_values('datetime')
                df_final.to_csv(csv_path, index=False)
            else:
                df_new.to_csv(csv_path, index=False)
            print(f"      [OK] Joined {d}")
        else:
            print(f"      [!] Failed to produce cache for {d}")
            
    except Exception as e:
        print(f"      [ERROR] {d}: {e}")

print("POWER SYNC COMPLETE. Chart should be smooth now.")
