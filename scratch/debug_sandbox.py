import pandas as pd
import numpy as np
import os
import json
import sys

# Add project root
sys.path.append(r'D:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER')

from services.strategy_service import get_nifty_data

def debug_sandbox_values():
    df, zones = get_nifty_data(
        symbol='Nifty 50 (^NSEI)', 
        start_date='2026-04-10', 
        end_date='2026-04-14', 
        timeframe='1m', 
        source='dhan_local', 
        strategy_type='Arsalan Sandbox'
    )
    
    # Check if any level is 0
    levels = ['pdh', 'pdl', 'pdc', 'pp', 'r1', 's1', 'r2', 's2', 'r3', 's3', 'r4', 's4', 'r5', 's5']
    for l in levels:
        zeros = (df[l] == 0).sum()
        nans = df[l].isnull().sum()
        vals = df[l].notnull().sum()
        print(f"Level {l:4}: {vals:5} non-null, {nans:5} nans, {zeros:5} zeros")
        if vals > 0:
            print(f"      Sample: {df[l].dropna().iloc[0]}")

if __name__ == "__main__":
    debug_sandbox_values()
