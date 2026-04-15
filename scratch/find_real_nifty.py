
import requests
import json
from services.dhan_service_core import get_config

config = get_config()
today = "2026-04-15"
token = config['access_token']
headers = {"Content-Type": "application/json", "access-token": token}
url = "https://api.dhan.co/charts/intraday"

test_ids = ["1", "13", "52", "2", "3"] # Common IDs for Nifty 50

for sid in test_ids:
    payload = {"securityId": sid, "exchangeSegment": "IDX_I", "instrument": "INDEX", "fromDate": today, "toDate": today}
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=5)
        if r.status_code == 200:
            data = r.json()
            if 'open' in data and data['open']:
                price = data['open'][-1]
                print(f"ID: {sid} | Current Price: {price}")
        else:
            print(f"ID: {sid} | Failed: {r.status_code}")
    except Exception as e:
        print(f"ID: {sid} | Error: {e}")
