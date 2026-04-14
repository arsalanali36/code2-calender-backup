import pandas as pd
import json
import datetime
import os

def parse_levels(path, output_path):
    try:
        df = pd.read_excel(path)
        result = {}
        pd_cols = ['PDH', 'PDC', 'PDL', 'R1', 'R2', 'R3', 'R4', 'R5', 'S1', 'S2', 'S3', 'S4', 'S5', 'CP']
        
        for _, row in df.iterrows():
            if pd.isnull(row['LEVELS']):
                continue
            
            # Convert timestamp (ms) to YYYY-MM-DD
            ts = row['LEVELS']
            # If it's a timestamp object already or ms
            if isinstance(ts, (int, float)):
                date_str = datetime.datetime.fromtimestamp(ts/1000.0).strftime('%Y-%m-%d')
            else:
                date_str = pd.to_datetime(ts).strftime('%Y-%m-%d')
                
            day_data = {}
            for col in pd_cols:
                val = row.get(col)
                if pd.notnull(val) and '=' in str(val):
                    try:
                        # Extract number after =
                        num_part = str(val).split('=')[1].strip()
                        day_data[col.lower()] = float(num_part)
                    except:
                        pass
                elif pd.notnull(val) and isinstance(val, (int, float)):
                    day_data[col.lower()] = float(val)
            
            if day_data:
                # Map 'cp' to 'pp' if needed for consistency in my code
                if 'cp' in day_data:
                    day_data['pp'] = day_data['cp']
                result[date_str] = day_data
        
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=4)
        print(f"Successfully converted {len(result)} days of levels.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    xlsx_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\PINE SCRIPTS\CLEAN PIVOT LEVELS (2).xlsx'
    json_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\data\daily_pivot_levels.json'
    parse_levels(xlsx_path, json_path)
