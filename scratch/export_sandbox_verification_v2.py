import pandas as pd
import os
import sys

# Add the project root to path so we can import services
sys.path.append(r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER')

from services.strategy_service import get_nifty_data

def export_sandbox_csv():
    # Exporting for a broader range to show multi-day level matching
    start_date = "2026-04-01"
    end_date = "2026-04-14"
    
    print(f"Exporting NIFTY verification data from {start_date} to {end_date}...")
    
    # symbol matches what's expects in impl 'Nifty 50 (^NSEI)'
    df, zones = get_nifty_data(
        symbol='Nifty 50 (^NSEI)', 
        start_date=start_date, 
        end_date=end_date, 
        timeframe='1m', 
        source='dhan_local', 
        strategy_type='Arsalan Sandbox'
    )
    
    if df.empty:
        print("dhan_local is empty for this range, trying dhan_api...")
        df, zones = get_nifty_data(
            symbol='Nifty 50 (^NSEI)',
            start_date=start_date,
            end_date=end_date,
            timeframe='1m',
            source='dhan_api',
            strategy_type='Arsalan Sandbox'
        )

    if df.empty:
        print("No data found to export.")
        return

    # Keep only relevant columns for verification to keep CSV clean
    output_cols = [
        'Close', 'High', 'Low', 'Open',
        'pdh', 'pdl', 'pdc', 'pp', 
        'r1', 'r2', 's1', 's2', 
        'bull_trigger', 'bear_trigger'
    ]
    # Filter columns that actually exist
    existing_cols = [c for c in output_cols if c in df.columns]
    df_export = df[existing_cols]

    # Save to CSV
    output_path = r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\nifty_sandbox_verification_v2.csv'
    df_export.to_csv(output_path)
    print(f"Verification CSV v2 exported successfully to: {output_path}")

if __name__ == "__main__":
    export_sandbox_csv()
