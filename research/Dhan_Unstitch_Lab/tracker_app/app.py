import matplotlib
matplotlib.use('Agg')

from flask import Flask, render_template, request, jsonify, Response
import pandas as pd
import json
import re
import datetime
import time
import os
import requests
import mplfinance as mpf
import threading

app = Flask(__name__)

JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3NzIwNTA0LCJpYXQiOjE3Nzc2MzQxMDQsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.9RdINQXCUnMS3Gjcph2ECm6jeNV9so4wVzq8ylwvVlV47B72DQBvwpGwEmQ0zflTV8SJtLtPqMhi0N0OyVePbA"
CLIENT_ID = "1101310976"
headers = {'access-token': JWT_TOKEN, 'client-id': CLIENT_ID, 'Content-Type': 'application/json'}

UPLOAD_DIR = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\tracker_app\uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

def load_tradebook_tasks():
    file_path = os.path.join(UPLOAD_DIR, 'tradebook.csv')
    if not os.path.exists(file_path):
        return []
        
    df = pd.read_csv(file_path)
    df['trade_date'] = pd.to_datetime(df['trade_date'], errors='coerce').dt.strftime('%Y-%m-%d')
    df['expiry_date'] = pd.to_datetime(df['expiry_date'], errors='coerce').dt.strftime('%Y-%m-%d')
    unique_trades = df[['trade_date', 'symbol', 'expiry_date']].drop_duplicates().reset_index(drop=True)
    
    tasks = []
    months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    for _, row in unique_trades.iterrows():
        t_date = row['trade_date']
        symbol = row['symbol']
        expiry_date = str(row['expiry_date'])
        match = re.search(r'^([A-Z]+).*?(\d+)(CE|PE)$', symbol)
        if match and '-' in expiry_date:
            underlying = match.group(1)
            strike = int(match.group(2))
            opt_type = 'CALL' if match.group(3) == 'CE' else 'PUT'
            try:
                y, m, d = expiry_date.split('-')
                month_str = months[int(m)-1]
                expected_dhan = f"{underlying} {d} {month_str} {strike} {opt_type}"
                tasks.append({
                    "trade_date": t_date, "zerodha_symbol": symbol, "dhan_name": expected_dhan,
                    "underlying": underlying, "strike": strike, "option_type": opt_type,
                    "expiry_date": expiry_date, "html_id": f"{t_date}_{symbol}"
                })
            except: pass
    tasks.sort(key=lambda x: x['trade_date'])
    return tasks

@app.route('/')
def index():
    tasks = load_tradebook_tasks()
    return render_template('index.html', tasks=tasks)

@app.route('/upload_tradebook', methods=['POST'])
def upload_tradebook():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"})
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"})
        
    file_path = os.path.join(UPLOAD_DIR, 'tradebook.csv')
    file.save(file_path)
    return jsonify({"message": "File uploaded and parsed successfully!"})

status_updates = []

