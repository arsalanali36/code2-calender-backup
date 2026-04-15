
import pandas as pd
import os
import time
from services.dhan_service import fetch_and_cache_ohlc, get_config

config = get_config()
symbol = "NIFTY26FEB25650PE"
csv_path = f"data/Historical_OHLC/Options/{symbol}.csv"
target_date = "2026-02-20"
sec_id = "72358"

print("Waiting 10 seconds for Rate Limit to cool down...")
time.sleep(10)

try:
    print(f"Refetching accurate history for {target_date}...")
    fetch_and_cache_ohlc(sec_id, "NSE_FNO", "OPTIDX", target_date, "2026-02-26", config=config)
    
    cached_file = f"data/Historical_OHLC/{sec_id}_{target_date}.csv"
    if os.path.exists(cached_file):
        df_new = pd.read_csv(cached_file)
        if os.path.exists(csv_path):
            df_old = pd.read_csv(csv_path)
            # Ensure no ghost remains
            df_old['date_only'] = df_old['datetime'].str.slice(0, 10)
            df_old = df_old[df_old['date_only'] != target_date].drop(columns=['date_only'])
            
            df_final = pd.concat([df_old, df_new]).drop_duplicates('datetime').sort_values('datetime')
            df_final.to_csv(csv_path, index=False)
            print(f"SUCCESS! {symbol} history for {target_date} is now accurate.")
        else:
            df_new.to_csv(csv_path, index=False)
    else:
        print(f"FAILED: Refetch did not produce {cached_file}")
except Exception as e:
    print(f"Error: {e}")
