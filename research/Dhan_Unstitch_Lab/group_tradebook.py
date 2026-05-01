import pandas as pd
import json
import re

file_path = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\tradebook-VH2762-FO.csv'
df = pd.read_csv(file_path)

# Ensure trade_date is string
df['trade_date'] = pd.to_datetime(df['trade_date'], errors='coerce').dt.strftime('%Y-%m-%d')
# Ensure expiry_date is string
df['expiry_date'] = pd.to_datetime(df['expiry_date'], errors='coerce').dt.strftime('%Y-%m-%d')

# Group by trade_date
grouped = df.groupby('trade_date')

tasks_dict = {}

html_out = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\daywise_report.html'
html = """
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 40px; color: #1e293b; }
        h2 { color: #0f172a; }
        table { border-collapse: collapse; width: 100%; max-width: 900px; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background-color: #1e293b; font-weight: 600; color: #ffffff; }
        tr:hover { background-color: #f8fafc; }
        .tag-z { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 13px; margin: 2px 4px 2px 0; font-weight: 500; border: 1px solid #fca5a5; }
        .tag-d { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-size: 13px; margin: 2px 4px 2px 0; font-weight: 500; border: 1px solid #7dd3fc; }
        .arrow { color: #94a3b8; font-weight: bold; margin-right: 4px; }
        .instrument-row { margin-bottom: 6px; }
    </style>
</head>
<body>
    <h2>Day-Wise Traded Instruments (Zerodha ➔ Dhan Match)</h2>
    <p>Ye list aapke batch-processor/unstitching algorithm ke liye banayi gayi hai. Isme Zerodha ke symbols ko Dhan ke exact readable format me convert kar diya gaya hai.</p>
    <table>
        <tr>
            <th style="width: 150px;">Trade Date</th>
            <th>Instruments (Zerodha ➔ Dhan Name)</th>
        </tr>
"""

months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

for date_str, group in grouped:
    # Get unique combinations of symbol and expiry_date
    unique_trades = group[['symbol', 'expiry_date']].drop_duplicates()
    
    tasks_dict[date_str] = []
    
    tags_html = ""
    for _, row in unique_trades.iterrows():
        symbol = row['symbol']
        expiry_date = str(row['expiry_date'])
        
        match = re.search(r'^([A-Z]+).*?(\d+)(CE|PE)$', symbol)
        expected_dhan = "-"
        if match and '-' in expiry_date:
            underlying = match.group(1)
            strike = int(match.group(2))
            opt_type = 'CALL' if match.group(3) == 'CE' else 'PUT'
            
            try:
                y, m, d = expiry_date.split('-')
                month_str = months[int(m)-1]
                expected_dhan = f"{underlying} {d} {month_str} {strike} {opt_type}"
                
                # Add to sync tasks JSON payload format
                tasks_dict[date_str].append({
                    "zerodha_symbol": symbol,
                    "dhan_name": expected_dhan,
                    "underlying": underlying,
                    "strike": strike,
                    "option_type": opt_type,
                    "expiry_date": expiry_date
                })
            except:
                pass
        
        tags_html += f"<div class='instrument-row'><span class='tag-z'>{symbol}</span> <span class='arrow'>➔</span> <span class='tag-d'>{expected_dhan}</span></div>"
        
    html += f"<tr><td><b>{date_str}</b></td><td>{tags_html}</td></tr>\n"

html += """
    </table>
</body>
</html>
"""

with open(html_out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f"Saved HTML report to {html_out}")

json_out = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\sync_tasks.json'
with open(json_out, 'w', encoding='utf-8') as f:
    json.dump(tasks_dict, f, indent=4)
print(f"Saved tasks JSON to {json_out}")
