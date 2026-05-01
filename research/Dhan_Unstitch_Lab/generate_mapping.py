import pandas as pd
import re

# Load CSVs
try:
    tb = pd.read_csv('C:\\Users\\arsal\\Desktop\\New folder (2)\\TEMP\\tradebook-VH2762-FO.csv')
    dhan = pd.read_csv('C:\\Users\\arsal\\Desktop\\New folder (2)\\TEMP\\dhan_master.csv', low_memory=False)
except Exception as e:
    print(f"Error loading CSVs: {e}")
    exit(1)

# Get unique symbols and their expiry
unique_trades = tb[['symbol', 'expiry_date']].drop_duplicates()

# We need a clean column for Date in Dhan Master
dhan['expiry_date_only'] = dhan['SEM_EXPIRY_DATE'].astype(str).str.split(' ').str[0]

results = []

for _, row in unique_trades.iterrows():
    symbol = row['symbol']
    expiry_date = str(row['expiry_date'])
    
    match = re.search(r'^([A-Z]+).*?(\d+)(CE|PE)$', symbol)
    if match:
        underlying = match.group(1)
        strike = float(match.group(2))
        opt_type = 'CALL' if match.group(3) == 'CE' else 'PUT'
        
        # Search in Dhan
        match_dhan = dhan[
            (dhan['SM_SYMBOL_NAME'] == underlying) & 
            (dhan['SEM_STRIKE_PRICE'] == strike) & 
            (dhan['SEM_OPTION_TYPE'] == opt_type) & 
            (dhan['expiry_date_only'] == expiry_date)
        ]
        
        if not match_dhan.empty:
            # Prefer SEM_CUSTOM_SYMBOL as it looks closer to human readable, fallback to SEM_TRADING_SYMBOL
            dhan_sym = str(match_dhan.iloc[0]['SEM_CUSTOM_SYMBOL'])
            status = "<span style='color: green; font-weight: bold;'>Matched ✓</span>"
        else:
            # If not matched, generate the expected Dhan Custom Symbol format based on Expiry Date and Strike
            try:
                # Expiry date is YYYY-MM-DD
                y, m, d = expiry_date.split('-')
                months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
                month_str = months[int(m)-1]
                expected_dhan = f"{underlying} {d} {month_str} {int(strike)} {opt_type}"
            except:
                expected_dhan = "-"
            
            dhan_sym = expected_dhan
            status = "<span style='color: red; font-weight: bold;'>Not Found (Expired) ❌</span>"
    else:
        dhan_sym = "-"
        status = "<span style='color: orange; font-weight: bold;'>Invalid Format ⚠️</span>"
        
    results.append({
        'Zerodha Symbol': symbol,
        'Dhan Symbol': dhan_sym,
        'Status': status
    })

# Generate HTML
html = '''
<!DOCTYPE html>
<html>
<head>
<title>Zerodha to Dhan Symbol Mapping</title>
<style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background-color: #f4f4f9; }
    h2 { color: #333; text-align: center; margin-bottom: 5px; }
    p.subtitle { text-align: center; color: #666; margin-bottom: 30px; }
    .container { max-width: 900px; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; background-color: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #1e293b; color: white; text-transform: uppercase; font-size: 14px; letter-spacing: 0.05em; }
    tr:nth-child(even) { background-color: #f8fafc; }
    tr:hover { background-color: #e2e8f0; transition: background-color 0.2s ease; }
    td { font-size: 15px; color: #334155; }
    .status-tag { padding: 4px 8px; border-radius: 4px; font-size: 13px; background: #eee; display: inline-block; }
</style>
</head>
<body>
<div class="container">
    <h2>Zerodha vs Dhan Symbol Mapping</h2>
    <p class="subtitle">Tradebook Contracts (April 2026) vs Dhan Master API</p>
    <table>
        <tr>
            <th>Zerodha Symbol (Tradebook)</th>
            <th>Expected Dhan Symbol</th>
            <th>Match in Current Dhan Master</th>
        </tr>
'''

for r in results:
    html += f"<tr><td><strong>{r['Zerodha Symbol']}</strong></td><td>{r['Dhan Symbol']}</td><td><span class='status-tag'>{r['Status']}</span></td></tr>\n"

html += '''
    </table>
</div>
</body>
</html>
'''

with open('C:\\Users\\arsal\\Desktop\\New folder (2)\\TEMP\\symbol_mapping.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("HTML generated successfully at symbol_mapping.html")
