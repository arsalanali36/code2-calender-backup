"""
Download missing NIFTY March 2026 monthly options data from Dhan API
using the rollingoption endpoint (same as the UI's SYNC button).

Run: python Scripts/download_mar26_options.py
"""
import sys, os, time, json
from datetime import date, timedelta, datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.dhan_service_core import get_config
from services.dhan_service import fetch_expired_option_ohlc

config = get_config()
if not config:
    print("ERROR: No Dhan credentials found. Save them via the app UI first.")
    sys.exit(1)
print(f"Credentials: client_id={config.get('client_id')}\n")

# 10 NIFTY March 2026 monthly symbols
SYMBOLS = [
    "NIFTY26MAR22500CE",
    "NIFTY26MAR22650CE",
    "NIFTY26MAR22700CE",
    "NIFTY26MAR23150CE",
    "NIFTY26MAR23350CE",
    "NIFTY26MAR23350PE",
    "NIFTY26MAR23400CE",
    "NIFTY26MAR23450CE",
    "NIFTY26MAR23500CE",
    "NIFTY26MAR23550CE",
]

# Date range: Feb 27 to March 23 (March 24 onwards already exists)
START = date(2026, 2, 27)
END   = date(2026, 3, 23)

# Build list of trading days (Mon-Fri, skip known holidays)
HOLIDAYS = {"2026-03-02", "2026-03-21"}  # Maha Shivratri, Holi (NSE holidays)

def trading_days(start, end):
    days = []
    d = start
    while d <= end:
        if d.weekday() < 5 and str(d) not in HOLIDAYS:
            days.append(str(d))
        d += timedelta(days=1)
    return days

all_days = trading_days(START, END)
print(f"Dates to fetch: {all_days[0]} to {all_days[-1]}  ({len(all_days)} trading days)")
print(f"Symbols: {len(SYMBOLS)}")
print(f"Total API calls: ~{len(SYMBOLS) * len(all_days)}\n")
print("=" * 70)

ok_count  = 0
err_count = 0
skip_count = 0

for sym in SYMBOLS:
    print(f"\n[{sym}]")
    for d in all_days:
        try:
            result = fetch_expired_option_ohlc(sym, d, config=config)
            if isinstance(result, str) and result == "ALREADY_COMPLETE":
                print(f"  {d} SKIP (already complete)")
                skip_count += 1
            elif isinstance(result, str) and result == "AUTH_FAILED":
                print("  AUTH FAILED — check Dhan token")
                sys.exit(1)
            else:
                import pandas as pd
                n = len(result) if (result is not None and not isinstance(result, str) and not result.empty) else 0
                print(f"  {d} OK  ({n} candles)")
                ok_count += 1
        except Exception as e:
            print(f"  {d} ERR: {e}")
            err_count += 1
        time.sleep(0.7)   # polite throttle

print("\n" + "=" * 70)
print(f"Done — OK:{ok_count}  SKIP:{skip_count}  ERR:{err_count}")
