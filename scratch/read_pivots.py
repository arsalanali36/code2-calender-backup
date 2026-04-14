import pandas as pd
import os

file_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\PINE SCRIPTS\PIVOT LEVELS.xlsx'
if os.path.exists(file_path):
    try:
        xl = pd.ExcelFile(file_path)
        for sheet_name in xl.sheet_names:
            print(f"--- Sheet: {sheet_name} ---")
            df = xl.parse(sheet_name)
            print(df.to_string())
            print("\n")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found.")
