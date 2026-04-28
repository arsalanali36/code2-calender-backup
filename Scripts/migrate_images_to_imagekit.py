"""
migrate_images_to_imagekit.py
------------------------------
Uploads all local /uploads/ images to ImageKit and updates trades_1.json URLs.
Run once from project root:
    python Scripts/migrate_images_to_imagekit.py
"""
import json
import os
import re
import sys
import io

IMAGEKIT_PRIVATE_KEY  = "private_QTnWn//AAVFGCCe3y3sY9upzX34="
IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/j3yawq0sst"

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRADES_FILE  = os.path.join(BASE_DIR, "data", "trades_1.json")
UPLOADS_DIR  = os.path.join(BASE_DIR, "static", "uploads")
BACKUP_FILE  = TRADES_FILE + ".bak"


def get_ik():
    from imagekitio import ImageKit
    return ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)


def upload_file(ik, filepath, fname):
    with open(filepath, "rb") as f:
        data = f.read()
    result = ik.files.upload(
        file=io.BytesIO(data),
        file_name=fname,
        folder="/trading_journal/",
        use_unique_file_name=False,
    )
    return f"{IMAGEKIT_URL_ENDPOINT}/trading_journal/{result.name}"


def main():
    sys.path.insert(0, BASE_DIR)

    print("Loading trades_1.json ...")
    with open(TRADES_FILE, encoding="utf-8") as f:
        data = json.load(f)

    # Backup
    with open(BACKUP_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"Backup saved: {BACKUP_FILE}")

    # Collect all /uploads/ URLs from entire JSON
    raw = json.dumps(data)
    local_urls = sorted(set(re.findall(r'/uploads/[^\"\s,\]]+', raw)))
    local_urls = [u for u in local_urls if not u.startswith('/uploads/_trash')]
    print(f"Found {len(local_urls)} unique local image URLs")

    ik = get_ik()
    url_map = {}   # old_url -> new_imagekit_url
    failed  = []

    for i, url in enumerate(local_urls, 1):
        # url like /uploads/filename.png or /uploads/tag_images/x.png
        rel_path = url.lstrip('/')   # uploads/filename.png
        filepath = os.path.join(BASE_DIR, "static", rel_path)

        if not os.path.exists(filepath):
            print(f"  [{i}/{len(local_urls)}] SKIP (not found locally): {url}")
            continue

        fname = os.path.basename(filepath)
        try:
            new_url = upload_file(ik, filepath, fname)
            url_map[url] = new_url
            print(f"  [{i}/{len(local_urls)}] OK: {fname} → {new_url[:60]}...")
        except Exception as e:
            print(f"  [{i}/{len(local_urls)}] FAIL: {fname} — {e}")
            failed.append(url)

    print(f"\nUploaded: {len(url_map)}  |  Failed: {len(failed)}")

    if not url_map:
        print("Nothing to update.")
        return

    # Replace all URLs in JSON string
    updated_raw = raw
    for old, new in url_map.items():
        updated_raw = updated_raw.replace(f'"{old}"', f'"{new}"')

    updated_data = json.loads(updated_raw)
    with open(TRADES_FILE, "w", encoding="utf-8") as f:
        json.dump(updated_data, f, ensure_ascii=False, indent=2)

    print(f"\ntrades_1.json updated with {len(url_map)} new ImageKit URLs.")
    if failed:
        print(f"These {len(failed)} URLs were NOT migrated: {failed[:5]}")


if __name__ == "__main__":
    main()
