
import os
import pandas as pd
from datetime import datetime
from services.dhan_service import fetch_and_cache_ohlc, get_config

INDEX_PATH = "data/Historical_OHLC/nifty_1m_dhan.csv"
config = get_config()

if not config or not config.get('access_token'):
    print("Error: No Dhan Token found. Please login in the dashboard first.")
    exit(1)

dates_to_sync = ["2026-04-14", "2026-04-15"]

if os.path.exists(INDEX_PATH):
    df_main = pd.read_csv(INDEX_PATH)
else:
    df_main = pd.DataFrame()

for d in dates_to_sync:
    print(f"Syncing Index for {d}...")
    try:
        # CORRECTED: Use IDX_I for Nifty 50 Index
        df_day = fetch_and_cache_ohlc('13', 'IDX_I', 'INDEX', d, config=config)
        if df_day is not None and not df_day.empty:
            if df_main.empty: df_main = df_day
            else: df_main = pd.concat([df_main, df_day]).drop_duplicates('datetime').sort_values('datetime')
            print(f"Success for {d}!")
        else:
            print(f"No data returned for {d}")
    except Exception as e:
        print(f"Failed for {d}: {e}")

df_main.to_csv(INDEX_PATH, index=False)
print("Index update complete.")
