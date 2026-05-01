import requests
import pandas as pd
import datetime
import time
import os
import json

JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3NzIwNTA0LCJpYXQiOjE3Nzc2MzQxMDQsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.9RdINQXCUnMS3Gjcph2ECm6jeNV9so4wVzq8ylwvVlV47B72DQBvwpGwEmQ0zflTV8SJtLtPqMhi0N0OyVePbA"
CLIENT_ID = "1101310976"

headers = {
    'access-token': JWT_TOKEN,
    'client-id': CLIENT_ID,
    'Content-Type': 'application/json'
}

html_file = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\download_tracker.html'
json_file = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\unique_tasks.json'
output_dir = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\Downloaded_Data'
os.makedirs(output_dir, exist_ok=True)

def update_html_status(symbol, status_text, is_success=False):
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            html = f.read()
        
        target = f"id='status-{symbol}' class='status-pending'>⏳ Pending (In Queue)</span>"
        if target in html:
            if is_success:
                new_tag = f"id='status-{symbol}' class='status-done'>✅ {status_text}</span>"
            else:
                new_tag = f"id='status-{symbol}' class='status-pending' style='background:#fee2e2;color:#991b1b;border-color:#fca5a5;'>🔄 {status_text}</span>"
            
            html = html.replace(target, new_tag)
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(html)
    except: pass

with open(json_file, 'r') as f:
    tasks = json.load(f)

for task in tasks:
    sym = task['zerodha_symbol']
    dhan_name = task['dhan_name']
    underlying = task['underlying']
    target_strike = int(task['strike'])
    opt_type = task['option_type']
    expiry_date = task['expiry_date']
    
    print(f"\n==========================================")
    print(f"Processing: {dhan_name} ({sym})")
    update_html_status(sym, "Downloading Week...", is_success=False)
    
    # Calculate previous 5 trading days
    exp_dt = datetime.datetime.strptime(expiry_date, "%Y-%m-%d")
    dates = []
    curr = exp_dt - datetime.timedelta(days=7)
    while curr <= exp_dt:
        if curr.weekday() < 5: # Monday to Friday
            dates.append(curr.strftime("%Y-%m-%d"))
        curr += datetime.timedelta(days=1)
        
    all_clean_rows = []
    
    # We use Underlying ID: 13 for NIFTY, 25 for BANKNIFTY
    sec_id = "13" if underlying == "NIFTY" else "25" if underlying == "BANKNIFTY" else "27" if underlying == "FINNIFTY" else "13"
    
    for TRADE_DATE in dates:
        NEXT_DATE = (datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"  -> {TRADE_DATE}")
        
        # Spot
        try:
            r = requests.post("https://api.dhan.co/v2/charts/intraday", headers=headers, json={"securityId": sec_id, "exchangeSegment": "IDX_I", "instrument": "INDEX", "interval": "1", "fromDate": TRADE_DATE, "toDate": TRADE_DATE})
            spot_data = r.json()
        except: continue
        
        if not spot_data or 'close' not in spot_data: continue
        
        spot_closes = spot_data['close']
        start_time = datetime.datetime.strptime(f"{TRADE_DATE} 09:15:00", "%Y-%m-%d %H:%M:%S")
        spot_series = {}
        for i, c in enumerate(spot_closes):
            t = (start_time + datetime.timedelta(minutes=i)).strftime("%H:%M:%S")
            spot_series[t] = c

        # Expiry Discovery
        valid_exp_type, valid_exp_code = None, None
        for exp_type, exp_code in [('WEEK', 1), ('WEEK', 2), ('WEEK', 3), ('MONTH', 1), ('MONTH', 2), ('MONTH', 3)]:
            try:
                r = requests.post('https://api.dhan.co/v2/charts/rollingoption', headers=headers, json={"securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1, "expiryCode": exp_code, "expiryFlag": exp_type, "strike": "ATM", "drvOptionType": opt_type, "requiredData": ["close"], "fromDate": TRADE_DATE, "toDate": NEXT_DATE})
                if r.status_code == 200 and 'pe' in r.json().get('data', {}): # Dhan uses 'pe' for both? Actually wait, it's 'pe' or 'ce'.
                    pe_ce = 'ce' if opt_type == 'CALL' else 'pe'
                    if len(r.json()['data'][pe_ce]['close']) > 0:
                        valid_exp_type, valid_exp_code = exp_type, exp_code
                        break
            except: pass
            time.sleep(0.2)

        if not valid_exp_type: continue

        # Fetch offsets (-6 to +6)
        rolling_data = {}
        for offset in range(-6, 7):
            strike_str = 'ATM' if offset == 0 else (f'ATM+{offset}' if offset > 0 else f'ATM{offset}')
            for attempt in range(3):
                try:
                    r = requests.post('https://api.dhan.co/v2/charts/rollingoption', headers=headers, json={"securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1, "expiryCode": valid_exp_code, "expiryFlag": valid_exp_type, "strike": strike_str, "drvOptionType": opt_type, "requiredData": ["open", "high", "low", "close", "volume"], "fromDate": TRADE_DATE, "toDate": NEXT_DATE})
                    if r.status_code == 200:
                        pe_ce = 'ce' if opt_type == 'CALL' else 'pe'
                        if pe_ce in r.json().get('data', {}):
                            data_block = r.json()['data'][pe_ce]
                            if len(data_block['close']) > 0:
                                rolling_data[offset] = data_block
                                break
                except: pass
                time.sleep(0.3)
        
        # Stitch
        for i, t in enumerate(spot_series.keys()):
            spot = spot_series[t]
            atm_strike = round(spot / 50) * 50 if underlying != "BANKNIFTY" else round(spot / 100) * 100
            step = 50 if underlying != "BANKNIFTY" else 100
            required_offset = int((target_strike - atm_strike) / step)
            
            if required_offset in rolling_data and i < len(rolling_data[required_offset].get('close', [])):
                all_clean_rows.append({
                    'Datetime': f"{TRADE_DATE} {t}", 'Spot': spot,
                    'Open': rolling_data[required_offset]['open'][i], 'High': rolling_data[required_offset]['high'][i],
                    'Low': rolling_data[required_offset]['low'][i], 'Close': rolling_data[required_offset]['close'][i],
                    'Volume': rolling_data[required_offset]['volume'][i]
                })

    if all_clean_rows:
        df_clean = pd.DataFrame(all_clean_rows)
        csv_path = os.path.join(output_dir, f"{dhan_name}.csv")
        df_clean.to_csv(csv_path, index=False)
        print(f"✅ Saved {len(df_clean)} rows to {csv_path}")
        # Update HTML to success
        update_html_status(sym, f"Downloaded ({len(dates)} Days)", is_success=True)
    else:
        print("❌ Failed to stitch any data.")
        update_html_status(sym, "Failed", is_success=False)

print("\n🎉 ALL BATCH TASKS COMPLETED!")
