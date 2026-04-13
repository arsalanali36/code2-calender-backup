
import sys
import os
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from services.dhan_service import fetch_expired_option_ohlc

sym = 'NIFTY2641323600CE'
date = '2026-04-10'

try:
    print(f"Attempting to fetch {sym} for {date}...")
    df = fetch_expired_option_ohlc(sym, date)
    print(f"Success! Fetched {len(df)} candles.")
    print("First few lines:")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")
