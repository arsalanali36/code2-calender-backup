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
    strategy = request.args.get('strategy', 'Arsalan Continuation')
    hawa_me_zone = request.args.get('hawa_me_zone', 'false').lower() == 'true'
    strategy_params = {'hawa_me_zone': hawa_me_zone}
    
    try:
        df, zones = get_nifty_data(symbol, start_date, end_date, timeframe, start_time, end_time, source=source, dhan_token=dhan_token, dhan_cid=dhan_cid, strategy_type=strategy, strategy_params=strategy_params)
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
                # Terminate exactly 1 minute after previous day closes
                gap_time = prev_time + 60
                gap_item = {
                    'time': gap_time,
                    'ema10': None, 'ema20': None, 'dema100': None,
                    'is_gap': True
                }
                # Add Sandbox level keys to gap to terminate lines
                sandbox_keys = ['pdh', 'pdl', 'pdc', 'pp', 'r1', 'r2', 'r3', 'r4', 'r5', 's1', 's2', 's3', 's4', 's5']
                for k in sandbox_keys:
                    gap_item[k] = None
                chart_data.append(gap_item)

            item = {
                'time': curr_time,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'ema10': float(row['ema10']) if pd.notnull(row['ema10']) else None,
                'ema20': float(row['ema20']) if pd.notnull(row['ema20']) else None,
                'is_gap': is_gap,
                # Sandbox Levels
                'pdh': float(row['pdh']) if 'pdh' in row and pd.notnull(row['pdh']) else None,
                'pdl': float(row['pdl']) if 'pdl' in row and pd.notnull(row['pdl']) else None,
                'pdc': float(row['pdc']) if 'pdc' in row and pd.notnull(row['pdc']) else None,
                'pp': float(row['pp']) if 'pp' in row and pd.notnull(row['pp']) else None,
                'r1': float(row['r1']) if 'r1' in row and pd.notnull(row['r1']) else None,
                's1': float(row['s1']) if 's1' in row and pd.notnull(row['s1']) else None,
                'r2': float(row['r2']) if 'r2' in row and pd.notnull(row['r2']) else None,
                's2': float(row['s2']) if 's2' in row and pd.notnull(row['s2']) else None,
                'r3': float(row['r3']) if 'r3' in row and pd.notnull(row['r3']) else None,
                's3': float(row['s3']) if 's3' in row and pd.notnull(row['s3']) else None,
                'r4': float(row['r4']) if 'r4' in row and pd.notnull(row['r4']) else None,
                's4': float(row['s4']) if 's4' in row and pd.notnull(row['s4']) else None,
                'r5': float(row['r5']) if 'r5' in row and pd.notnull(row['r5']) else None,
                's5': float(row['s5']) if 's5' in row and pd.notnull(row['s5']) else None,
                # Pattern Flags
                'green_hammer': bool(row['green_hammer']) if 'green_hammer' in row else False,
                'red_hammer': bool(row['red_hammer']) if 'red_hammer' in row else False,
                'inv_red_hammer': bool(row['inv_red_hammer']) if 'inv_red_hammer' in row else False,
                'bull_engulf': bool(row['bull_engulf']) if 'bull_engulf' in row else False,
                'bear_engulf': bool(row['bear_engulf']) if 'bear_engulf' in row else False,
                'morning_star': bool(row['morning_star']) if 'morning_star' in row else False,
                'evening_star': bool(row['evening_star']) if 'evening_star' in row else False,
                'bull_harami': bool(row['bull_harami']) if 'bull_harami' in row else False,
                'bear_harami': bool(row['bear_harami']) if 'bear_harami' in row else False,
                'bar_color': row['bar_color'] if 'bar_color' in row and pd.notnull(row['bar_color']) else None
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