def run_downloader(task, start_date, end_date):
    global status_updates
    
    underlying = task['underlying']
    target_strike = int(task['strike'])
    opt_type = task['option_type']
    dhan_name = task['dhan_name']
    html_id = task['html_id']
    
    s_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
    e_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d")
    dates = []
    curr = s_dt
    while curr <= e_dt:
        if curr.weekday() < 5: dates.append(curr.strftime("%Y-%m-%d"))
        curr += datetime.timedelta(days=1)
        
    all_clean_rows = []
    sec_id = "13" if underlying == "NIFTY" else "25" if underlying == "BANKNIFTY" else "27" if underlying == "FINNIFTY" else "13"
    
    total_days = len(dates)
    
    for idx, TRADE_DATE in enumerate(dates):
        percent = int((idx / total_days) * 100)
        status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ Fetching {TRADE_DATE}... ({percent}%)", "percent": percent})
        
        NEXT_DATE = (datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        try:
            r = requests.post("https://api.dhan.co/v2/charts/intraday", headers=headers, json={"securityId": sec_id, "exchangeSegment": "IDX_I", "instrument": "INDEX", "interval": "1", "fromDate": TRADE_DATE, "toDate": TRADE_DATE})
            spot_data = r.json()
        except: continue
        if not spot_data or 'close' not in spot_data: continue
        spot_closes = spot_data['close']
        start_time = datetime.datetime.strptime(f"{TRADE_DATE} 09:15:00", "%Y-%m-%d %H:%M:%S")
        spot_series = {}
        for i, c in enumerate(spot_closes):
            spot_series[(start_time + datetime.timedelta(minutes=i)).strftime("%H:%M:%S")] = c

        valid_exp_type, valid_exp_code = None, None
        for exp_type, exp_code in [('WEEK', 1), ('WEEK', 2), ('WEEK', 3), ('MONTH', 1), ('MONTH', 2), ('MONTH', 3)]:
            try:
                r = requests.post('https://api.dhan.co/v2/charts/rollingoption', headers=headers, json={"securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1, "expiryCode": exp_code, "expiryFlag": exp_type, "strike": "ATM", "drvOptionType": opt_type, "requiredData": ["close"], "fromDate": TRADE_DATE, "toDate": NEXT_DATE})
                if r.status_code == 200 and 'pe' in r.json().get('data', {}):
                    pe_ce = 'ce' if opt_type == 'CALL' else 'pe'
                    if len(r.json()['data'][pe_ce]['close']) > 0:
                        valid_exp_type, valid_exp_code = exp_type, exp_code
                        break
            except: pass
            time.sleep(0.1)
        if not valid_exp_type: continue

        rolling_data = {}
        for offset in range(-6, 7):
            strike_str = 'ATM' if offset == 0 else (f'ATM+{offset}' if offset > 0 else f'ATM{offset}')
            for attempt in range(2):
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
                time.sleep(0.2)
        
        for i, t in enumerate(spot_series.keys()):
            spot = spot_series[t]
            atm_strike = round(spot / 50) * 50 if underlying != "BANKNIFTY" else round(spot / 100) * 100
            step = 50 if underlying != "BANKNIFTY" else 100
            required_offset = int((target_strike - atm_strike) / step)
            if required_offset in rolling_data and i < len(rolling_data[required_offset].get('close', [])):
                all_clean_rows.append({
                    'Datetime': f"{TRADE_DATE} {t}", 'Open': rolling_data[required_offset]['open'][i],
                    'High': rolling_data[required_offset]['high'][i], 'Low': rolling_data[required_offset]['low'][i],
                    'Close': rolling_data[required_offset]['close'][i], 'Volume': rolling_data[required_offset]['volume'][i]
                })

    if all_clean_rows:
        status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ Plotting Chart (99%)...", "percent": 99})
        df_clean = pd.DataFrame(all_clean_rows)
        df_clean['Datetime'] = pd.to_datetime(df_clean['Datetime'])
        df_clean.set_index('Datetime', inplace=True)
        csv_path = f"static/data/{html_id}.csv"
        df_clean.to_csv(csv_path)
        
        df_plot = df_clean.resample('5min', closed='left', label='left').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
        chart_path = f"static/charts/{html_id}.png"
        mpf.plot(df_plot, type='candle', style='yahoo', title=f'{dhan_name} (5-Min)', savefig=dict(fname=chart_path, dpi=100, bbox_inches='tight'), figratio=(10,4), figscale=0.8)
        
        return True, f"/{chart_path}"
    return False, ""

@app.route('/download', methods=['POST'])
def download_range():
    global status_updates
    data = request.json
    s_date = data.get('start_date')
    e_date = data.get('end_date')
    
    tasks = load_tradebook_tasks()
    filtered = [t for t in tasks if s_date <= t['trade_date'] <= e_date]
    
    def process_background():
        for t in filtered:
            status_updates.append({"id": t['html_id'], "status": "downloading", "msg": "⏳ Starting Download (0%)...", "percent": 0})
            success, chart_url = run_downloader(t, s_date, e_date)
            if success:
                status_updates.append({"id": t['html_id'], "status": "done", "msg": "✅ Downloaded (100%)", "percent": 100, "chart": chart_url})
            else:
                status_updates.append({"id": t['html_id'], "status": "error", "msg": "❌ Failed", "percent": 0})
                
    threading.Thread(target=process_background).start()
    return jsonify({"message": "Download started!", "count": len(filtered)})

@app.route('/stream_status')
def stream_status():
    def generate():
        last_idx = 0
        while True:
            if last_idx < len(status_updates):
                for update in status_updates[last_idx:]:
                    yield f"data: {json.dumps(update)}\n\n"
                last_idx = len(status_updates)
            time.sleep(0.5)
    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(port=5050)
