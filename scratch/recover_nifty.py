
import requests
import json
import pandas as pd
import os
from services.dhan_service_core import get_config
from services.dhan_service import fetch_and_cache_ohlc

config = get_config()
today = "2026-04-15"
token = config['access_token']
headers = {"Content-Type": "application/json", "access-token": token}
url = "https://api.dhan.co/charts/intraday"

# Let's try to find symbols with NIFTY in their name and check their prices
# We'll use the most likely ones for Nifty 50
possible_ids = ["13", "1", "25", "52", "11", "12"]

correct_sid = None
for sid in possible_ids:
    payload = {"securityId": sid, "exchangeSegment": "IDX_I", "instrument": "INDEX", "fromDate": today, "toDate": today}
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=5)
        if r.status_code == 200:
            data = r.json()
            if 'open' in data and data['open']:
                price = data['open'][-1]
                print(f"Prob: {sid} | Price: {price}")
                if price > 23000 and price < 25000:
                    correct_sid = sid
                    print(f"FOUND CORRECT NIFTY ID: {sid}")
                    break
    except: pass

if not correct_sid:
    # If still not found, defaults to 13 but checks if segment should be NSE_EQ?
    # No, usually it is IDX_I. 
    print("Could not automatically find 24k Nifty. Please check Dhan console.")
    exit(1)

# Now fetch the data
print(f"Fetching full day for ID {correct_sid}...")
df_new = fetch_and_cache_ohlc(correct_sid, "IDX_I", "INDEX", today, config=config)

# Clean and store
INDEX_PATH = "data/Historical_OHLC/nifty_1m_dhan.csv"
if os.path.exists(INDEX_PATH):
    df_old = pd.read_csv(INDEX_PATH)
    # Remove all 15 April entries to be safe
    df_old['date'] = pd.to_datetime(df_old['datetime']).dt.strftime('%Y-%m-%d')
    df_old = df_old[df_old['date'] != today]
    df_old = df_old.drop(columns=['date'])
    
    # Concat and save
    df_final = pd.concat([df_old, df_new]).drop_duplicates('datetime').sort_values('datetime')
    df_final.to_csv(INDEX_PATH, index=False)
    print(f"Successfully cleaned and updated {INDEX_PATH}")
else:
    df_new.to_csv(INDEX_PATH, index=False)
