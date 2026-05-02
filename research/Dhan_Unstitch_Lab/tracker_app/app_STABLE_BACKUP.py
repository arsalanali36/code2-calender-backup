import traceback
import matplotlib
matplotlib.use('Agg')

from flask import Flask, render_template, request, jsonify, Response, send_from_directory
import pandas as pd
import json
import re
import datetime
import time
import os
import requests
import mplfinance as mpf
import threading
import glob
import calendar

NSE_HOLIDAYS_2026 = {
    "2026-01-15": "Municipal Corporation Election",
    "2026-01-26": "Republic Day",
    "2026-03-03": "Holi",
    "2026-03-26": "Shri Ram Navami",
    "2026-03-31": "Shri Mahavir Jayanti",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
    "2026-05-01": "Maharashtra Day",
    "2026-05-28": "Bakri Id",
    "2026-06-26": "Muharram",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Mahatma Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-10": "Diwali-Balipratipada",
    "2026-11-24": "Prakash Gurpurb Sri Guru Nanak Dev",
    "2026-12-25": "Christmas"
}

app = Flask(__name__)

JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3NzIwNTA0LCJpYXQiOjE3Nzc2MzQxMDQsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.9RdINQXCUnMS3Gjcph2ECm6jeNV9so4wVzq8ylwvVlV47B72DQBvwpGwEmQ0zflTV8SJtLtPqMhi0N0OyVePbA"
CLIENT_ID = "1101310976"
headers = {'access-token': JWT_TOKEN, 'client-id': CLIENT_ID, 'Content-Type': 'application/json'}

# Use absolute path to the directory containing this script
BASE_TRACKER_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_TRACKER_DIR, 'uploads')
DOWNLOADS_DIR = os.path.normpath(os.path.join(BASE_TRACKER_DIR, '..', 'Downloaded_Data'))
CHARTS_DIR = os.path.join(BASE_TRACKER_DIR, 'static', 'charts')

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(CHARTS_DIR, exist_ok=True)

# Cache for Dhan Scrip Master to prevent reloading on every request
DHAN_MASTER_DF = None

def get_dhan_master():
    global DHAN_MASTER_DF
    if DHAN_MASTER_DF is None:
        master_path = os.path.join(DOWNLOADS_DIR, '..', 'dhan_master.csv')
        if os.path.exists(master_path):
            print(f"Loading Dhan Scrip Master from {master_path}...")
            # Use specific columns to save memory
            use_cols = ['SEM_EXM_EXCH_ID', 'SEM_EXCH_INSTRUMENT_TYPE', 'SEM_TRADING_SYMBOL', 'SEM_SMST_SECURITY_ID']
            try:
                DHAN_MASTER_DF = pd.read_csv(master_path, usecols=use_cols, low_memory=False)
                print("Dhan Scrip Master loaded.")
            except:
                DHAN_MASTER_DF = pd.read_csv(master_path, low_memory=False)
                print("Dhan Scrip Master loaded (full).")
        else:
            print(f"WARNING: Dhan Scrip Master not found at {master_path}")
            DHAN_MASTER_DF = pd.DataFrame()
    return DHAN_MASTER_DF

@app.route('/test')
def test_route():
    return "GET request working on port 5050!"

def dhan_request(url, payload, retries=15):
    for i in range(retries):
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=15)
            if r.status_code == 200: return r.json()
            if r.status_code == 429:
                sleep_time = 2 + i * 2
                with open(os.path.join(DOWNLOADS_DIR, "rate_limits.log"), "a") as f:
                    f.write(f"Rate limit hit. Sleeping {sleep_time}s\n")
                time.sleep(sleep_time)
            else:
                time.sleep(1)
        except:
            time.sleep(1)
    return None

