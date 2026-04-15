
import os
import json
from datetime import datetime
from services.auto_sync_service import add_to_sync, trigger_sync_now

TRADES_PATH = "data/trades_1.json"
today = "2026-04-15"

if os.path.exists(TRADES_PATH):
    with open(TRADES_PATH, 'r') as f:
        trades = json.load(f).get('trades', [])
    
    count = 0
    for t in trades:
        # Check for both formats
        dt = t.get('trade_date') or t.get('date')
        if dt == today:
            sym = t.get('Instrument') or t.get('symbol')
            if sym and '^' not in sym and sym.upper() != 'INDEX':
                add_to_sync(sym, today)
                count += 1
    
    print(f"Force-added {count} instruments for {today} to sync queue.")
    trigger_sync_now()
else:
    print("Error: trades_1.json not found.")
