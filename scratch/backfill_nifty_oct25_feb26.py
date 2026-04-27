"""
scratch/backfill_nifty_oct25_feb26.py
======================================
Downloads Nifty 50 1-min OHLC data from Oct 1, 2025 to Feb 12, 2026
using Dhan v2/charts/intraday API and merges into nifty_1m_dhan.csv.

Progress is written live to: scratch/backfill_progress.txt
Data saved to:               data/Historical_OHLC/nifty_1m_dhan.csv

Run from project root:
    python scratch/backfill_nifty_oct25_feb26.py
"""

import os, sys, time, requests, pandas as pd
from datetime import datetime, timedelta

# ── Config ─────────────────────────────────────────────────────────────────────
CLIENT_ID    = "1101310976"
ACCESS_TOKEN = (
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9"
    ".eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3MzYwMzM5LCJpYXQiOjE3NzcyNzM5MzksInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0"
    ".hdRCu6dGxf3Sk7hfvjeBjnZYws3fe4t5Rujn9Lfnb3sKC9FyJlhXI6P6Zzioj6Dpes921Mnoy-N2Ja8unHTBhQ"
)

START_DATE   = "2025-10-01"   # fetch from here
END_DATE     = "2026-02-12"   # fetch until here (Feb 13 already in CSV)

CSV_PATH     = "data/Historical_OHLC/nifty_1m_dhan.csv"
LOG_PATH     = "scratch/backfill_progress.txt"
SLEEP_SEC    = 0.6            # between requests (avoid 429)

HEADERS = {
    "Content-Type": "application/json",
    "access-token": ACCESS_TOKEN,
}

# Known NSE market holidays Oct 2025 – Feb 2026
HOLIDAYS = {
    "2025-10-02",  # Gandhi Jayanti
    "2025-10-24",  # Dussehra
    "2025-11-05",  # Diwali (Laxmi Puja)
    "2025-11-15",  # Gurunanak Jayanti
    "2025-12-25",  # Christmas
    "2026-01-26",  # Republic Day
    "2026-02-26",  # Maha Shivratri  (outside range but listed for completeness)
}

# ── Helpers ────────────────────────────────────────────────────────────────────

def log(msg, also_print=True):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    if also_print:
        print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def fetch_day(date_str):
    """Fetch 1-min Nifty candles for one date. Returns DataFrame or empty."""
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
    except requests.exceptions.HTTPError as e:
        if r.status_code == 429:
            log(f"  429 Rate limit! Sleeping 30s...")
            time.sleep(30)
            return fetch_day(date_str)   # retry once
        log(f"  HTTP ERROR {r.status_code} for {date_str}: {e}")
        return pd.DataFrame()
    except Exception as e:
        log(f"  FETCH ERROR {date_str}: {e}")
        return pd.DataFrame()

    opens  = d.get('open',   [])
    highs  = d.get('high',   [])
    lows   = d.get('low',    [])
    closes = d.get('close',  [])
    vols   = d.get('volume', [])

    if not opens:
        return pd.DataFrame()

    start_dt = datetime.strptime(f"{date_str} 09:15:00", "%Y-%m-%d %H:%M:%S")
    rows = []
    for i, (o, h, l, c) in enumerate(zip(opens, highs, lows, closes)):
        dt = start_dt + timedelta(minutes=i)
        rows.append({
            "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "close":    c, "high": h, "low": l, "open": o,
            "volume":   vols[i] if i < len(vols) else 0,
            "time": "", "oi": "",
        })
    return pd.DataFrame(rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    os.makedirs("scratch", exist_ok=True)

    # Clear/start log
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write(f"Nifty Backfill Log — started {datetime.now()}\n")
        f.write(f"Range: {START_DATE} to {END_DATE}\n")
        f.write("=" * 60 + "\n")

    # Load existing CSV
    if os.path.exists(CSV_PATH):
        df_existing = pd.read_csv(CSV_PATH)
        existing_dates = set(df_existing["datetime"].str[:10].unique())
        log(f"Existing CSV: {len(df_existing)} rows, dates: {sorted(existing_dates)[0]} to {sorted(existing_dates)[-1]}")
    else:
        df_existing = pd.DataFrame()
        existing_dates = set()
        log("No existing CSV found — will create fresh.")

    # Build list of dates to fetch
    curr = datetime.strptime(START_DATE, "%Y-%m-%d")
    end  = datetime.strptime(END_DATE,   "%Y-%m-%d")
    all_dates = []
    while curr <= end:
        ds = curr.strftime("%Y-%m-%d")
        if curr.weekday() < 5 and ds not in HOLIDAYS:
            all_dates.append(ds)
        curr += timedelta(days=1)

    to_fetch = [d for d in all_dates if d not in existing_dates]
    log(f"Total trading days in range: {len(all_dates)}")
    log(f"Already in CSV:              {len(all_dates) - len(to_fetch)}")
    log(f"Need to fetch:               {len(to_fetch)}")
    log("-" * 60)

    if not to_fetch:
        log("Nothing to fetch — CSV already complete for this range!")
        return

    # Fetch day by day
    new_frames = []
    success = 0
    empty   = 0
    errors  = 0

    for idx, ds in enumerate(to_fetch, 1):
        df_day = fetch_day(ds)
        pct = idx / len(to_fetch) * 100

        if not df_day.empty:
            new_frames.append(df_day)
            success += 1
            log(f"  [{idx:3d}/{len(to_fetch)}] {ds}: {len(df_day):3d} candles "
                f"| open={df_day['open'].iloc[0]:.1f}  close={df_day['close'].iloc[-1]:.1f} "
                f"| {pct:.0f}% done")
        else:
            empty += 1
            log(f"  [{idx:3d}/{len(to_fetch)}] {ds}: NO DATA (holiday/API gap) | {pct:.0f}% done")

        time.sleep(SLEEP_SEC)

    # Merge and save
    log("-" * 60)
    log("Merging into CSV...")

    if new_frames:
        df_new = pd.concat(new_frames, ignore_index=True)
        if not df_existing.empty:
            df_all = (pd.concat([df_existing, df_new])
                        .drop_duplicates("datetime")
                        .sort_values("datetime")
                        .reset_index(drop=True))
        else:
            df_all = df_new.sort_values("datetime").reset_index(drop=True)

        df_all.to_csv(CSV_PATH, index=False)
        unique_days = df_all["datetime"].str[:10].nunique()
        log(f"DONE. CSV updated:")
        log(f"  Total rows  : {len(df_all)}")
        log(f"  Total days  : {unique_days}")
        log(f"  Date range  : {df_all['datetime'].iloc[0][:10]} to {df_all['datetime'].iloc[-1][:10]}")
        log(f"  Fetched OK  : {success}")
        log(f"  Empty/holiday: {empty}")
    else:
        log("No new data fetched. CSV unchanged.")

    log("=" * 60)
    log(f"Log saved to: {LOG_PATH}")


if __name__ == "__main__":
    main()
