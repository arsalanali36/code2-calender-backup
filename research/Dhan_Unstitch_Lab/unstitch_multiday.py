import requests
import pandas as pd
import datetime
import time
import os
import mplfinance as mpf

JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3NzIwNTA0LCJpYXQiOjE3Nzc2MzQxMDQsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.9RdINQXCUnMS3Gjcph2ECm6jeNV9so4wVzq8ylwvVlV47B72DQBvwpGwEmQ0zflTV8SJtLtPqMhi0N0OyVePbA"
CLIENT_ID = "1101310976"

headers = {
    'access-token': JWT_TOKEN,
    'client-id': CLIENT_ID,
    'Content-Type': 'application/json'
}

dates = ['2026-04-22', '2026-04-23', '2026-04-24', '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']
TARGET_STRIKE = 24100
STRIKE_STEP = 50

all_clean_rows = []

for TRADE_DATE in dates:
    print(f"\n--- PROCESSING DATE: {TRADE_DATE} ---")
    
    NEXT_DATE = (datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    
    # 1. Fetch Spot Data
    spot_payload = {
        "securityId": "13", "exchangeSegment": "IDX_I", "instrument": "INDEX",
        "interval": "1", "fromDate": TRADE_DATE, "toDate": TRADE_DATE
    }
    try:
        r = requests.post("https://api.dhan.co/v2/charts/intraday", headers=headers, json=spot_payload)
        spot_data = r.json()
    except Exception as e:
        print(f"Failed spot request: {e}")
        continue
        
    if not spot_data or 'close' not in spot_data:
        print("No spot data available for this date.")
        continue
        
    spot_closes = spot_data['close']
    start_time = datetime.datetime.strptime(f"{TRADE_DATE} 09:15:00", "%Y-%m-%d %H:%M:%S")
    spot_series = {}
    for i, c in enumerate(spot_closes):
        t = (start_time + datetime.timedelta(minutes=i)).strftime("%H:%M:%S")
        spot_series[t] = c

    # 2. Discover Expiry
    valid_exp_type = None
    valid_exp_code = None
    expiry_candidates = [('WEEK', 1), ('WEEK', 2), ('WEEK', 3), ('WEEK', 4), ('MONTH', 1), ('MONTH', 2), ('MONTH', 3)]
    
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
        time.sleep(0.2)

    if not valid_exp_type:
        print("Could not find a valid expiry contract for this date.")
        continue
    
    print(f"Found expiry: {valid_exp_type} {valid_exp_code}")

    # 3. Fetch Offsets
    rolling_data = {}
    for offset in range(-8, 9): # Wider net for multi-day
        strike_str = 'ATM' if offset == 0 else (f'ATM+{offset}' if offset > 0 else f'ATM{offset}')
        success = False
        for attempt in range(4):
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
            except: pass
            time.sleep(0.3)
    
    # 4. Unstitch
    stitched_count = 0
    for i, t in enumerate(spot_series.keys()):
        spot = spot_series[t]
        atm_strike = round(spot / 50) * 50
        required_offset = int((TARGET_STRIKE - atm_strike) / 50)
        
        if required_offset in rolling_data:
            data_for_offset = rolling_data[required_offset]
            if i < len(data_for_offset.get('close', [])):
                all_clean_rows.append({
                    'Datetime': f"{TRADE_DATE} {t}",
                    'Spot': spot,
                    'Open': data_for_offset['open'][i],
                    'High': data_for_offset['high'][i],
                    'Low': data_for_offset['low'][i],
                    'Close': data_for_offset['close'][i],
                    'Volume': data_for_offset['volume'][i]
                })
                stitched_count += 1
    print(f"Stitched {stitched_count} minutes.")

if len(all_clean_rows) == 0:
    print("No data stitched across any dates.")
    exit()

df_clean = pd.DataFrame(all_clean_rows)
df_clean['Datetime'] = pd.to_datetime(df_clean['Datetime'])
df_clean.set_index('Datetime', inplace=True)
df_clean.sort_index(inplace=True)
csv_path = 'C:\\Users\\arsal\\Desktop\\New folder (2)\\TEMP\\clean_24100PE_multiday.csv'
df_clean.to_csv(csv_path)
print(f"\nSaved {len(df_clean)} rows to {csv_path}")

print("Plotting 5-min multi-day chart...")
df_plot = df_clean.resample('5min', closed='left', label='left').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
art_dir = r'C:\Users\arsal\.gemini\antigravity\brain\20ed7cbc-fb9b-4de5-88ba-495d78f52ab4\artifacts'
os.makedirs(art_dir, exist_ok=True)
output_path = os.path.join(art_dir, 'candlestick_24100PE_multiday.png')

mpf.plot(df_plot, type='candle', style='yahoo', title='NIFTY 22-30 Apr 24100 PE (5-Min)', ylabel='Price', savefig=dict(fname=output_path, dpi=200, bbox_inches='tight'), figratio=(16,6), figscale=1.2)
print("Chart updated!")
