"""
Scripts/migrate_ohlc_options.py
--------------------------------
Migrate data/Historical_OHLC/Options/*.csv → data/ohlc/options/SYMBOL/DATE.csv

Old format (one file per symbol, all dates):
    data/Historical_OHLC/Options/NIFTY26MAR22500CE.csv
    columns: datetime, time, open, high, low, close, volume

New format (one file per symbol per date):
    data/ohlc/options/NIFTY26MAR22500CE/2026-03-20.csv
    columns: datetime, open, high, low, close, volume

Skips dates already present in the new store.
Run once — idempotent (safe to re-run).
"""
import sys
import os
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import services.ohlc_service as ohlc

SRC_DIR = os.path.join(ROOT, 'data', 'Historical_OHLC', 'Options')


def migrate():
    if not os.path.isdir(SRC_DIR):
        print(f"ERROR: {SRC_DIR} not found")
        sys.exit(1)

    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith('.csv'))
    print(f"\n{'='*60}")
    print(f"  Options Migration: {len(files)} symbols")
    print(f"  {SRC_DIR}")
    print(f"  -> data/ohlc/options/")
    print(f"{'='*60}\n")

    total_dates = ok = skipped = failed = 0

    for i, fname in enumerate(files, 1):
        symbol = fname[:-4].upper()
        src    = os.path.join(SRC_DIR, fname)

        try:
            df = pd.read_csv(src)
            # drop extra 'time' column if present
            if 'time' in df.columns:
                df = df.drop(columns=['time'])
            # ensure correct column order
            df = df[['datetime', 'open', 'high', 'low', 'close', 'volume']]
            df['datetime'] = df['datetime'].astype(str)
            df['date']     = df['datetime'].str[:10]

            dates = sorted(df['date'].unique())
            sym_ok = sym_skip = sym_fail = 0

            for d in dates:
                total_dates += 1
                if ohlc.is_complete(symbol, d):
                    sym_skip += 1
                    skipped  += 1
                    continue
                try:
                    day_df = (df[df['date'] == d]
                                .drop(columns=['date'])
                                .reset_index(drop=True))
                    ohlc._save(symbol, d, day_df)
                    sym_ok += 1
                    ok     += 1
                except Exception as e:
                    sym_fail += 1
                    failed   += 1
                    print(f"  FAIL {symbol} {d}: {e}")

            status = f"ok={sym_ok} skip={sym_skip} fail={sym_fail}"
            print(f"  [{i:3}/{len(files)}] {symbol:35s} {len(dates)} dates  {status}")

        except Exception as e:
            print(f"  [{i:3}/{len(files)}] {symbol:35s} ERROR reading file: {e}")

    print(f"\n{'='*60}")
    print(f"  Done — {total_dates} (symbol,date) pairs processed")
    print(f"  OK={ok}  Skipped={skipped}  Failed={failed}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    migrate()
