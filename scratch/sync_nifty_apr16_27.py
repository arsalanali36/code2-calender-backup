"""
scratch/sync_nifty_apr16_27.py
Fetch Nifty 50 1-min data for Apr 16 – Apr 27 2026 via Dhan v2/intraday endpoint
and append to nifty_1m_dhan.csv. Removes any bad daily-candle rows first.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import time
import pandas as pd
import requests
from datetime import datetime, timedelta

CLIENT_ID    = "1101310976"
ACCESS_TOKEN = (
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9"
    ".eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3MzYwMzM5LCJpYXQiOjE3NzcyNzM5MzksInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0"
    ".hdRCu6dGxf3Sk7hfvjeBjnZYws3fe4t5Rujn9Lfnb3sKC9FyJlhXI6P6Zzioj6Dpes921Mnoy-N2Ja8unHTBhQ"
)

CSV_PATH   = "data/Historical_OHLC/nifty_1m_dhan.csv"
START_DATE = "2026-04-16"
END_DATE   = "2026-04-27"

HEADERS = {
    "Content-Type": "application/json",
    "access-token": ACCESS_TOKEN,
}

def fetch_intraday_day(date_str):
    """Fetch 1-min Nifty data for a single date via Dhan v2 intraday API."""
    url = "https://api.dhan.co/v2/charts/intraday"
    payload = {
        "securityId":      "13",
        "exchangeSegment": "IDX_I",
        "instrument":      "INDEX",
        "interval":        1,
        "fromDate":        date_str,
        "toDate":          date_str,
    }
    try:
        r = requests.post(url, headers=HEADERS, json=payload, timeout=15)
        r.raise_for_status()
        d = r.json()
    except Exception as e:
        print(f"  ERROR fetching {date_str}: {e}")
        return pd.DataFrame()

    opens  = d.get('open',  [])
    highs  = d.get('high',  [])
    lows   = d.get('low',   [])
    closes = d.get('close', [])
    vols   = d.get('volume', [])

    if not opens:
        print(f"  {date_str}: no data (market holiday or future date)")
        return pd.DataFrame()

    # v2 intraday doesn't return timestamps — candles start at 09:15, 1-min each
    start_dt = datetime.strptime(f"{date_str} 09:15:00", '%Y-%m-%d %H:%M:%S')
    rows = []
    for i in range(len(opens)):
        dt = start_dt + timedelta(minutes=i)
        rows.append({
            'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
            'close':    closes[i],
            'high':     highs[i],
            'low':      lows[i],
            'open':     opens[i],
            'volume':   vols[i] if i < len(vols) else 0,
            'time':     '',
            'oi':       '',
        })
    df = pd.DataFrame(rows)
    print(f"  {date_str}: {len(df)} candles  [{df['open'].iloc[0]:.2f} -> {df['close'].iloc[-1]:.2f}]")
    return df


def main():
    df_existing = pd.read_csv(CSV_PATH)
    print(f"Before: {len(df_existing)} rows, last date: {df_existing['datetime'].max()[:10]}")

    # Drop any bad rows from April 16 onwards (daily-candle artefacts)
    df_clean = df_existing[df_existing['datetime'] < START_DATE].copy()
    dropped = len(df_existing) - len(df_clean)
    if dropped:
        print(f"  Removed {dropped} bad rows from {START_DATE}+")

    curr = datetime.strptime(START_DATE, '%Y-%m-%d')
    end  = datetime.strptime(END_DATE,   '%Y-%m-%d')
    new_frames = [df_clean]

    while curr <= end:
        if curr.weekday() < 5:  # Mon–Fri only
            df_day = fetch_intraday_day(curr.strftime('%Y-%m-%d'))
            if not df_day.empty:
                new_frames.append(df_day)
            time.sleep(0.5)
        curr += timedelta(days=1)

    df_all = (pd.concat(new_frames, ignore_index=True)
                .drop_duplicates('datetime')
                .sort_values('datetime')
                .reset_index(drop=True))

    df_all.to_csv(CSV_PATH, index=False)
    print(f"\nAfter:  {len(df_all)} rows, last date: {df_all['datetime'].max()[:10]}")


if __name__ == '__main__':
    main()
