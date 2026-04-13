from flask import Blueprint, request, jsonify
from services.strategy_service import get_nifty_data, run_arsalan_continuation
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
        if df.empty:
             return jsonify({'error': 'No data found for the selected range.'}), 404
        
        # Format for Lightweight Charts
        chart_data = []
        df = df.reset_index()
        time_col = 'Datetime' if 'Datetime' in df.columns else 'Date'
        
        prev_time = None
        for idx, row in df.iterrows():
            curr_time = int(row[time_col].timestamp())
            
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
                'ema10': float(row['ema10']),
                'ema20': float(row['ema20']),
                'dema100': float(row['dema100']),
                'is_buy': bool(row['buy_signal']),
                'is_sell': bool(row['sell_signal'])
            }
            chart_data.append(item)
            prev_time = curr_time
            
        return jsonify({
            'chart_data': chart_data,
            'zones': zones
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
