
import pandas as pd
import os

MASTER = "data/dhan_scrip_master.csv"
if os.path.exists(MASTER):
    df = pd.read_csv(MASTER, low_memory=False)
    # Search for INDEX segment items with NIFTY in symbol name
    matches = df[(df['SEM_SEGMENT'] == 'I') & (df['SM_SYMBOL_NAME'].str.contains('NIFTY', na=False))]
    print("Potential Nifty matches in INDEX segment:")
    print(matches[['SEM_SMST_SECURITY_ID', 'SEM_SEGMENT', 'SM_SYMBOL_NAME']])
else:
    print("Master not found.")
