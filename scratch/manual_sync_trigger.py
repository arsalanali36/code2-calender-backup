import os
import sys
import json
from datetime import datetime

# Add project root to sys.path
project_root = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER"
sys.path.append(project_root)

from services.dhan_service import sync_single_task

def manual_sync():
    cid = "1101310976"
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MjcxODQwLCJpYXQiOjE3NzYxODU0NDAsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.YVfgNt3QDWQqXaXsaHnFA6raDgD_-Uyba1dnQ7wIIw7nCNRIH_rsKkHU_xzqLohoTAJ_GlFNVzIQA4FbsuTrSw"
    
    config = {
        'client_id': cid,
        'access_token': token
    }
    
    instrument = "NIFTY2641323600CE" # Based on the image
    trade_date = "2026-04-13" # Monday
    
    print(f"Starting Manual Sync for {instrument}...")
    res = sync_single_task(instrument, trade_date, config=config)
    print("Sync Result:", json.dumps(res, indent=2))

if __name__ == "__main__":
    manual_sync()
