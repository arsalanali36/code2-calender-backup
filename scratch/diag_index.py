
import os
import pandas as pd
from datetime import datetime
from services.dhan_service import fetch_and_cache_ohlc, get_config

config = get_config()
today = "2026-04-15"

print(f"DIAGNOSTIC: Fetching Index for {today}...")
df = fetch_and_cache_ohlc('13', 'IDX_I', 'INDEX', today, config=config)

if df is not None and not df.empty:
    print(f"Success! Found {len(df)} candles.")
    print("First 3 rows:")
    print(df.head(3))
    print("Last 3 rows:")
    print(df.tail(3))
else:
    print("Failed: No data returned or empty dataframe.")
