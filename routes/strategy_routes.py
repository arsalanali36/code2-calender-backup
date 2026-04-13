from flask import Blueprint, request, jsonify
from services.strategy_service import get_nifty_data, get_real_trades
import pandas as pd
import pytz
import calendar
import traceback

strategy_bp = Blueprint('strategy', __name__)

@strategy_bp.route('/api/strategy/nifty-data')
def nifty_data():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    timeframe = request.args.get('timeframe', '5m')
    start_time = request.args.get('start_time', '09:15')
    end_time = request.args.get('end_time', '15:30')
    source = request.args.get('source', 'yfinance')
    dhan_token = request.args.get('dhan_token', '')
    dhan_cid = request.args.get('dhan_cid', '')
    symbol = request.args.get('symbol', 'Nifty 50 (^NSEI)')
    
    try:
        df, zones = get_nifty_data(symbol, start_date, end_date, timeframe, start_time, end_time, source=source, dhan_token=dhan_token, dhan_cid=dhan_cid)
        real_trades = get_real_trades(start_date, end_date, symbol)

        if df.empty:
             return jsonify({'error': 'No data found for the selected range.'}), 404
        
        chart_data = []
        df_reset = df.reset_index()
        time_col = 'Datetime' if 'Datetime' in df_reset.columns else 'Date'
        
        prev_time = None
        for idx, row in df_reset.iterrows():
            # Treat naive IST as UTC for fixed display
            dt = row[time_col].replace(tzinfo=None)
            curr_time = calendar.timegm(dt.timetuple())
            
            # Use the is_gap flag from service, or manual gap detection
            is_gap = row.get('is_gap', False)

            # Manual gap detection if no flag
            if not is_gap and prev_time and (curr_time - prev_time > 3600):
                is_gap = True

            if is_gap and prev_time:
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
                'is_gap': is_gap
            }
            chart_data.append(item)
            prev_time = curr_time
            
        return jsonify({
            'chart_data': chart_data,
            'zones': zones,
            'real_trades': real_trades
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@strategy_bp.route('/api/strategy/archive-dates')
def archive_dates():
    from services.strategy_service import get_archive_dates
    try:
        dates = get_archive_dates()
        return jsonify({'dates': dates})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@strategy_bp.route('/api/strategy/sync-tasks', methods=['GET'])
def get_sync_tasks_route():
    from services.dhan_service import get_sync_tasks
    s = request.args.get('start_date')
    e = request.args.get('end_date')
    print(f"DEBUG SYNC: Received start_date={s}, end_date={e}")
    tasks = get_sync_tasks(start_date=s, end_date=e)
    print(f"DEBUG SYNC: Returning {len(tasks)} tasks")
    return jsonify(tasks)

@strategy_bp.route('/api/strategy/sync-single', methods=['POST'])
def sync_single_route():
    from services.dhan_service import sync_single_task
    data = request.json
    sym = data.get('symbol')
    dt = data.get('end_date') or data.get('date') # Use the trade date
    
    # Pass session creds if provided
    cid = data.get('dhan_cid')
    token = data.get('dhan_token')
    
    if not sym or not dt: return jsonify({'error': 'missing params'}), 400
    try:
        config = None
        if cid and token:
            config = {'client_id': cid, 'access_token': token}
            
        synced, errors = sync_single_task(sym, dt, config=config)
        return jsonify({'status': 'success', 'synced': synced, 'errors': errors})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
