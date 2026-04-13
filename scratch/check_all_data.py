import json
import os

def check_file(filename):
    if os.path.exists(filename):
        with open(filename, encoding='utf-8') as f:
            data = json.load(f)
        trades = data.get('trades', [])
        day_data = data.get('dayData', {})
        
        april_days = [d for d in day_data.keys() if d.startswith('2026-04')]
        print(f"File: {filename}")
        print(f"  April Days: {april_days}")
        if '2026-04-10' in day_data:
            print("  2026-04-10 FOUND!")
    else:
        print(f"{filename} not found!")

check_file('data/trades.json')
check_file('data/trades_1.json')
check_file('data/trades_2.json')
check_file('data/trades_3.json')
check_file('data/.tmp_api_trades.json')
