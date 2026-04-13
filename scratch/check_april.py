import json
import os

trades_file = 'data/trades.json'
if os.path.exists(trades_file):
    with open(trades_file, encoding='utf-8') as f:
        data = json.load(f)
    trades = data.get('trades', [])
    day_data = data.get('dayData', {})
    
    april_trades = [t for t in trades if t.get('date', '').startswith('2026-04')]
    april_days = [d for d in day_data.keys() if d.startswith('2026-04')]
    
    print(f"Total Trades: {len(trades)}")
    print(f"April Trades: {len(april_trades)}")
    print(f"April Days in dayData: {april_days}")
    
    if '2026-04-10' in day_data:
        print("2026-04-10 FOUND in dayData!")
    else:
        print("2026-04-10 NOT found in dayData.")
else:
    print("trades.json not found!")
