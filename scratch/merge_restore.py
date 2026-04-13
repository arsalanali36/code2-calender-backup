import json
import os

# Files
old_backup = 'data/backups/trades_backup_user_1_20260411_212414.json'
current_file = 'data/trades_1.json'
output_file = 'data/trades_1.json' # Overwrite current with merged

with open(old_backup, 'r', encoding='utf-8') as f:
    old_data = json.load(f)

with open(current_file, 'r', encoding='utf-8') as f:
    curr_data = json.load(f)

# 1. Merge Trades
# Use a set of unique keys to avoid duplicates
# Key: date + instrument + side + entry_time
def get_key(t):
    return (t.get('date', '') + '|' + 
            str(t.get('Instrument', t.get('instrument', ''))) + '|' + 
            str(t.get('TradeType', t.get('tradetype', ''))) + '|' + 
            str(t.get('Buy Time', t.get('entry_time', ''))))

existing_keys = set()
merged_trades = []

# Order matters: maybe take current ones first? 
# Usually, we want the most recent data if there's a conflict.
for t in curr_data.get('trades', []):
    merged_trades.append(t)
    existing_keys.add(get_key(t))

added_count = 0
for t in old_data.get('trades', []):
    k = get_key(t)
    if k not in existing_keys:
        merged_trades.append(t)
        existing_keys.add(k)
        added_count += 1

# 2. Merge dayData
merged_day_data = old_data.get('dayData', {}).copy()
# Current data overrides old if same date exists (assuming current is better or more recent edits)
# But for 10th, it will come from old since it's missing in current.
for d, dval in curr_data.get('dayData', {}).items():
    merged_day_data[d] = dval

# 3. Merge other top-level keys if needed (like imgTypes, tagGroups)
for k in ['imgTypes', 'tagGroups', 'importedPdfs']:
    if k in curr_data:
        merged_day_data_obj = old_data.get(k, {}).copy() if isinstance(old_data.get(k), dict) else []
        if isinstance(merged_day_data_obj, dict):
            merged_day_data_obj.update(curr_data[k])
        else:
            merged_day_data_obj = curr_data[k] # Fallback to current for lists
        curr_data[k] = merged_day_data_obj

curr_data['trades'] = merged_trades
curr_data['dayData'] = merged_day_data

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(curr_data, f, indent=2, ensure_ascii=False)

print(f"Successfully merged data!")
print(f"Added {added_count} missing trades.")
print(f"Final trade count: {len(merged_trades)}")
print(f"Final dayData days: {len(merged_day_data)}")
if '2026-04-10' in merged_day_data:
    print("2026-04-10 IS NOW BACK!")
else:
    print("ERROR: 2026-04-10 STILL MISSING!")