def load_tradebook_tasks():
    file_path = os.path.join(UPLOAD_DIR, 'tradebook.csv')
    if not os.path.exists(file_path): return []
    try:
        df = pd.read_csv(file_path)
        # Ensure dates are strings
        df['trade_date'] = pd.to_datetime(df['trade_date'], errors='coerce').dt.strftime('%Y-%m-%d')
        
        # Get unique instruments based on Symbol
        # We take the first trade_date for each unique symbol
        unique_df = df.groupby('symbol').agg({
            'trade_date': 'min',
            'expiry_date': 'first' # if exists
        }).reset_index()
        
        tasks = []
        for _, row in unique_df.iterrows():
            symbol = str(row['symbol']).strip()
            try:
                # Regex to parse Zerodha symbol: NIFTY26APR24000CE or NIFTY2621025950CE
                match = re.search(r'^([A-Z]+)(\d{2})([A-Z0-9]+)(\d{5})([CP][E])$', symbol)
                if not match:
                    continue
                
                underlying = match.group(1)
                expiry_part = match.group(3)
                strike = int(match.group(4))
                opt_type = match.group(5)
                
                if expiry_part.isdigit():
                    # Format: 210 (Feb 10) or 217 (Feb 17)
                    month_digit = int(expiry_part[0])
                    day_digit = int(expiry_part[1:])
                    expiry_month_str = datetime.date(2026, month_digit, 1).strftime('%b').upper()
                    expiry_date = f"2026-{month_digit:02d}-{day_digit:02d}"
                    expected_dhan = f"{underlying} {day_digit} {expiry_month_str} {strike} {'CALL' if opt_type=='CE' else 'PUT'}"
                else:
                    # Format: APR (Monthly/Weekly with month letters)
                    expiry_month_str = expiry_part.upper()
                    try:
                        m_idx = list(calendar.month_abbr).index(expiry_month_str.capitalize())
                        expiry_date = f"2026-{m_idx:02d}-28" # Fallback day
                    except:
                        expiry_date = str(row.get('expiry_date', '2026-04-28'))
                    expected_dhan = f"{underlying} {expiry_month_str} {strike} {'CALL' if opt_type=='CE' else 'PUT'}"
                
                t_date = row['trade_date']
                
                # Check for existing data in organized folders using glob to be flexible with day-numbers
                month_folder = datetime.datetime.strptime(expiry_date, "%Y-%m-%d").strftime("%m - %b")
                # Search for a folder that matches underlying, month, and strike/type
                search_pattern = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_folder, f"*{strike}*{opt_type.replace('E','')}*")
                found_folders = glob.glob(search_pattern)
                
                exists = False
                if found_folders:
                    # Verify if any of the found folders contains CSVs
                    for folder in found_folders:
                        if any(f.endswith('.csv') for f in os.listdir(folder)):
                            exists = True
                            break
                
                tasks.append({
                    "trade_date": t_date,
                    "zerodha_symbol": symbol,
                    "dhan_name": expected_dhan,
                    "underlying": underlying,
                    "strike": strike,
                    "option_type": opt_type,
                    "expiry_date": expiry_date,
                    "html_id": symbol,
                    "is_downloaded": exists,
                    "chart_url": f"/static/charts/{symbol}.png"
                })
            except Exception as e:
                print(f"[DEBUG] Error parsing {symbol}: {e}")
                
        # Sort by trade date (oldest first)
        return sorted(tasks, key=lambda x: x['trade_date'])
    except Exception as e:
        print(f"[DEBUG] load_tradebook_tasks GLOBAL ERROR: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html', tasks=load_tradebook_tasks())

@app.route('/upload_tradebook', methods=['POST'])
def upload_tradebook():
    if 'file' not in request.files: return jsonify({"error": "No file uploaded"})
    request.files['file'].save(os.path.join(UPLOAD_DIR, 'tradebook.csv'))
    return jsonify({"message": "Uploaded!"})

@app.route('/get_existing_instruments', methods=['POST'])
def get_existing_instruments():
    data = request.json
    d_type = data.get('download_type', 'equity')
    target_dir = os.path.join(DOWNLOADS_DIR, d_type.capitalize())
    if os.path.exists(target_dir):
        instruments = [d for d in os.listdir(target_dir) if os.path.isdir(os.path.join(target_dir, d))]
        return jsonify({"instruments": instruments})
    return jsonify({"instruments": []})

@app.route('/delete_task_data', methods=['POST'])
def delete_task_data():
    data = request.json
    html_id = data.get('html_id', '')
    dhan_name = data.get('dhan_name', '')
    
    if html_id.startswith('index_'): d_type = 'Index'
    elif html_id.startswith('equity_'): d_type = 'Equity'
    else: d_type = 'Premium'
    
    if d_type in ['Index', 'Equity']:
        target_dir = os.path.join(DOWNLOADS_DIR, d_type, dhan_name.upper())
    else:
        # Month name from dhan_name
        m_match = re.search(r'\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b', dhan_name.upper())
        if m_match:
            mon_str = m_match.group(1).capitalize()
            try:
                mon_idx = list(calendar.month_abbr).index(mon_str)
                month_name = f"{mon_idx:02d} - {mon_str}"
            except: month_name = 'UNKNOWN'
        else: month_name = 'UNKNOWN'
        
        u_match = re.search(r'^([A-Z]+)', html_id)
        underlying = u_match.group(1) if u_match else ''
        
        # Use glob to find the folder flexibly (handles with/without day number)
        # Regex to find strike and type from html_id
        strike_match = re.search(r'(\d{5})', html_id)
        type_match = re.search(r'([CP]E)$', html_id)
        strike = strike_match.group(1) if strike_match else ""
        opt_type = type_match.group(1).replace('E','') if type_match else ""
        
        search_pattern = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, f"*{strike}*{opt_type}*")
        found_folders = glob.glob(search_pattern)
        if found_folders:
            target_dir = found_folders[0]
        else:
            inst_subfolder = dhan_name.replace(' ', '_')
            target_dir = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, inst_subfolder)
        
    print(f"Deleting data for HTML ID: {html_id}, Dhan Name: {dhan_name}")
    print(f"Target directory: {target_dir}")
    
    chart_path = os.path.join(CHARTS_DIR, f"{html_id}.png")
    debug_path = os.path.join(DOWNLOADS_DIR, f"debug_{html_id}.txt")
    
    pattern = os.path.join(target_dir, f"{dhan_name.replace(' ', '_')}*.csv")
    files = glob.glob(pattern)
    print(f"Found {len(files)} files to delete.")
    
    for f in files:
        try:
            os.remove(f)
            print(f"Deleted file: {f}")
        except Exception as e:
            print(f"Error deleting file {f}: {e}")
        
    if os.path.exists(chart_path): 
        os.remove(chart_path)
        print(f"Deleted chart: {chart_path}")
    if os.path.exists(debug_path):
        os.remove(debug_path)
        print(f"Deleted debug file: {debug_path}")
        
    global status_updates
    status_updates = [u for u in status_updates if u.get('id') != html_id]
    
    return jsonify({"message": "Deleted!"})

