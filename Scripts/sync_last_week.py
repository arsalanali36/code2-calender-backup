"""
sync_last_week.py
-----------------
Uses the EXACT same service functions as the UI's SYNC button.
This lets us see where the existing system breaks.

Run: python Scripts/sync_last_week.py
"""
import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.dhan_service_core import get_config

config = get_config()
if not config:
    print("ERROR: No Dhan credentials found. Save them via the app UI first.")
    sys.exit(1)
print(f"Using credentials for client_id={config.get('client_id')} (saved {config.get('saved_at')})\n")

# --- Find all trades in last 7 days ---
from datetime import date as _date
today    = _date.today()
week_ago = today - timedelta(days=7)

TRADES_PATH = "data/trades_1.json"
with open(TRADES_PATH, encoding='utf-8') as f:
    trades = json.load(f).get('trades', [])

tasks = {}   # { (sym, date): True }
for t in trades:
    d   = t.get('trade_date', t.get('date', ''))[:10]
    sym = t.get('Instrument', '').strip()
    if d >= str(week_ago) and sym and sym.upper() != 'INDEX' and '^' not in sym:
        tasks[(sym, d)] = True

# Trading days in last 7 calendar days (for Nifty index)
trading_days = []
for i in range(7, -1, -1):
    day = today - timedelta(days=i)
    if day.weekday() < 5:
        trading_days.append(str(day))

print(f"📅 Trading days to sync: {trading_days}")
print(f"📋 Option instruments to sync: {len(tasks)}\n")
print("=" * 70)

# ─────────────────────────────────────────────────────────────────
# STEP 1: Nifty Index — same path as UI (sync_single_task with NSEI)
# ─────────────────────────────────────────────────────────────────
print("\n[1/2] NIFTY INDEX (1-min OHLC)")
print("-" * 50)

from services.dhan_service import sync_single_task

nifty_results = []
for day in trading_days:
    print(f"  Syncing {day} ...", end=" ", flush=True)
    try:
        res = sync_single_task("Nifty 50 (^NSEI)", day, config=config)
        status = res.get('status', '?')
        synced = res.get('synced', 0)
        errors = res.get('errors', 0)
        print(f"✅ status={status} synced={synced} errors={errors}")
        nifty_results.append({'date': day, 'ok': status == 'success', 'detail': res})
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        nifty_results.append({'date': day, 'ok': False, 'detail': str(e)})

# ─────────────────────────────────────────────────────────────────
# STEP 2: Options — same path as UI (sync_single_task per symbol)
# ─────────────────────────────────────────────────────────────────
print(f"\n[2/2] OPTION INSTRUMENTS ({len(tasks)} symbol-date pairs)")
print("-" * 50)

opt_results = []
for (sym, trade_date) in sorted(tasks.keys()):
    print(f"  {trade_date} | {sym} ...", end=" ", flush=True)
    try:
        res = sync_single_task(sym, trade_date, config=config)
        status = res.get('status', '?')
        synced = res.get('synced', 0)
        errors = res.get('errors', 0)
        day_results = res.get('day_results', [])
        # Show per-day breakdown
        days_str = " ".join(
            f"{r['date']}={'OK' if r['status']=='OK' else r['status']}"
            for r in day_results
        )
        print(f"✅ {days_str}")
        opt_results.append({'sym': sym, 'date': trade_date, 'ok': status == 'success', 'detail': res})
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        opt_results.append({'sym': sym, 'date': trade_date, 'ok': False, 'detail': str(e)})

# ─────────────────────────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("FINAL REPORT")
print("=" * 70)

nifty_ok  = sum(1 for r in nifty_results if r['ok'])
nifty_bad = [r for r in nifty_results if not r['ok']]
print(f"\nNIFTY INDEX:  {nifty_ok}/{len(nifty_results)} days OK")
for r in nifty_bad:
    print(f"  ❌ {r['date']}: {r['detail']}")

opt_ok  = sum(1 for r in opt_results if r['ok'])
opt_bad = [r for r in opt_results if not r['ok']]
print(f"\nOPTIONS:      {opt_ok}/{len(opt_results)} symbol-dates OK")
for r in opt_bad:
    print(f"  ❌ {r['date']} {r['sym']}: {r['detail']}")

# Check what CSV files now exist
print("\n📁 CSV files in Options folder:")
opts_dir = "data/Historical_OHLC/Options"
if os.path.exists(opts_dir):
    csv_files = [f for f in os.listdir(opts_dir) if f.endswith('.csv') and '_' not in f]
    for f in sorted(csv_files):
        size = os.path.getsize(os.path.join(opts_dir, f))
        print(f"  {f}  ({size:,} bytes)")
else:
    print("  Folder does not exist!")

nifty_csv = "data/Historical_OHLC/nifty_1m_dhan.csv"
if os.path.exists(nifty_csv):
    size = os.path.getsize(nifty_csv)
    print(f"\n📁 nifty_1m_dhan.csv: {size:,} bytes")
else:
    print("\n❌ nifty_1m_dhan.csv MISSING")

print("\nDone.")
