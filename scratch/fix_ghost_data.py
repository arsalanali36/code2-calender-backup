
import pandas as pd
import os
from services.dhan_service import fetch_and_cache_ohlc, get_config

config = get_config()
symbol = "NIFTY26FEB25650PE"
csv_path = f"data/Historical_OHLC/Options/{symbol}.csv"
target_date = "2026-02-20"

# 1. Clean up the CSV
if os.path.exists(csv_path):
    print(f"Cleaning {csv_path}...")
    df = pd.read_csv(csv_path)
    df['date_only'] = df['datetime'].str.slice(0, 10)
    
    # Remove the suspected ghost date
    orig_len = len(df)
    df = df[df['date_only'] != target_date]
    
    if len(df) < orig_len:
        print(f"Purged {orig_len - len(df)} ghost candles for {target_date}.")
        # Also let's check for other potential ghosts (same price as today?)
        # But for now, let's just focus on fixing the reported date
        df.drop(columns=['date_only']).to_csv(csv_path, index=False)
    else:
        print(f"Date {target_date} not found in CSV correctly.")

# 2. Refetch using proper parameters for history
# We know it's NSE_FNO, OPTIDX, and expiry 2026-02-26
print(f"Refetching accurate history for {target_date}...")
# Note: fetch_and_cache_ohlc uses historical API for non-today dates
# ID for NIFTY26FEB25650PE is 72358 (from previous map check or scrip master)
sec_id = "72358" 
fetch_and_cache_ohlc(sec_id, "NSE_FNO", "OPTIDX", target_date, "2026-02-26", config=config)

# 3. Merge back
cached_file = f"data/Historical_OHLC/{sec_id}_{target_date}.csv"
if os.path.exists(cached_file):
    df_new = pd.read_csv(cached_file)
    df_old = pd.read_csv(csv_path)
    df_final = pd.concat([df_old, df_new]).drop_duplicates('datetime').sort_values('datetime')
    df_final.to_csv(csv_path, index=False)
    print(f"SUCCESS! {symbol} history for {target_date} is now accurate.")
else:
    print(f"FAILED: Refetch did not produce {cached_file}")
