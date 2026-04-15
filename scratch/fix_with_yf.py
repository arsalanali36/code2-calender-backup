
import yfinance as yf
import pandas as pd
import os
from datetime import datetime

INDEX_PATH = "data/Historical_OHLC/nifty_1m_dhan.csv"
today = "2026-04-15"

print(f"Fetching NIFTY 50 for {today} from yfinance...")
# ^NSEI is Nifty 50
ticker = yf.Ticker("^NSEI")
# Fetch 1m data for today
df_yf = ticker.history(period="1d", interval="1m")

if not df_yf.empty:
    print(f"Success! Found {len(df_yf)} candles from yfinance.")
    
    # Format to match nifty_1m_dhan.csv: datetime,open,high,low,close,volume
    df_yf = df_yf.reset_index()
    df_yf['datetime'] = df_yf['Datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    df_yf = df_yf[['datetime', 'Open', 'High', 'Low', 'Close', 'Volume']]
    df_yf.columns = ['datetime', 'open', 'high', 'low', 'close', 'volume']
    
    # Open original file
    if os.path.exists(INDEX_PATH):
        df_old = pd.read_csv(INDEX_PATH)
        # Convert to datetime for safe filtering
        df_old['dt_obj'] = pd.to_datetime(df_old['datetime'])
        # Kill everything for 15 April
        df_old = df_old[df_old['dt_obj'].dt.strftime('%Y-%m-%d') != today]
        df_old = df_old.drop(columns=['dt_obj'])
        
        # Merge
        df_final = pd.concat([df_old, df_yf]).drop_duplicates('datetime').sort_values('datetime')
        df_final.to_csv(INDEX_PATH, index=False)
        print(f"Dashboard Update Complete: Accurate Nifty candles saved.")
    else:
        df_yf.to_csv(INDEX_PATH, index=False)
else:
    print("Failed to fetch from yfinance.")
