from flask import Blueprint, request, jsonify
from services.strategy_service import get_nifty_data, run_arsalan_continuation, get_real_trades
import pandas as pd

strategy_bp = Blueprint('strategy', __name__)

@strategy_bp.route('/api/strategy/nifty-data')
def nifty_data():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    timeframe = request.args.get('timeframe', '5m')
    start_time = request.args.get('start_time', '09:15')
    end_time = request.args.get('end_time', '15:30')
    
    try:
        df, zones = get_nifty_data(start_date, end_date, timeframe, start_time, end_time)
        real_trades = get_real_trades(start_date, end_date)

        if df.empty:
             return jsonify({'error': 'No data found for the selected range.'}), 404
        
        # Format for Lightweight Charts
        chart_data = []
        df = df.reset_index()
        time_col = 'Datetime' if 'Datetime' in df.columns else 'Date'
        
        import pytz
        ist_tz = pytz.timezone('Asia/Kolkata')
        prev_time = None
        
        import calendar
        for idx, row in df.iterrows():
            # Treat naive IST as UTC for fixed display
            dt = row[time_col].replace(tzinfo=None)
            curr_time = calendar.timegm(dt.timetuple())
            
            # Detect day gap (>1 hour) to break line series
            if prev_time and (curr_time - prev_time > 3600):
                # Add a point with null value at 1 second before current trade to break the line
                chart_data.append({
                    'time': curr_time - 1,
                    'ema10': None, 'ema20': None, 'dema100': None,
                    'is_gap': True
                })

            item = {
                'time': curr_time,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'ema10': float(row['ema10']) if pd.notnull(row['ema10']) else None,
                'ema20': float(row['ema20']) if pd.notnull(row['ema20']) else None,
                'dema100': float(row['dema100']) if pd.notnull(row['dema100']) else None,
                'is_buy': bool(row['buy_signal']),
                'is_sell': bool(row['sell_signal'])
            }
            chart_data.append(item)
            prev_time = curr_time
            
        return jsonify({
            'chart_data': chart_data,
            'zones': zones,
            'real_trades': real_trades
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
