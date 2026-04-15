
import pandas as pd
import os

MASTER = "data/dhan_scrip_master.csv"
if os.path.exists(MASTER):
    df = pd.read_csv(MASTER, low_memory=False)
    # Search for NIFTY 50 exactly in SM_SYMBOL_NAME or SEM_CUSTOM_SYMBOL
    matches = df[df['SM_SYMBOL_NAME'].str.contains('NIFTY 50', na=False) & (df['SEM_INSTRUMENT_NAME'] == 'INDEX')]
    print("Potential Nifty 50 matches:")
    print(matches[['SEM_SMST_SECURITY_ID', 'SEM_SEGMENT', 'SEM_INSTRUMENT_NAME', 'SM_SYMBOL_NAME']])
else:
    print("Master not found.")
