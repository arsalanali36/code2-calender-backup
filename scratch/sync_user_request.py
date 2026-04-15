
import json
import os
import sys

os.environ['FLASK_DEBUG'] = 'true'

# Add the project root to sys.path
BASE_DIR = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER"
sys.path.append(BASE_DIR)

from services.dhan_service_core import save_config
from services.dhan_service import sync_single_task

client_id = "1101310976"
access_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MjcxODQwLCJpYXQiOjE3NzYxODU0NDAsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.YVfgNt3QDWQqXaXsaHnFA6raDgD_-Uyba1dnQ7wIIw7nCNRIH_rsKkHU_xzqLohoTAJ_GlFNVzIQA4FbsuTrSw"

print(f"Updating config for Client ID: {client_id}")
save_config(client_id, access_token)

symbol = "NIFTY2641323750CE"
trade_date = "2026-04-13"

print(f"Starting sync for {symbol} on {trade_date}...")
result = sync_single_task(symbol, trade_date)

print("Result:")
print(json.dumps(result, indent=2))
