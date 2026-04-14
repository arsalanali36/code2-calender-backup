import pandas as pd
import json
import os
import re
from datetime import datetime

def parse_cleaned_pivots():
    csv_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\PINE SCRIPTS\CLEAN PIVOT LEVELS - Sheet1.csv'
    if not os.path.exists(csv_path):
        print("CSV file not found.")
        return

    # Read CSV. It's a bit irregular so we'll read it line by line
    with open(csv_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    if not lines:
        print("Empty file.")
        return

    # Headers (Dates) are in the first row
    date_headers = lines[0].strip().split(',')
    
    # Initialize the data structure
    pivots_by_date = {}

    # Map keys from the strings
    key_map = {
        'NIFTY_PD_H': 'pdh',
        'NIFTY_PD_L': 'pdl',
        'NIFTY_PD_C': 'pdc',
        'NIFTY_CP': 'pp',
        'NIFTY_R1': 'r1', 'NIFTY_R2': 'r2', 'NIFTY_R3': 'r3', 'NIFTY_R4': 'r4', 'NIFTY_R5': 'r5',
        'NIFTY_S1': 's1', 'NIFTY_S2': 's2', 'NIFTY_S3': 's3', 'NIFTY_S4': 's4', 'NIFTY_S5': 's5'
    }

    # Process each row (skipping Row 1 and Row 5 which seems to be empty commas)
    for row_idx in range(1, len(lines)):
        row_content = lines[row_idx].strip()
        if not row_content or row_content.replace(',', '') == '':
            continue
            
        cells = row_content.split(',')
        for col_idx, cell in enumerate(cells):
            if col_idx >= len(date_headers):
                continue
            
            raw_date = date_headers[col_idx].strip()
            if not raw_date:
                continue

            # Parse signal: NIFTY_PD_H=25151.1 or NIFTY_PD_H = 24868.6
            match = re.match(r'(\w+)\s*=\s*([\d\.]+)', cell.strip())
            if match:
                var_name = match.group(1)
                value = float(match.group(2))
                
                if var_name in key_map:
                    # Convert date to YYYY-MM-DD
                    # Format: Jul 15 Tue -> 2025-07-15?
                    # Format: Jan 01 Thu -> 2026-01-01?
                    # We'll try to infer the year based on month sequence.
                    # Start is July (2025). If it crosses Jan, it becomes 2026.
                    month_str = raw_date.split(' ')[0]
                    day_val = raw_date.split(' ')[1]
                    
                    # Mapping month to number
                    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                    month_num = months.index(month_str) + 1
                    
                    # Heuristic for year: 
                    # If month is Jul-Dec, assume 2025. If Jan-Apr, assume 2026.
                    year = 2025 if month_num >= 7 else 2026
                    
                    formatted_date = f"{year}-{month_num:02d}-{int(day_val):02d}"
                    
                    if formatted_date not in pivots_by_date:
                        pivots_by_date[formatted_date] = {}
                    
                    pivots_by_date[formatted_date][key_map[var_name]] = value

    # Save to manual_pivots.json
    json_output = {"NIFTY": pivots_by_date}
    
    json_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\data\manual_pivots.json'
    with open(json_path, 'w') as f:
        json.dump(json_output, f, indent=4)
    
    print(f"Successfully processed {len(pivots_by_date)} dates and saved to {json_path}")

if __name__ == "__main__":
    parse_cleaned_pivots()
