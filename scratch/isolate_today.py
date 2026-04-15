
import os
import json

PENDING_FILE = "data/pending_syncs.json"
BACKLOG_FILE = "data/backlog_syncs.json"
TRADES_FILE = "data/trades_1.json"
today = "2026-04-15"

# 1. Backup current pending to backlog
if os.path.exists(PENDING_FILE):
    with open(PENDING_FILE, 'r') as f:
        current_pending = json.load(f)
    
    # Merge with existing backlog if any
    if os.path.exists(BACKLOG_FILE):
        with open(BACKLOG_FILE, 'r') as f:
            backlog = json.load(f)
    else:
        backlog = {}
    
    for inst, dates in current_pending.items():
        if inst not in backlog: backlog[inst] = []
        for d in dates:
            if d not in backlog[inst]: backlog[inst].append(d)
    
    with open(BACKLOG_FILE, 'w') as f:
        json.dump(backlog, f, indent=2)

# 2. Extract ONLY Today's trades from trades_1.json
today_pending = {}
if os.path.exists(TRADES_FILE):
    with open(TRADES_FILE, 'r') as f:
        trades = json.load(f).get('trades', [])
    
    for t in trades:
        dt = t.get('trade_date') or t.get('date')
        if dt == today:
            sym = t.get('Instrument') or t.get('symbol')
            if sym and '^' not in sym and sym.upper() != 'INDEX':
                if sym not in today_pending: today_pending[sym] = []
                if today not in today_pending[sym]: today_pending[sym].append(today)

# 3. Overwrite pending_syncs.json with ONLY today
with open(PENDING_FILE, 'w') as f:
    json.dump(today_pending, f, indent=2)

print(f"Backlog moved to {BACKLOG_FILE}. Only {len(today_pending)} items for {today} in queue.")
