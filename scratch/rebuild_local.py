import yfinance as yf
import pandas as pd
import os
from datetime import datetime, timedelta

OUTPUT_FILE = "data/nifty_1m_dhan.csv"

def rebuild_local_data():
    os.makedirs('data', exist_ok=True)
    # yfinance limit for 1m data is 7 days
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=6)
    
    # Load existing data to preserve it
    existing_df = pd.DataFrame()
    if os.path.exists(OUTPUT_FILE):
        try:
            existing_df = pd.read_csv(OUTPUT_FILE)
            existing_df['datetime'] = pd.to_datetime(existing_df['datetime'])
        except: pass

    df = yf.download("^NSEI", start=start_dt.strftime('%Y-%m-%d'), end=end_dt.strftime('%Y-%m-%d'), interval="1m")
    if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
    
    if not df.empty:
        df = df.reset_index()
        df = df.rename(columns={'Datetime': 'datetime', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume'})
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        # Merge and drop duplicates to keep it permanent
        final_df = pd.concat([existing_df, df]).drop_duplicates(subset=['datetime']).sort_values('datetime')
        
        final_df.to_csv(OUTPUT_FILE, index=False)
        print(f"BINGO! Total archive size: {len(final_df)} UNIQUE market candles in {OUTPUT_FILE}")
    else:
        print("Failed to fetch new data, archive preserved.")

if __name__ == "__main__":
    rebuild_local_data()