status_updates = []
STOP_DOWNLOADS = False

@app.route('/stop_downloads', methods=['POST'])
def stop_downloads():
    global STOP_DOWNLOADS
    STOP_DOWNLOADS = True
    return jsonify({"message": "Stop signal sent! Current downloads will abort shortly."})

def run_downloader(task, start_date, end_date):
    global status_updates, STOP_DOWNLOADS
    # NOTE: Do NOT reset STOP_DOWNLOADS here - it's set by the user via /stop_downloads
    # Only process_background should reset it at the start of a new batch
    underlying, target_strike, opt_type = task['underlying'], int(task['strike']), task['option_type']
    dhan_name, html_id, target_expiry = task['dhan_name'], task['html_id'], task['expiry_date']
    inst_subfolder = dhan_name.replace(' ', '_')
    # Get month name in '01 - Jan' format
    exp_dt = datetime.datetime.strptime(target_expiry, "%Y-%m-%d")
    month_name = exp_dt.strftime("%m - %b") # '04 - Apr'
    target_dir = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, inst_subfolder)
    os.makedirs(target_dir, exist_ok=True)
    chart_path = os.path.join(CHARTS_DIR, f"{html_id}.png")
    
    s_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
    e_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d")
    dates = []
    curr = s_dt
    while curr <= e_dt:
        if curr.weekday() < 5: dates.append(curr.strftime("%Y-%m-%d"))
        curr += datetime.timedelta(days=1)
        
    all_clean_rows = []
    sec_id = "13" if underlying == "NIFTY" else "25" if underlying == "BANKNIFTY" else "27" if underlying == "FINNIFTY" else "13"
    is_monthly = re.search(r'[A-Z]{3,4}\d{2}[A-Z]{3}\d+', html_id) is not None
    
    for idx, TRADE_DATE in enumerate(dates):
        if STOP_DOWNLOADS:
            status_updates.append({"id": html_id, "status": "error", "msg": "🛑 Stopped by user", "percent": 0})
            return False, ""
        day_csv = os.path.join(target_dir, f"{dhan_name.replace(' ', '_')}_{TRADE_DATE}.csv")
        if os.path.exists(day_csv):
            status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏩ Skipping {TRADE_DATE} (Exists)...", "percent": int((idx/len(dates))*100)})
            try:
                exist_df = pd.read_csv(day_csv)
                for _, r in exist_df.iterrows():
                    all_clean_rows.append({'Datetime': r['Datetime'], 'Open': r['Open'], 'High': r['High'], 'Low': r['Low'], 'Close': r['Close'], 'Volume': r['Volume']})
            except: pass
            continue

        status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ [{TRADE_DATE}] Fetching Spot Data...", "percent": int((idx/len(dates))*100)})
        NEXT_DATE = (datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        
        # 1. Fetch Spot data for this specific TRADE_DATE
        spot_data = dhan_request("https://api.dhan.co/v2/charts/intraday", {"securityId": sec_id, "exchangeSegment": "IDX_I", "instrument": "INDEX", "interval": "1", "fromDate": TRADE_DATE, "toDate": TRADE_DATE})
        spot_series = {}
        if spot_data and 'close' in spot_data and spot_data['close']:
            closes = spot_data['close']
            timestamps = spot_data['timestamp']
            for i in range(len(closes)):
                try:
                    dt = datetime.datetime.fromtimestamp(timestamps[i])
                    spot_series[dt.strftime("%H:%M:%S")] = closes[i]
                except: pass
        
        if not spot_series: 
            with open(os.path.join(DOWNLOADS_DIR, f"debug_{html_id}.txt"), "a") as f: f.write(f"[{TRADE_DATE}] No spot data found. Skipping.\n")
            continue
        
        spot_closes = list(spot_series.values())


        # Stop check before heavy expiry discovery
        if STOP_DOWNLOADS:
            status_updates.append({"id": html_id, "status": "error", "msg": "🛑 Stopped by user", "percent": 0})
            return False, ""

        # Smart Expiry Discovery
        status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ [{TRADE_DATE}] Discovering Expiry...", "percent": int((idx/len(dates))*100)})
        td_obj, exp_obj = datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d"), datetime.datetime.strptime(target_expiry, "%Y-%m-%d")
        candidates = ([('MONTH', 1), ('MONTH', 2)] + [('WEEK', i) for i in range(1, 6)]) if is_monthly else ([('WEEK', (exp_obj-td_obj).days//7 + 1), ('WEEK', (exp_obj-td_obj).days//7 + 2), ('WEEK', (exp_obj-td_obj).days//7), ('MONTH', 1)])
        candidates = [c for c in candidates if c[1] >= 1]

        valid_exp_type, valid_exp_code = None, None
        for exp_type, exp_code in candidates:
            if STOP_DOWNLOADS: break  # Stop mid-discovery
            r_json = dhan_request('https://api.dhan.co/v2/charts/rollingoption', {"securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1, "expiryCode": exp_code, "expiryFlag": exp_type, "strike": "ATM", "drvOptionType": opt_type, "requiredData": ["close"], "fromDate": TRADE_DATE, "toDate": NEXT_DATE})
            if r_json and 'data' in r_json and (pe_ce := ('ce' if opt_type == 'CALL' else 'pe')) in r_json['data'] and r_json['data'][pe_ce] and len(r_json['data'][pe_ce].get('close', [])) > 0:
                valid_exp_type, valid_exp_code = exp_type, exp_code
                break
            time.sleep(0.05)
        if not valid_exp_type or STOP_DOWNLOADS: continue

        step = 50 if underlying != "BANKNIFTY" else 100
        # Determine offset range for stitching fallback
        min_offset, max_offset = int((target_strike - round(max(spot_closes)/step)*step)/step), int((target_strike - round(min(spot_closes)/step)*step)/step)
        # We don't skip the day anymore even if offset is > 20, because we have the Absolute Strike fetch.

        rolling_data = {}
        # 1. Always try fetching the Absolute Strike directly
        status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ [{TRADE_DATE}] Fetching Strike Data...", "percent": int((idx/len(dates))*100)})
        r_json = dhan_request('https://api.dhan.co/v2/charts/rollingoption', {
            "securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1,
            "expiryCode": valid_exp_code, "expiryFlag": valid_exp_type, "strike": str(target_strike),
            "drvOptionType": opt_type, "requiredData": ["open", "high", "low", "close", "volume"],
            "fromDate": TRADE_DATE, "toDate": NEXT_DATE
        })
        if r_json and 'data' in r_json and (pe_ce := ('ce' if opt_type == 'CALL' else 'pe')) in r_json['data'] and r_json['data'][pe_ce] and len(r_json['data'][pe_ce].get('close', [])) > 0:
            rolling_data['TARGET'] = r_json['data'][pe_ce]
        time.sleep(0.3)

        # 2. Try Offsets for stitching (if target strike data is partial or missing)
        status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ [{TRADE_DATE}] Stitching Fallback...", "percent": int((idx/len(dates))*100)})
        for offset in range(min_offset, max_offset + 1):
            if STOP_DOWNLOADS: break  # Stop mid-stitch
            if offset < -20 or offset > 20: continue # Dhan offset limit
            strike_str = 'ATM' if offset == 0 else (f'ATM+{offset}' if offset > 0 else f'ATM{offset}')
            r_json = dhan_request('https://api.dhan.co/v2/charts/rollingoption', {"securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX", "interval": 1, "expiryCode": valid_exp_code, "expiryFlag": valid_exp_type, "strike": strike_str, "drvOptionType": opt_type, "requiredData": ["open", "high", "low", "close", "volume"], "fromDate": TRADE_DATE, "toDate": NEXT_DATE})
            if r_json and 'data' in r_json and (pe_ce := ('ce' if opt_type == 'CALL' else 'pe')) in r_json['data'] and r_json['data'][pe_ce] and len(r_json['data'][pe_ce].get('close', [])) > 0:
                rolling_data[offset] = r_json['data'][pe_ce]
            time.sleep(0.3)
        
        for i, t in enumerate(spot_series.keys()):
            # Preference 1: Direct Target Strike Data
            if 'TARGET' in rolling_data and i < len(rolling_data['TARGET']['close']):
                all_clean_rows.append({'Datetime': f"{TRADE_DATE} {t}", 'Open': rolling_data['TARGET']['open'][i], 'High': rolling_data['TARGET']['high'][i], 'Low': rolling_data['TARGET']['low'][i], 'Close': rolling_data['TARGET']['close'][i], 'Volume': rolling_data['TARGET']['volume'][i]})
            else:
                # Preference 2: Stitching logic (as fallback)
                atm_s = round(spot_series[t]/step)*step
                required_offset = int((target_strike - atm_s)/step)
                if required_offset in rolling_data and i < len(rolling_data[required_offset]['close']):
                    all_clean_rows.append({'Datetime': f"{TRADE_DATE} {t}", 'Open': rolling_data[required_offset]['open'][i], 'High': rolling_data[required_offset]['high'][i], 'Low': rolling_data[required_offset]['low'][i], 'Close': rolling_data[required_offset]['close'][i], 'Volume': rolling_data[required_offset]['volume'][i]})

        with open(os.path.join(DOWNLOADS_DIR, f"debug_{html_id}.txt"), "a") as f:
            day_collected = len([r for r in all_clean_rows if r['Datetime'].startswith(TRADE_DATE)])
            f.write(f"[{TRADE_DATE}] valid_exp={valid_exp_type} {valid_exp_code}, min_offset={min_offset}, max_offset={max_offset}, collected={day_collected}\n")
        
        # Save day-wise file immediately
        day_rows = [r for r in all_clean_rows if r['Datetime'].startswith(TRADE_DATE)]
        if day_rows:
            day_df = pd.DataFrame(day_rows)
            day_df.set_index('Datetime', inplace=True)
            day_df.to_csv(day_csv)

    if all_clean_rows:
        df = pd.DataFrame(all_clean_rows); df['Datetime'] = pd.to_datetime(df['Datetime']); df.set_index('Datetime', inplace=True)
        # Save full data to recreate chart
        df_plot = df.resample('5min', closed='left', label='left').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
        if not df_plot.empty:
            try:
                mpf.plot(df_plot, type='candle', style='yahoo', title=f'{dhan_name} (5-Min)', savefig=dict(fname=chart_path, dpi=100, bbox_inches='tight'), figratio=(10,4), figscale=0.8)
            except Exception as e:
                with open(os.path.join(DOWNLOADS_DIR, f"debug_{html_id}.txt"), "a") as f: f.write(f"Chart Error: {str(e)}\n")
            return True, f"/static/charts/{html_id}.png"
    return False, ""

EQUITY_SEC_MAP = None

def get_equity_sec_id(symbol):
    global EQUITY_SEC_MAP
    if EQUITY_SEC_MAP is None:
        try:
            df = get_dhan_master()
            if df.empty: return ""
            eq_df = df[(df['SEM_EXM_EXCH_ID'] == 'NSE') & (df['SEM_EXCH_INSTRUMENT_TYPE'].isin(['ES', 'EQUITY', 'ETF']))]
            map_exact = dict(zip(eq_df['SEM_TRADING_SYMBOL'].astype(str).str.upper(), eq_df['SEM_SMST_SECURITY_ID']))
            map_no_eq = dict(zip(eq_df['SEM_TRADING_SYMBOL'].astype(str).str.replace('-EQ$', '', regex=True).str.upper(), eq_df['SEM_SMST_SECURITY_ID']))
            EQUITY_SEC_MAP = {**map_exact, **map_no_eq}
            # Custom mappings for common tickers
            if 'HDFCBANK' in EQUITY_SEC_MAP: EQUITY_SEC_MAP['HDFC'] = EQUITY_SEC_MAP['HDFCBANK']
            if 'BAJFINANCE' in EQUITY_SEC_MAP: EQUITY_SEC_MAP['BAJAJFIN'] = EQUITY_SEC_MAP['BAJFINANCE']
        except Exception as e:
            print("Error processing EQUITY_SEC_MAP:", e)
            EQUITY_SEC_MAP = {}
    return str(EQUITY_SEC_MAP.get(symbol.upper(), ""))

def run_downloader_eq_idx(inst, start_date, end_date, d_type, html_id):
    target_dir = os.path.join(DOWNLOADS_DIR, d_type.capitalize(), inst.upper())
    os.makedirs(target_dir, exist_ok=True)
    chart_path = os.path.join(CHARTS_DIR, f"{html_id}.png")

    if d_type == 'index':
        sec_id = {"NIFTY": "13", "BANKNIFTY": "25", "FINNIFTY": "27"}.get(inst.upper(), "13")
        ex_seg, instr = "IDX_I", "INDEX"
    else:
        sec_id = get_equity_sec_id(inst)
        if not sec_id: return False, "❌ Invalid Symbol"
        ex_seg, instr = "NSE_EQ", "EQUITY"

    r_json = dhan_request("https://api.dhan.co/v2/charts/intraday", {
        "securityId": sec_id, "exchangeSegment": ex_seg, "instrument": instr, 
        "interval": "1", "fromDate": start_date, "toDate": end_date
    })

    if r_json and 'close' in r_json and r_json['close']:
        closes, timestamps = r_json['close'], r_json['timestamp']
        opens = r_json.get('open', closes)
        highs = r_json.get('high', closes)
        lows = r_json.get('low', closes)
        vols = r_json.get('volume', [0]*len(closes))
        
        all_clean_rows = []
        for i in range(len(closes)):
            try:
                dt = datetime.datetime.fromtimestamp(timestamps[i])
                all_clean_rows.append({'Datetime': dt, 'Open': opens[i], 'High': highs[i], 'Low': lows[i], 'Close': closes[i], 'Volume': vols[i]})
            except: pass
            
        if all_clean_rows:
            df = pd.DataFrame(all_clean_rows); df.set_index('Datetime', inplace=True)
            # Save day-wise files
            for day, group in df.groupby(df.index.date):
                day_str = day.strftime('%Y-%m-%d')
                day_csv = os.path.join(target_dir, f"{inst.replace(' ', '_')}_{day_str}.csv")
                group.to_csv(day_csv)
                
            df_plot = df.resample('5min', closed='left', label='left').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
            if not df_plot.empty:
                try:
                    mpf.plot(df_plot, type='candle', style='yahoo', title=f'{inst} (5-Min)', savefig=dict(fname=chart_path, dpi=100, bbox_inches='tight'), figratio=(10,4), figscale=0.8)
                except Exception as e:
                    pass
                return True, f"/static/charts/{html_id}.png"
    return False, ""

@app.route('/download', methods=['POST'])
def download_range():
    global status_updates
    data = request.json
    s_date, e_date = data.get('start_date'), data.get('end_date')
    download_type = data.get('download_type', 'premium')
    instruments = data.get('instruments', [])

    if download_type == 'premium':
        all_tasks = load_tradebook_tasks()
        # If UI sent a specific list of symbols, filter by them AND ensure they are within the date range
        if instruments:
            tasks = [t for t in all_tasks if t['zerodha_symbol'] in instruments and s_date <= t['trade_date'] <= e_date]
        else:
            tasks = [t for t in all_tasks if s_date <= t['trade_date'] <= e_date and not t['is_downloaded']]
            
        def process_background():
            global STOP_DOWNLOADS
            STOP_DOWNLOADS = False  # Reset only when user starts a new batch
            for t in tasks:
                if STOP_DOWNLOADS:
                    break  # Exit the whole batch immediately
                try:
                    # Strict Check: Don't download if the selected range is completely after the instrument's life
                    if t['expiry_date'] < s_date:
                        print(f"Skipping {t['zerodha_symbol']} - Already expired before {s_date}")
                        continue

                    status_updates.append({"id": t['html_id'], "status": "downloading", "msg": f"⏳ Starting {t['zerodha_symbol']}...", "percent": 0})
                    success, chart_url = run_downloader(t, s_date, e_date)
                    if not STOP_DOWNLOADS:
                        status_updates.append({"id": t['html_id'], "status": "done" if success else "error", "msg": "✅ Done" if success else "❌ Failed", "percent": 100 if success else 0, "chart": chart_url if success else None})
                except Exception as e:
                    status_updates.append({"id": t['html_id'], "status": "error", "msg": f"❌ Error: {str(e)[:30]}", "percent": 0})
        threading.Thread(target=process_background, daemon=True).start()
        return jsonify({"message": f"Started {len(tasks)} premium downloads!"})
    
    elif download_type in ['equity', 'index']:
        def process_eq_idx():
            for inst in instruments:
                html_id = f"{download_type}_{re.sub(r'[^a-zA-Z0-9]', '', inst)}"
                try:
                    status_updates.append({"id": html_id, "status": "downloading", "msg": f"⏳ Fetching {inst}...", "percent": 50})
                    success, result_val = run_downloader_eq_idx(inst, s_date, e_date, download_type, html_id)
                    if success:
                        status_updates.append({"id": html_id, "status": "done", "msg": "✅ Done", "percent": 100, "chart": result_val})
                    else:
                        err_msg = result_val if result_val else "❌ Failed (No Data)"
                        status_updates.append({"id": html_id, "status": "error", "msg": err_msg, "percent": 0})
                except Exception as e:
                    status_updates.append({"id": html_id, "status": "error", "msg": f"❌ Error", "percent": 0})
        threading.Thread(target=process_eq_idx).start()
        return jsonify({"message": f"Started {len(instruments)} {download_type} downloads!"})

@app.route('/view_day_chart')
def view_day_chart():
    symbol = request.args.get('symbol') # html_id
    dhan_name = request.args.get('dhan_name')
    date = request.args.get('date')
    d_type = request.args.get('type', 'premium').capitalize()
    
    print(f"[DEBUG] view_day_chart: symbol={symbol}, dhan_name={dhan_name}, date={date}, type={d_type}")
    
    try:
        if d_type in ['Index', 'Equity']:
            target_dir = os.path.join(DOWNLOADS_DIR, d_type, dhan_name.upper())
        else:
            # Strip 'premium-' if present
            clean_symbol = symbol.replace('premium-', '')
            match = re.search(r'^([A-Z]+)', clean_symbol)
            underlying = match.group(1) if match else ''
            
            # Month name from dhan_name
            m_match = re.search(r'\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b', dhan_name.upper())
            if m_match:
                mon_str = m_match.group(1).capitalize()
                try:
                    mon_idx = list(calendar.month_abbr).index(mon_str)
                    month_name = f"{mon_idx:02d} - {mon_str}"
                except: month_name = 'UNKNOWN'
            else: month_name = 'UNKNOWN'
            
            # Flexible folder search
            strike_match = re.search(r'(\d{5})(?:[CP]E)$', clean_symbol)
            type_match = re.search(r'([CP]E)$', clean_symbol)
            strike = strike_match.group(1) if strike_match else ""
            opt_type = type_match.group(1).replace('E','') if type_match else ""
            
            search_pattern = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, f"*{strike}*{opt_type}*")
            found_folders = glob.glob(search_pattern)
            if found_folders:
                target_dir = found_folders[0]
            else:
                inst_subfolder = dhan_name.replace(' ', '_')
                target_dir = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, inst_subfolder)

        print(f"[DEBUG] Target Dir: {target_dir}")
        
        # Flexible CSV search for the specific date
        csv_pattern = os.path.join(target_dir, f"*_{date}.csv")
        found_csvs = glob.glob(csv_pattern)
        
        if not found_csvs:
            print(f"[ERROR] No CSV found for date {date} in {target_dir}")
            return f"<h1>Data not found for {date} in {os.path.basename(target_dir)}</h1>", 404
            
        day_csv = found_csvs[0]
        print(f"[DEBUG] Found CSV: {day_csv}")
        
        df = pd.read_csv(day_csv)
        if df.empty:
            return "<h1>CSV is empty</h1>", 500
            
        # Standardize column names (handle both 'Datetime' and 'datetime')
        df.columns = [c.capitalize() for c in df.columns]
        if 'Datetime' not in df.columns:
            # Fallback if no datetime column
            return f"<h1>CSV missing Datetime column. Columns: {list(df.columns)}</h1>", 500

        df['Datetime'] = pd.to_datetime(df['Datetime'])
        df.set_index('Datetime', inplace=True)
        
        # Generate temporary chart
        day_chart_name = f"day_{symbol}_{date}.png"
        day_chart_path = os.path.join(CHARTS_DIR, day_chart_name)
        
        # Ensure charts dir exists
        os.makedirs(CHARTS_DIR, exist_ok=True)
        
        df_plot = df.resample('5min', closed='left', label='left').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
        
        if not df_plot.empty:
            mpf.plot(df_plot, type='candle', style='yahoo', title=f'{dhan_name} - {date}', 
                     savefig=dict(fname=day_chart_path, dpi=100, bbox_inches='tight'), 
                     figratio=(10,4), figscale=1.0)
            return send_from_directory(CHARTS_DIR, day_chart_name)
        else:
            return "<h1>No data available for plotting (empty after resample)</h1>", 500

    except Exception as e:
        print(f"[CRITICAL ERROR] view_day_chart failed: {str(e)}")
        print(traceback.format_exc())
        return f"<h1>Internal Server Error</h1><pre>{str(e)}</pre>", 500

@app.route('/check_status', methods=['POST'])
def check_status():
    data = request.json
    items = data.get('items', [])
    s_date, e_date = data.get('start_date'), data.get('end_date')
    d_type = data.get('download_type', 'equity')
    
    s_dt = datetime.datetime.strptime(s_date, "%Y-%m-%d")
    e_dt = datetime.datetime.strptime(e_date, "%Y-%m-%d")
    
    results = {}
    # Load all tasks once for lookups
    all_tasks = load_tradebook_tasks() if d_type.lower() == 'premium' else []
    
    # Get IDs of instruments currently in the download queue (from status_updates)
    # We look for the most recent status for each ID
    active_downloads = {}
    for update in status_updates:
        active_downloads[update['id']] = update['status']
    
    for item in items:
        symbol = item['symbol'] if isinstance(item, dict) else item
        dhan_name = item['dhan_name'] if isinstance(item, dict) else item
        
        # UI Visibility is INDEPENDENT of global date range for Premium
        if d_type.lower() == 'premium':
            # Case-insensitive matching
            task = next((t for t in all_tasks if t['zerodha_symbol'].strip().upper() == symbol.strip().upper()), None)
            if task:
                exp_dt = datetime.datetime.strptime(task['expiry_date'], "%Y-%m-%d")
                inst_s_dt = exp_dt.replace(day=1)
                inst_e_dt = exp_dt
                print(f"[DEBUG] Found task for {symbol}, range: {inst_s_dt.date()} to {inst_e_dt.date()}", flush=True)
            else:
                print(f"[DEBUG] NO TASK FOUND for {symbol} in all_tasks!", flush=True)
                inst_s_dt, inst_e_dt = s_dt, e_dt
            
            # Strip 'premium-' for regex
            clean_symbol = symbol.replace('premium-', '')
            match = re.search(r'^([A-Z]+)', clean_symbol)
            underlying = match.group(1) if match else ''
            # Flexible Month detection from dhan_name (handles "28 APR" and "APR")
            m_match = re.search(r'\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b', dhan_name.upper())
            if m_match:
                mon_str = m_match.group(1).capitalize()
                try:
                    mon_idx = list(calendar.month_abbr).index(mon_str)
                    month_name = f"{mon_idx:02d} - {mon_str}"
                except: month_name = 'UNKNOWN'
            else: month_name = 'UNKNOWN'
            # Flexible folder search - Extract strike/opt_type from task or regex
            if task:
                strike = task.get('strike', '')
                opt_type = task.get('option_type', '')
            else:
                # Fallback to regex extraction
                s_match = re.search(r'(\d{5})(?:[CP]E)$', clean_symbol)
                t_match = re.search(r'([CP]E)$', clean_symbol)
                strike = s_match.group(1) if s_match else ""
                opt_type = t_match.group(1) if t_match else ""

            search_pattern = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, f"*{strike}*{str(opt_type).replace('E','')}*")
            found_folders = glob.glob(search_pattern)
            if found_folders:
                target_dir = found_folders[0]
            else:
                target_dir = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_name, dhan_name.replace(' ', '_'))
            
            print(f"[DEBUG] Premium Path: {target_dir}", flush=True)
        else:
            inst_s_dt, inst_e_dt = s_dt, e_dt
            if d_type.lower() in ['index', 'equity']:
                target_dir = os.path.join(DOWNLOADS_DIR, d_type.capitalize(), symbol.upper())
            else:
                target_dir = os.path.join(DOWNLOADS_DIR, 'Premium', symbol.replace(' ', '_'))
            print(f"[DEBUG] {d_type} Path: {target_dir}", flush=True)
            
        dates = []
        curr = inst_s_dt
        while curr <= inst_e_dt:
            if curr.weekday() < 5:
                day_str = curr.strftime("%Y-%m-%d")
                hol_name = NSE_HOLIDAYS_2026.get(day_str)
                # Check for any CSV matching this date in the folder
                pattern = os.path.join(target_dir, f"*_{day_str}.csv")
                found_files = glob.glob(pattern)
                exists = len(found_files) > 0
                if not exists:
                    print(f"[DEBUG-STATUS] MISSING: {day_str} for {symbol}. Pattern: {pattern}")
                else:
                    print(f"[DEBUG-STATUS] FOUND: {day_str} for {symbol}. File: {found_files[0]}")
                
                dates.append({
                    "date": day_str, 
                    "downloaded": exists, 
                    "is_holiday": hol_name is not None,
                    "holiday_name": hol_name
                })
            curr += datetime.timedelta(days=1)
        results[symbol] = dates
        
    return jsonify(results)

@app.route('/stream_status')
def stream_status():
    def generate():
        last_idx = 0
        while True:
            if last_idx < len(status_updates):
                for update in status_updates[last_idx:]: yield f"data: {json.dumps(update)}\n\n"
                last_idx = len(status_updates)
            time.sleep(0.5)
    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    # Pre-load master CSV to warm cache
    get_dhan_master()
    app.run(host='0.0.0.0', port=5050, debug=False, threaded=True)
