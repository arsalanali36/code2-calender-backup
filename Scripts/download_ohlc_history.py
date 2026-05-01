"""
Scripts/download_ohlc_history.py
----------------------------------
Phase 5 — Historical OHLC download into unified store.

Usage:
    python Scripts/download_ohlc_history.py --month 2026-04
    python Scripts/download_ohlc_history.py --month 2026-03
    python Scripts/download_ohlc_history.py --month 2026-02

Downloads 1-min OHLC for every (symbol, date) pair found in trades_1.json
for the given month. Also downloads NIFTY + BANKNIFTY for each trade date
(index context). Skips pairs already complete in the unified store.

Order:
    Run April first → check data → then March → check → then February.
    Delete old Historical_OHLC/ only after user approves each month.
"""
import sys
import os
import time
import json
import argparse
from collections import defaultdict

# ── Project root on path ──────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import services.ohlc_service as ohlc
from processors.data_processors import get_user_data_file

DELAY = 0.65   # seconds between API calls (rate limit guard)
INDEX_CONTEXT = ['NIFTY', 'BANKNIFTY']   # always download alongside options


def collect_tasks(month: str) -> list:
    """Return sorted list of (symbol, date) pairs for the given month."""
    tasks: set = set()

    # From trades
    data_file = get_user_data_file(1)
    with open(data_file, encoding='utf-8') as f:
        trades = json.load(f).get('trades', [])

    trade_dates_in_month: set = set()
    for t in trades:
        d = (t.get('trade_date') or t.get('date', ''))[:10]
        if not d.startswith(month):
            continue
        inst = t.get('Instrument', '').strip().upper()
        if inst:
            tasks.add((inst, d))
        trade_dates_in_month.add(d)

    # Index context for every trade date
    for d in trade_dates_in_month:
        for sym in INDEX_CONTEXT:
            tasks.add((sym, d))

    # Watchlist symbols for every trade date
    for sym in ohlc.load_watchlist():
        for d in trade_dates_in_month:
            tasks.add((sym.upper(), d))

    return sorted(tasks, key=lambda x: (x[1], x[0]))


def run(month: str, force: bool = False):
    print(f"\n{'='*60}")
    print(f"  OHLC History Download — {month}")
    print(f"{'='*60}")

    tasks = collect_tasks(month)
    if not tasks:
        print(f"  No trades found for {month}. Exiting.")
        return

    total   = len(tasks)
    already = sum(1 for sym, d in tasks if ohlc.is_complete(sym, d))
    todo    = total - already

    print(f"  Total pairs : {total}")
    print(f"  Already done: {already}")
    print(f"  To download : {todo}")

    if todo == 0:
        print("  All data already present. Nothing to do.")
        return

    print(f"\n  Starting download (0.65s delay between calls)...\n")

    ok = skipped = failed = 0
    for i, (sym, d) in enumerate(tasks, 1):
        prefix = f"  [{i:3}/{total}] {sym:30s} {d}"

        if not force and ohlc.is_complete(sym, d):
            print(f"{prefix}  SKIP (complete)")
            skipped += 1
            continue

        try:
            df = ohlc.download(sym, d, force=force)
            if df is not None and not df.empty:
                print(f"{prefix}  OK  ({len(df)} candles)")
                ok += 1
            else:
                print(f"{prefix}  FAIL (empty response)")
                failed += 1
        except Exception as e:
            print(f"{prefix}  FAIL ({e})")
            failed += 1

        time.sleep(DELAY)

    print(f"\n{'='*60}")
    print(f"  Done — OK={ok}  Skipped={skipped}  Failed={failed}")
    print(f"  Data saved to: data/ohlc/")
    print(f"\n  Next step: open app and verify data looks correct,")
    print(f"  then run the next month or delete old Historical_OHLC/ data.")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download historical OHLC data')
    parser.add_argument('--month', required=True,
                        help='Month to download, e.g. 2026-04')
    parser.add_argument('--force', action='store_true',
                        help='Re-download even if already complete')
    args = parser.parse_args()

    if len(args.month) != 7 or args.month[4] != '-':
        print("ERROR: --month must be in YYYY-MM format (e.g. 2026-04)")
        sys.exit(1)

    run(args.month, force=args.force)
