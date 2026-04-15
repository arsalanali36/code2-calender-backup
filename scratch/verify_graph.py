
import pandas as pd
import matplotlib.pyplot as plt
import os

csv_path = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\data\Historical_OHLC\Options\NIFTY2641323750CE.csv"
output_image = r"d:\KHAZANA\KHAZANA\PYTHON\CODE2- CALENDER\scratch\nifty_23750_verification.png"

if os.path.exists(csv_path):
    df = pd.read_csv(csv_path)
    df['datetime'] = pd.to_datetime(df['datetime'])
    
    # Filter for April 9 and 13 to show the clean data
    df_plot = df[df['datetime'].dt.strftime('%Y-%m-%d').isin(['2026-04-09', '2026-04-13'])]
    
    plt.figure(figsize=(15, 8))
    plt.plot(df_plot['datetime'], df_plot['close'], label='Close Price', color='blue', linewidth=1)
    plt.title('NIFTY2641323750CE - Verification Chart (April 9 & 13)')
    plt.xlabel('Datetime')
    plt.ylabel('Price')
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    # Highlight April 9
    plt.axvspan(pd.to_datetime('2026-04-09 09:15:00'), pd.to_datetime('2026-04-09 15:30:00'), color='green', alpha=0.1, label='April 9')
    # Highlight April 13
    plt.axvspan(pd.to_datetime('2026-04-13 09:15:00'), pd.to_datetime('2026-04-13 15:30:00'), color='orange', alpha=0.1, label='April 13')
    
    plt.savefig(output_image)
    print(f"Graph saved to: {output_image}")
else:
    print("CSV file not found.")
