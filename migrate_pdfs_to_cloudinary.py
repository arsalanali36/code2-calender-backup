"""
migrate_pdfs_to_cloudinary.py
------------------------------
ONE-TIME script: Upload all local static/uploads/pdfs/ files to Cloudinary
and write metadata to data/pdfs.json so the app can list/open them.

Run once:
    python migrate_pdfs_to_cloudinary.py

Safe to re-run — already-uploaded PDFs are skipped (checked via pdfs.json).
"""

import os
import json
import time
import cloudinary
import cloudinary.uploader

# ── Config ────────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

from config import PDF_DIR, PDF_META_FILE

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME', 'duw7qd8zm'),
    api_key=os.getenv('CLOUDINARY_API_KEY', '193793224698897'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET', 'MWzWfda4trpWuFJOPgb2A64QfcU'),
)

# ── Load existing pdfs.json (to resume if interrupted) ────────────────────────
if os.path.exists(PDF_META_FILE):
    with open(PDF_META_FILE, 'r', encoding='utf-8') as f:
        existing_records = json.load(f)
    already_done = {r['name'] for r in existing_records}
    print(f"[resume] pdfs.json has {len(existing_records)} existing entries")
else:
    existing_records = []
    already_done = set()

# ── Find local PDFs ───────────────────────────────────────────────────────────
if not os.path.isdir(PDF_DIR):
    print(f"PDF_DIR not found: {PDF_DIR}")
    exit(1)

all_files = [
    f for f in os.listdir(PDF_DIR)
    if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(PDF_DIR, f))
]

# Derive display name (strip uuid_ prefix)
def display_name(fname):
    parts = fname.split('_', 1)
    return parts[1] if len(parts) == 2 else fname

print(f"\n{'='*60}")
print(f"  Found {len(all_files)} local PDFs in {PDF_DIR}")
print(f"  Already in pdfs.json: {len(existing_records)}")
remaining = [f for f in all_files if display_name(f) not in already_done]
print(f"  To upload: {len(remaining)}")
print(f"{'='*60}\n")

# ── Upload each PDF ───────────────────────────────────────────────────────────
success = 0
failed  = 0
skipped = 0
new_records = []

for idx, fname in enumerate(all_files, 1):
    dname = display_name(fname)

    if dname in already_done:
        skipped += 1
        print(f"[{idx:2}/{len(all_files)}] SKIP  {dname[:55]}")
        continue

    fpath = os.path.join(PDF_DIR, fname)
    public_id = f'trading_journal/pdfs/{os.path.splitext(fname)[0]}'

    try:
        result = cloudinary.uploader.upload(
            fpath,
            public_id=public_id,
            resource_type='raw',
            overwrite=False,
        )
        record = {
            'filename':  result.get('public_id', public_id),
            'name':      dname,
            'url':       result.get('secure_url', ''),
            'size':      result.get('bytes', os.path.getsize(fpath)),
            'timestamp': int(time.time() * 1000),
        }
        new_records.append(record)
        already_done.add(dname)
        success += 1
        print(f"[{idx:2}/{len(all_files)}] OK    {dname[:55]}")
        time.sleep(0.3)

    except Exception as e:
        failed += 1
        print(f"[{idx:2}/{len(all_files)}] FAIL  {dname[:55]} -- {e}")

# ── Save updated pdfs.json ────────────────────────────────────────────────────
if new_records:
    all_records = new_records + existing_records   # newest first
    os.makedirs(os.path.dirname(PDF_META_FILE), exist_ok=True)
    with open(PDF_META_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=2)
    print(f"\ndata/pdfs.json updated -- {len(all_records)} total PDFs")
else:
    print("\nNothing new to write to pdfs.json")

print(f"\n{'='*60}")
print(f"  Uploaded : {success}")
print(f"  Skipped  : {skipped}")
print(f"  Failed   : {failed}")
print(f"{'='*60}")
print("\nDone! Push data/pdfs.json to git -- live pe PDFs dikhengi.")
