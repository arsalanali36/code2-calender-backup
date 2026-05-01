import pandas as pd
import json
import re

file_path = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\tradebook-VH2762-FO.csv'
df = pd.read_csv(file_path)

# Ensure expiry_date is string
df['expiry_date'] = pd.to_datetime(df['expiry_date'], errors='coerce').dt.strftime('%Y-%m-%d')
# We need to find all unique instruments across the entire tradebook
unique_trades = df[['symbol', 'expiry_date']].drop_duplicates().reset_index(drop=True)

tasks_dict = {}
months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

html_out = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\download_tracker.html'
html = """
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 40px; color: #1e293b; }
        h2 { color: #0f172a; }
        table { border-collapse: collapse; width: 100%; max-width: 1000px; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background-color: #1e293b; font-weight: 600; color: #ffffff; }
        tr:hover { background-color: #f8fafc; }
        .tag-z { display: inline-block; background: #fee2e2; color: #991b1b; padding: 6px 10px; border-radius: 4px; font-size: 14px; font-weight: 600; border: 1px solid #fca5a5; }
        .tag-d { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 6px 10px; border-radius: 4px; font-size: 14px; font-weight: 600; border: 1px solid #7dd3fc; }
        .status-pending { background: #fef3c7; color: #b45309; padding: 6px 10px; border-radius: 4px; font-size: 13px; font-weight: bold; border: 1px solid #fde68a; }
        .status-done { background: #dcfce7; color: #15803d; padding: 6px 10px; border-radius: 4px; font-size: 13px; font-weight: bold; border: 1px solid #bbf7d0; }
    </style>
</head>
<body>
    <h2>Historical Options Data Download Tracker</h2>
    <p>Ye live tracker hai. Jaise-jaise script "Whole Week" ka saaf data download karke CSV banayegi, ye status update hota jayega!</p>
    <table>
        <tr>
            <th>Zerodha Instrument</th>
            <th>Dhan Instrument Mapping</th>
            <th style="width: 250px;">Download Status</th>
        </tr>
"""

tasks = []

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
            
            tasks.append({
                "zerodha_symbol": symbol,
                "dhan_name": expected_dhan,
                "underlying": underlying,
                "strike": strike,
                "option_type": opt_type,
                "expiry_date": expiry_date,
                "html_id": symbol
            })
        except:
            pass
            
    html += f"""
        <tr id='row-{symbol}'>
            <td><span class='tag-z'>{symbol}</span></td>
            <td><span class='tag-d'>{expected_dhan}</span></td>
            <td><span id='status-{symbol}' class='status-pending'>⏳ Pending (In Queue)</span></td>
        </tr>
    """

html += """
    </table>
    
    <!-- Script block to auto-refresh while the downloader is running in the background -->
    <script>
        setTimeout(function(){
            location.reload();
        }, 5000);
    </script>
</body>
</html>
"""

with open(html_out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f"Saved HTML Tracker to {html_out}")

json_out = r'C:\Users\arsal\Desktop\New folder (2)\TEMP\unique_tasks.json'
with open(json_out, 'w', encoding='utf-8') as f:
    json.dump(tasks, f, indent=4)
print(f"Saved unique tasks JSON to {json_out}")
