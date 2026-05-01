import requests
import pandas as pd
import json
import datetime
import time

JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3NzIwNTA0LCJpYXQiOjE3Nzc2MzQxMDQsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.9RdINQXCUnMS3Gjcph2ECm6jeNV9so4wVzq8ylwvVlV47B72DQBvwpGwEmQ0zflTV8SJtLtPqMhi0N0OyVePbA"
CLIENT_ID = "1101310976"

headers = {
    'access-token': JWT_TOKEN,
    'client-id': CLIENT_ID,
    'Content-Type': 'application/json'
}

TRADE_DATE = "2026-04-29"
NEXT_DATE = "2026-04-30"  # toDate must be exclusive
TARGET_STRIKE = 24100
STRIKE_STEP = 50

print(f"--- UNSTITCHING PROCESS FOR NIFTY {TARGET_STRIKE} PE ({TRADE_DATE}) ---")

print("1. Fetching Nifty Spot OHLC...")
spot_payload = {
    "securityId": "13",
    "exchangeSegment": "IDX_I",
    "instrument": "INDEX",
    "interval": "1",
    "fromDate": TRADE_DATE,
    "toDate": TRADE_DATE
}
try:
    resp_spot = requests.post("https://api.dhan.co/v2/charts/intraday", headers=headers, json=spot_payload)
    spot_data = resp_spot.json()
except Exception as e:
    print(f"Failed to request spot data: {e}")
    exit()

if not spot_data or 'close' not in spot_data:
    print("Error fetching Spot Data. Check your token or date.")
    exit()

spot_closes = spot_data['close']
start_time = datetime.datetime.strptime(f"{TRADE_DATE} 09:15:00", "%Y-%m-%d %H:%M:%S")
spot_series = {}
for i, c in enumerate(spot_closes):
    t = (start_time + datetime.timedelta(minutes=i)).strftime("%H:%M:%S")
    spot_series[t] = c


print("2. Discovering correct Expiry (WEEK vs MONTH)...")
valid_exp_type = None
valid_exp_code = None

expiry_candidates = [('WEEK', 1), ('WEEK', 2), ('WEEK', 3), ('MONTH', 1), ('MONTH', 2), ('MONTH', 3)]
for exp_type, exp_code in expiry_candidates:
    payload = {
        "securityId": "13", "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1,
        "expiryCode": int(exp_code), "expiryFlag": str(exp_type), "strike": "ATM",
        "drvOptionType": "PUT", "requiredData": ["close"], "fromDate": TRADE_DATE, "toDate": NEXT_DATE
    }
    try:
        r = requests.post('https://api.dhan.co/v2/charts/rollingoption', headers=headers, json=payload)
        if r.status_code == 200:
            data = r.json()
            if data and 'data' in data and 'pe' in data['data'] and 'close' in data['data']['pe']:
                if len(data['data']['pe']['close']) > 0:
                    valid_exp_type = exp_type
                    valid_exp_code = exp_code
                    break
    except: pass
    time.sleep(0.3)

if not valid_exp_type:
    print("Could not find a valid expiry contract for this date.")
    exit()
    
print(f"   -> Using consistent expiry: {valid_exp_type} {valid_exp_code}")

print("3. Fetching Rolling Options Data (ATM-5 to ATM+5)...")
rolling_data = {}

for offset in range(-5, 6):
    strike_str = 'ATM' if offset == 0 else (f'ATM+{offset}' if offset > 0 else f'ATM{offset}')
    print(f"   Fetching {strike_str}...")
    success = False
    
    for attempt in range(5): # retry 5 times
        opt_payload = {
            "securityId": "13", "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1,
            "expiryCode": int(valid_exp_code), "expiryFlag": str(valid_exp_type),
            "strike": str(strike_str), "drvOptionType": "PUT",
            "requiredData": ["open", "high", "low", "close", "volume"],
            "fromDate": TRADE_DATE, "toDate": NEXT_DATE,
        }
        try:
            r = requests.post('https://api.dhan.co/v2/charts/rollingoption', headers=headers, json=opt_payload)
            if r.status_code == 200:
                data = r.json()
                if data and 'data' in data and 'pe' in data['data']:
                    pe_data = data['data']['pe']
                    if 'close' in pe_data and len(pe_data['close']) > 0:
                        rolling_data[offset] = pe_data
                        success = True
                        break
        except Exception as e:
            pass
        time.sleep(0.5)  # Backoff
        
    if not success:
        print(f"   Failed to fetch {strike_str} after retries")

print("4. Unstitching data based on Spot Price...")
clean_rows = []

for i, t in enumerate(spot_series.keys()):
    spot = spot_series[t]
    atm_strike = round(spot / 50) * 50
    required_offset = int((TARGET_STRIKE - atm_strike) / 50)
    
    if required_offset in rolling_data:
        data_for_offset = rolling_data[required_offset]
        if i < len(data_for_offset.get('close', [])):
            clean_rows.append({
                'Time': t,
                'Spot': spot,
                'ATM_Strike': atm_strike,
                'Used_Offset': f"ATM{'+' if required_offset>0 else ''}{required_offset}" if required_offset != 0 else "ATM",
                'Open': data_for_offset['open'][i],
                'High': data_for_offset['high'][i],
                'Low': data_for_offset['low'][i],
                'Close': data_for_offset['close'][i],
                'Volume': data_for_offset['volume'][i]
            })

df_clean = pd.DataFrame(clean_rows)
if df_clean.empty:
    print("No data could be stitched.")
    exit()

csv_path = 'C:\\Users\\arsal\\Desktop\\New folder (2)\\TEMP\\clean_24100PE.csv'
df_clean.to_csv(csv_path, index=False)
print(f"Successfully saved unstitched clean data to {csv_path}")

print("5. Plotting correct chart...")
import mplfinance as mpf
import os

df_plot = df_clean.copy()
df_plot['Datetime'] = pd.to_datetime(TRADE_DATE + ' ' + df_plot['Time'])
df_plot.set_index('Datetime', inplace=True)
art_dir = r'C:\Users\arsal\.gemini\antigravity\brain\20ed7cbc-fb9b-4de5-88ba-495d78f52ab4\artifacts'
output_path = os.path.join(art_dir, 'candlestick_24100PE.png')

mpf.plot(df_plot, type='candle', style='yahoo', title='NIFTY 29 Apr 24100 PE (Fixed Unstitched)', ylabel='Price', savefig=dict(fname=output_path, dpi=150, bbox_inches='tight'), figratio=(16,8), figscale=1.2)
print("Chart updated!")
