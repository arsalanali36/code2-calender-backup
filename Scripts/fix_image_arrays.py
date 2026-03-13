import json
import os

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'trades.json')

def fix_images():
    if not os.path.exists(DATA_FILE):
        print("Data file not found")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    trades = data.get('trades', [])
    day_data = data.get('dayData', {})

    def collect_images(obj):
        found = set(obj.get('images', []))
        
        # From imageTags
        if 'imageTags' in obj and isinstance(obj['imageTags'], dict):
            for url in obj['imageTags'].keys():
                found.add(url)
        
        # From marqueeBoxes
        if 'marqueeBoxes' in obj and isinstance(obj['marqueeBoxes'], dict):
            for url in obj['marqueeBoxes'].keys():
                found.add(url)

        # From overlays
        if 'overlays' in obj and isinstance(obj['overlays'], dict):
            for url in obj['overlays'].keys():
                found.add(url)
                # Also the overlay itself? Usually overlay is a separate image
                # but it should probably be in the list if we want to see it?
                # Actually overlays is { original_url: overlay_url }
                val = obj['overlays'][url]
                if val: found.add(val)
        
        # From subImages
        if 'subImages' in obj and isinstance(obj['subImages'], dict):
            for parent_url, subs in obj['subImages'].items():
                found.add(parent_url)
                if isinstance(subs, list):
                    for s in subs: found.add(s)

        return sorted(list(found))

    # Fix trades
    fixed_trades_count = 0
    for t in trades:
        old_len = len(t.get('images', []))
        t['images'] = collect_images(t)
        if len(t['images']) > old_len:
            fixed_trades_count += 1

    # Fix dayData
    fixed_day_count = 0
    for date, day in day_data.items():
        old_len = len(day.get('images', []))
        day['images'] = collect_images(day)
        if len(day['images']) > old_len:
            fixed_day_count += 1

    print(f"Fixed {fixed_trades_count} trades and {fixed_day_count} day entries.")

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    fix_images()
