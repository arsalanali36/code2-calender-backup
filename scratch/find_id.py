
import requests
import json
import time

token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc2MjcxODQwLCJpYXQiOjE3NzYxODU0NDAsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.YVfgNt3QDWQqXaXsaHnFA6raDgD_-Uyba1dnQ7wIIw7nCNRIH_rsKkHU_xzqLohoTAJ_GlFNVzIQA4FbsuTrSw"
url = "https://api.dhan.co/v2/charts/historical"
headers = {
    "access-token": token,
    "Content-Type": "application/json"
}

# April 21 has ID 63406 (approx)
# April 13 should be less.
# Let's try 62800 to 63000
for sid in range(62850, 63001):
    payload = {
        "securityId": str(sid),
        "exchangeSegment": "NSE_FNO",
        "instrument": "OPTIDX",
        "expiryCode": 1,
        "interval": 1,
        "fromDate": "2026-04-09",
        "toDate": "2026-04-10"
    }
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if 'close' in data and data['close']:
                p_0915 = data['close'][0]
                # TV shows open/low around 230-240 at 09:15 on April 9
                if 220 < p_0915 < 250:
                    print(f"MATCH FOUND? ID: {sid}, Price at 09:15: {p_0915}")
    except: pass
    time.sleep(0.05) # Avoid spamming
