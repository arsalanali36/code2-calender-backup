
import os
import pandas as pd
import json
from datetime import datetime, timedelta

DATA_DIR = "data/Historical_OHLC/Options/"
today_str = datetime.now().strftime('%Y-%m-%d')

def get_today_data(symbol):
    """Try to find today's data in the CSV to use as a signature for ghosts."""
    csv_path = os.path.join(DATA_DIR, f"{symbol}.csv")
    if not os.path.exists(csv_path): return None
    try:
        df = pd.read_csv(csv_path)
        df['date'] = df['datetime'].str.slice(0, 10)
        today_candles = df[df['date'] == today_str]
        if not today_candles.empty:
            return {
                'open': today_candles['open'].iloc[0],
                'mean': today_candles['close'].mean(),
                'len': len(today_candles)
            }
    except: pass
    return None

def scan_and_clean():
    files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
    print(f"GHOST BUSTER: Scanning {len(files)} instruments...")
    
    total_cleaned = 0
    
    for f in files:
        symbol = f.replace('.csv', '')
        csv_path = os.path.join(DATA_DIR, f)
        
        signature = get_today_data(symbol)
        if not signature: continue
        
        try:
            df = pd.read_csv(csv_path)
            df['date'] = df['datetime'].str.slice(0, 10)
            
            # Find all dates in this file
            unique_dates = df['date'].unique()
            bad_dates = []
            
            for d in unique_dates:
                if d == today_str: continue # Skip comparing today with itself
                
                day_data = df[df['date'] == d]
                # DETECTION: If average price matches today's avg price closely, it's a ghost
                day_mean = day_data['close'].mean()
                if abs(day_mean - signature['mean']) < 0.1 and abs(day_data['open'].iloc[0] - signature['open']) < 0.1:
                    bad_dates.append(d)
            
            if bad_dates:
                print(f"   [!] Found {len(bad_dates)} ghost dates in {symbol}: {bad_dates}")
                # Remove them
                df = df[~df['date'].isin(bad_dates)]
                df.drop(columns=['date']).to_csv(csv_path, index=False)
                total_cleaned += len(bad_dates)
                
        except Exception as e:
            print(f"   Error scanning {symbol}: {e}")

    print(f"\nCLEANUP COMPLETE: Purged {total_cleaned} ghost sessions from archive.")
    print("Background worker will now automatically refetch the missing (and now clean) dates.")

if __name__ == "__main__":
    scan_and_clean()
