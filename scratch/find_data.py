import os

file_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\PINE SCRIPTS\April_13_Arsalan_Continuation.txt'
if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'BNF_R5' in line or 'NIFTY_R5' in line:
                print(f"Line {i+1}: {line.strip()}")
else:
    print("File not found.")
