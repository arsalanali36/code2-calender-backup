import pandas as pd
import os
import sys

# Add the project root to path so we can import services
sys.path.append(r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER')

from services.strategy_service import get_nifty_data

def export_sandbox_csv():
    # Use Arsalan Sandbox strategy type
    # Using April 10 to April 14, 2026 as the range (matches user's screenshots)
    start_date = "2026-04-10"
    end_date = "2026-04-14"
    
    print(f"Fetching data for NIFTY from {start_date} to {end_date}...")
    
    # symbol matches what's expects in impl 'Nifty 50 (^NSEI)' or we can try 'Nifty'
    df, zones = get_nifty_data(
        symbol='Nifty 50 (^NSEI)', 
        start_date=start_date, 
        end_date=end_date, 
        timeframe='1m', 
        source='dhan_local', 
        strategy_type='Arsalan Sandbox'
    )
    
    if df.empty:
        print("No data found from dhan_local, trying yfinance...")
        df, zones = get_nifty_data(
            symbol='Nifty 50 (^NSEI)', 
            start_date=start_date, 
            end_date=end_date, 
            timeframe='1m', 
            source='yfinance', 
            strategy_type='Arsalan Sandbox'
        )

    if df.empty:
        print("No data found to export.")
        return

    # Add signal columns if they exist
    # (The sandbox logic adds bull_trigger and bear_trigger columns)
    
    # Save to CSV
    output_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\nifty_sandbox_verification.csv'
    df.to_csv(output_path)
    print(f"File exported successfully to: {output_path}")

if __name__ == "__main__":
    export_sandbox_csv()
