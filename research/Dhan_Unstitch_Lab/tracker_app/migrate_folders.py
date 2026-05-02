"""
Migrate existing Premium folders from flat structure to expiry-day organized structure.

Before: Premium/NIFTY/04 - Apr/NIFTY_28_APR_24150_PUT/
After:  Premium/NIFTY/04 - Apr/28 Apr/NIFTY_28_APR_24150_PUT/
"""
import os
import re
import shutil

DOWNLOADS_DIR = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\Downloaded_Data'
PREMIUM_DIR = os.path.join(DOWNLOADS_DIR, 'Premium')

def migrate():
    moved = 0
    skipped = 0

    for underlying in os.listdir(PREMIUM_DIR):
        underlying_path = os.path.join(PREMIUM_DIR, underlying)
        if not os.path.isdir(underlying_path):
            continue

        for month_folder in os.listdir(underlying_path):
            month_path = os.path.join(underlying_path, month_folder)
            if not os.path.isdir(month_path):
                continue
            # Only process folders like "04 - Apr"
            if not re.match(r'^\d{2} - [A-Z][a-z]{2}$', month_folder):
                continue

            for item in list(os.listdir(month_path)):
                item_path = os.path.join(month_path, item)
                if not os.path.isdir(item_path):
                    continue
                # Skip if already a day-subfolder like "28 Apr"
                if re.match(r'^\d{2} [A-Z][a-z]{2}$', item):
                    continue
                # Extract day from instrument folder name e.g. NIFTY_28_APR_24150_PUT -> 28, Apr
                m = re.search(r'^[A-Z]+_(\d{2})_([A-Z]{3})_', item)
                if not m:
                    print(f"  SKIP (can't parse day): {item}")
                    skipped += 1
                    continue

                day = m.group(1)          # "28"
                mon = m.group(2).capitalize()  # "Apr"
                day_folder_name = f"{day} {mon}"  # "28 Apr"
                new_parent = os.path.join(month_path, day_folder_name)
                os.makedirs(new_parent, exist_ok=True)
                new_path = os.path.join(new_parent, item)

                print(f"  MOVE: {month_folder}/{item}  ->  {month_folder}/{day_folder_name}/{item}")
                shutil.move(item_path, new_path)
                moved += 1

    print(f"\nDone! Moved: {moved}, Skipped: {skipped}")

if __name__ == '__main__':
    print(f"Scanning: {PREMIUM_DIR}\n")
    migrate()
