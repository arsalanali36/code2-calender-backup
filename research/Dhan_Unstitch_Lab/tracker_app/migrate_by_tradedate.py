"""
Migrate Premium instrument folders to be organized by TRADE DATE.

New structure:
  Premium/NIFTY/2026-04-24/NIFTY_28_APR_23900_PUT/  (4 csv files)
  Premium/NIFTY/2026-04-24/NIFTY_28_APR_24000_PUT/  (1 csv file)
  Premium/NIFTY/2026-04-28/NIFTY_28_APR_24150_PUT/  (6 csv files)
"""
import os, re, glob, shutil, datetime
import pandas as pd

DOWNLOADS_DIR = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\Downloaded_Data'
TRADEBOOK    = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\tracker_app\uploads\tradebook.csv'
PREMIUM_DIR  = os.path.join(DOWNLOADS_DIR, 'Premium')

# ── Build symbol → (underlying, dhan_folder_name, trade_date) map ──────────
df = pd.read_csv(TRADEBOOK)
df['trade_date'] = pd.to_datetime(df['trade_date'], errors='coerce').dt.strftime('%Y-%m-%d')
unique = df.groupby('symbol').agg({'trade_date': 'min', 'expiry_date': 'first'}).reset_index()

task_map = {}   # dhan_folder -> (underlying, trade_date)

for _, row in unique.iterrows():
    s = str(row['symbol']).strip()
    m = re.search(r'^([A-Z]+)(\d{2})([A-Z0-9]+)(\d{5})([CP][E])$', s)
    if not m:
        continue
    underlying = m.group(1)
    ep         = m.group(3)
    strike     = m.group(4)
    ot         = m.group(5)
    opt_word   = 'CALL' if ot == 'CE' else 'PUT'

    if ep.isdigit():
        mon_d  = int(ep[0])
        day_d  = int(ep[1:])
        mon_s  = datetime.date(2026, mon_d, 1).strftime('%b').upper()
        folder = f'{underlying}_{day_d}_{mon_s}_{strike}_{opt_word}'
    else:
        raw = str(row['expiry_date'])
        ed  = raw if raw and raw != 'nan' else '2026-04-28'
        try:
            ed_day = int(ed.split('-')[2])
        except Exception:
            ed_day = 28
        folder = f'{underlying}_{ed_day}_{ep.upper()}_{strike}_{opt_word}'

    task_map[folder] = (underlying, str(row['trade_date']))

print(f"Parsed {len(task_map)} instruments from tradebook.\n")

# ── Find each instrument folder recursively and move it ────────────────────
moved = 0
skipped = 0

for inst_folder, (underlying, trade_date) in task_map.items():
    pattern = os.path.join(PREMIUM_DIR, underlying, '**', inst_folder)
    results = [d for d in glob.glob(pattern, recursive=True) if os.path.isdir(d)]

    if not results:
        print(f"  NOT FOUND: {inst_folder}")
        skipped += 1
        continue

    src = results[0]

    # Already in the right place?
    expected_parent = os.path.join(PREMIUM_DIR, underlying, trade_date)
    expected_dst    = os.path.join(expected_parent, inst_folder)
    if src == expected_dst:
        print(f"  OK (already correct): {inst_folder}")
        continue

    os.makedirs(expected_parent, exist_ok=True)
    print(f"  MOVE: ...{os.sep}{os.path.relpath(src, PREMIUM_DIR)}")
    print(f"     -> {underlying}{os.sep}{trade_date}{os.sep}{inst_folder}")
    shutil.move(src, expected_dst)
    moved += 1

# ── Clean up empty leftover directories ────────────────────────────────────
for root, dirs, files in os.walk(PREMIUM_DIR, topdown=False):
    if root == PREMIUM_DIR:
        continue
    if not os.listdir(root):
        os.rmdir(root)
        print(f"  REMOVED empty dir: {os.path.relpath(root, PREMIUM_DIR)}")

print(f"\nDone!  Moved: {moved}  |  Not found: {skipped}")
