import yfinance as yf
import pandas as pd
import os
from datetime import datetime, timedelta

OUTPUT_FILE = "data/nifty_1m_dhan.csv"

def repair_archive():
    if not os.path.exists(OUTPUT_FILE): return
    df = pd.read_csv(OUTPUT_FILE)
    df['datetime'] = pd.to_datetime(df['datetime']).dt.tz_localize(None)
    
    end_dt = datetime.now()
    # Fetch TRUE 1m for last 7 days from yfinance
    print("Repairing: Fetching 1m data for last 7 days...")
    yf1 = yf.download("^NSEI", start=(end_dt - timedelta(days=7)).strftime('%Y-%m-%d'), end=end_dt.strftime('%Y-%m-%d'), interval="1m")
    if not yf1.empty:
        if isinstance(yf1.columns, pd.MultiIndex): yf1.columns = yf1.columns.get_level_values(0)
        yf1 = yf1.reset_index().rename(columns={'Datetime': 'datetime', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume', 'Date': 'datetime'})
        yf1['datetime'] = pd.to_datetime(yf1['datetime']).dt.tz_localize(None)
        
        # Merge: If timestamp exists in yf1, use yf1 (it's 1m). Else keep original.
        df['res'] = 5
        yf1['res'] = 1
        combined = pd.concat([df, yf1]).sort_values(['datetime', 'res'])
        # Keep 1 if available
        final_df = combined.drop_duplicates(subset=['datetime'], keep='last').sort_values('datetime')
        final_df.drop(columns=['res']).to_csv(OUTPUT_FILE, index=False)
        print("BINGO! 9-10 April High-Res resolution restored.")

if __name__ == "__main__":
    repair_archive()
