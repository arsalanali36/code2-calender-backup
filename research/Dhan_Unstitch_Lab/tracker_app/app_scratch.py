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
                
                # Check for existing data in organized folders
                month_folder = datetime.datetime.strptime(expiry_date, "%Y-%m-%d").strftime("%m - %b")
                inst_subfolder = expected_dhan.replace(' ', '_')
                target_dir = os.path.join(DOWNLOADS_DIR, 'Premium', underlying, month_folder, inst_subfolder)
                
                exists = os.path.exists(target_dir) and any(f.endswith('.csv') for f in os.listdir(target_dir))
                
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
                
        # Sort by trade date descending
        return sorted(tasks, key=lambda x: x['trade_date'], reverse=True)
    except Exception as e:
        print(f"[DEBUG] load_tradebook_tasks GLOBAL ERROR: {e}")
        return []
