import yfinance as yf
import pandas as pd
import os
from datetime import datetime, timedelta

OUTPUT_FILE = "data/nifty_1m_dhan.csv"

def rebuild_local_data():
    os.makedirs('data', exist_ok=True)
    # 60 days is the limit for 5m data on yfinance
    end_dt = datetime(2026, 4, 14)
    start_dt = end_dt - timedelta(days=59)
    
    print(f"Fetching unique 5m data from {start_dt.date()} to {end_dt.date()}...")
    
    df = yf.download("^NSEI", start=start_dt.strftime('%Y-%m-%d'), end=end_dt.strftime('%Y-%m-%d'), interval="5m")
    if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
    
    if not df.empty:
        df = df.reset_index()
        df = df.rename(columns={'Datetime': 'datetime', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume'})
        df.to_csv(OUTPUT_FILE, index=False)
        print(f"BINGO! Saved {len(df)} UNIQUE market candles to {OUTPUT_FILE}")
    else:
        print("Still failed to fetch unique data.")

if __name__ == "__main__":
    rebuild_local_data()
