import sys
import os
sys.path.append(r"C:\Users\arsal\Desktop\New folder (2)\TEMP\tracker_app")
import app

tasks = app.load_tradebook_tasks()
target_task = None
for t in tasks:
    if t['html_id'] == 'BANKNIFTY26APR56400PE':
        target_task = t
        break

if target_task:
    print("Running downloader for BANKNIFTY26APR56400PE...")
    success, url = app.run_downloader(target_task, "2026-04-01", "2026-04-30")
    print(f"Success: {success}, URL: {url}")
else:
    print("Task not found")
