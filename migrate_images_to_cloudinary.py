"""
migrate_images_to_cloudinary.py
--------------------------------
ONE-TIME script: Upload all local static/uploads images to Cloudinary
and update any references in data/trades.json from /uploads/<file> to
the Cloudinary secure URL.

Run once after setting up Cloudinary:
    python migrate_images_to_cloudinary.py
"""

import os
import json
import time
import cloudinary
import cloudinary.uploader

# ── Config ────────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

cloudinary.config(
    cloud_name = 'duw7qd8zm',
    api_key    = '193793224698897',
    api_secret = 'MWzWfda4trpWuFJOPgb2A64QfcU'
)

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR   = os.path.join(BASE_DIR, 'static', 'uploads')
DATA_FILE     = os.path.join(BASE_DIR, 'data', 'trades.json')
MAPPING_FILE  = os.path.join(BASE_DIR, 'data', 'cloudinary_migration_map.json')

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

# ── Load existing mapping (to resume if interrupted) ──────────────────────────
if os.path.exists(MAPPING_FILE):
    with open(MAPPING_FILE) as f:
        url_map = json.load(f)
    print(f"[resume] Found existing mapping with {len(url_map)} entries")
else:
    url_map = {}

# ── Find all local images ─────────────────────────────────────────────────────
all_files = [
    f for f in os.listdir(UPLOADS_DIR)
    if os.path.isfile(os.path.join(UPLOADS_DIR, f))
    and os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    and not f.startswith('_')
]

print(f"\n{'='*60}")
print(f"  Found {len(all_files)} local images to migrate")
print(f"  Already uploaded: {len(url_map)}")
print(f"  Remaining: {len(all_files) - len(url_map)}")
print(f"{'='*60}\n")

# ── Upload each image ─────────────────────────────────────────────────────────
success_count = 0
fail_count    = 0
skip_count    = 0

for idx, filename in enumerate(all_files, 1):
    local_url = f'/uploads/{filename}'

    # Skip if already uploaded
    if local_url in url_map:
        skip_count += 1
        continue

    filepath = os.path.join(UPLOADS_DIR, filename)
    name_no_ext = os.path.splitext(filename)[0]
    public_id   = f'trading_journal/{name_no_ext}'

    try:
        result = cloudinary.uploader.upload(
            filepath,
            public_id=public_id,
            resource_type='image',
            overwrite=False,
        )
        cloud_url = result['secure_url']
        url_map[local_url] = cloud_url
        success_count += 1
        print(f"[{idx:3}/{len(all_files)}] ✅ {filename[:40]:<40} → uploaded")

        # Save mapping every 10 uploads (safe resume point)
        if success_count % 10 == 0:
            with open(MAPPING_FILE, 'w') as f:
                json.dump(url_map, f, indent=2)

        # Small delay to avoid rate limits
        time.sleep(0.3)

    except Exception as e:
        fail_count += 1
        print(f"[{idx:3}/{len(all_files)}] ❌ {filename[:40]:<40} → FAILED: {e}")

# ── Save final mapping ────────────────────────────────────────────────────────
with open(MAPPING_FILE, 'w') as f:
    json.dump(url_map, f, indent=2)

print(f"\n{'='*60}")
print(f"  Upload complete!")
print(f"  ✅ Uploaded : {success_count}")
print(f"  ⏭️  Skipped  : {skip_count}")
print(f"  ❌ Failed   : {fail_count}")
print(f"{'='*60}\n")

# ── Update trades.json ────────────────────────────────────────────────────────
if not os.path.exists(DATA_FILE):
    print("⚠️  trades.json not found — skipping JSON update")
else:
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        raw = f.read()

    updated_raw = raw
    replaced_count = 0
    for local_url, cloud_url in url_map.items():
        if local_url in updated_raw:
            updated_raw = updated_raw.replace(local_url, cloud_url)
            replaced_count += 1

    if replaced_count > 0:
        # Backup original
        backup_path = DATA_FILE + '.backup_before_migration'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(raw)
        print(f"📦 Backup saved: {backup_path}")

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            f.write(updated_raw)
        print(f"✅ trades.json updated — {replaced_count} URLs replaced with Cloudinary URLs")
    else:
        print("ℹ️  No /uploads/ URLs found in trades.json (already updated or no images referenced)")

print("\n🎉 Migration complete! Check data/cloudinary_migration_map.json for the full URL mapping.")
