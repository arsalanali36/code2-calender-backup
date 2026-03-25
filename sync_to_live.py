"""
sync_to_live.py — Push local trades + images to live Render server.
Usage: python sync_to_live.py
"""
import os, io, zipfile, requests

LIVE_URL  = "https://code2-calender.onrender.com"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))
TRADES    = os.path.join(LOCAL_DIR, "data", "trades.json")
UPLOADS   = os.path.join(LOCAL_DIR, "static", "uploads")

print("Building ZIP...")
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.write(TRADES, "trades.json")
    img_count = 0
    for root, dirs, files in os.walk(UPLOADS):
        dirs[:] = [d for d in dirs if d != "_trash"]
        for fname in files:
            fpath = os.path.join(root, fname)
            arcname = os.path.relpath(fpath, LOCAL_DIR).replace("\\", "/")
            zf.write(fpath, arcname)
            img_count += 1

print(f"ZIP ready — {img_count} images + trades.json")

buf.seek(0)
zip_size_mb = buf.getbuffer().nbytes / 1024 / 1024
print(f"ZIP size: {zip_size_mb:.1f} MB")
print(f"Pushing to {LIVE_URL} ...")

resp = requests.post(
    f"{LIVE_URL}/api/import-json",
    files={"file": ("backup.zip", buf, "application/zip")},
    timeout=300
)

if resp.ok:
    data = resp.json()
    print("SUCCESS:", data)
else:
    print(f"ERROR {resp.status_code}:", resp.text[:300])
