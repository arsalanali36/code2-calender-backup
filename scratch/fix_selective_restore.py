import json
import os

# Files
old_backup = 'data/backups/trades_backup_user_1_20260411_212414.json'
# We use the clean backup (before my bad merge) as the base
clean_base = 'data/trades_1.json.pre_merge_backup' 
output_file = 'data/trades_1.json'

with open(old_backup, 'r', encoding='utf-8') as f:
    old_data = json.load(f)

with open(clean_base, 'r', encoding='utf-8') as f:
    curr_data = json.load(f)

target_date = '2026-04-10'

# 1. Restore only 10th April trades
existing_trades = curr_data.get('trades', [])
def get_key(t):
    return (t.get('date', '') + '|' + 
            str(t.get('Instrument', t.get('instrument', ''))) + '|' + 
            str(t.get('TradeType', t.get('tradetype', ''))) + '|' + 
            str(t.get('Buy Time', t.get('entry_time', ''))))

existing_keys = {get_key(t) for t in existing_trades}

added_t = 0
for t in old_data.get('trades', []):
    if t.get('date') == target_date:
        k = get_key(t)
        if k not in existing_keys:
            existing_trades.append(t)
            added_t += 1

# 2. Restore only 10th April dayData
if target_date in old_data.get('dayData', {}):
    curr_data.get('dayData', {})[target_date] = old_data['dayData'][target_date]
    print(f"Restored dayData for {target_date}")

# 3. Restore only 10th April markers (navPositions) 
# Already included in dayData above.

curr_data['trades'] = existing_trades

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(curr_data, f, indent=2, ensure_ascii=False)

print(f"Surgery complete! Restored ONLY {target_date}.")
print(f"Added {added_t} trades for that date.")
