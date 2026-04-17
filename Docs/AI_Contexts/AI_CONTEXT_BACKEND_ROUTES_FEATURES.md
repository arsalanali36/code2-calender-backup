# Backend - Feature Routes (auth, csvlog, strategy)
Consolidated code context for AI assistants.


## File: `routes/auth_routes.py`
```py
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User
from services.auth_service import migrate_default_data_for_first_user
from extensions import limiter

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
@limiter.limit('10 per minute')
def login():
    if current_user.is_authenticated:
        return redirect(url_for('page.index'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=True)
            return redirect(url_for('page.index'))
        else:
            flash('Invalid email or password', 'error')

    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('page.index'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not email or not password:
            flash('Email and password are required', 'error')
            return redirect(url_for('auth.register'))
            
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return redirect(url_for('auth.register'))
            
        user_exists = User.query.filter_by(email=email).first()
        if user_exists:
            flash('Email already registered', 'error')
            return redirect(url_for('auth.register'))
            
        new_user = User(email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        migrate_default_data_for_first_user(new_user.id)

        login_user(new_user, remember=True)
        return redirect(url_for('page.index'))

    return render_template('register.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@auth_bp.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if current_user.is_authenticated:
         return redirect(url_for('page.index'))

    if request.method == 'POST':
        email = request.form.get('email')
        new_password = request.form.get('new_password')
        confirm = request.form.get('confirm_password')

        if not email or not new_password:
            flash('Email and new password are required.', 'error')
            return redirect(url_for('auth.reset_password'))

        if new_password != confirm:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('auth.reset_password'))
            
        user = User.query.filter_by(email=email).first()
        if not user:
            flash('Email not found. Please register.', 'error')
            return redirect(url_for('auth.reset_password'))

        user.set_password(new_password)
        db.session.commit()
        
        flash('Password updated successfully. You can now log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('reset_password.html')

```

## File: `routes/csvlog_routes.py`
```py
"""
routes/csvlog_routes.py
-----------------------
Routes for CSVLog schema management.
  GET  /api/csvlog-schema         → return parsed schema JSON
  POST /api/csvlog-upload-schema  → accept .xlsx upload, save, return schema
"""
import os
from flask import Blueprint, request, jsonify, send_file
from flask_login import current_user
from services.csvlog_service import load_schema, export_csvlog_excel, generate_logger_template
from services.trade_service import get_all_trades
from config import CSVLOG_SCHEMA_FILE

csvlog_bp = Blueprint('csvlog', __name__)


@csvlog_bp.route('/api/csvlog-schema', methods=['GET'])
def get_schema():
    schema = load_schema(CSVLOG_SCHEMA_FILE)
    if schema is None:
        return jsonify({'error': 'no_file'}), 404
    if 'error' in schema:
        return jsonify({'error': schema['error']}), 500
    return jsonify(schema)


@csvlog_bp.route('/api/csvlog-upload-schema', methods=['POST'])
def upload_schema():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    f = request.files['file']
    if not f.filename.lower().endswith('.xlsx'):
        return jsonify({'error': 'Only .xlsx files are accepted'}), 400

    os.makedirs(os.path.dirname(CSVLOG_SCHEMA_FILE), exist_ok=True)
    f.save(CSVLOG_SCHEMA_FILE)

    schema = load_schema(CSVLOG_SCHEMA_FILE)
    if schema is None or 'error' in schema:
        msg = schema['error'] if schema else 'Parse failed'
        return jsonify({'error': msg}), 500

    return jsonify({'ok': True, 'schema': schema})


@csvlog_bp.route('/api/csvlog-download-schema', methods=['GET'])
def download_schema():
    if not os.path.exists(CSVLOG_SCHEMA_FILE):
        return jsonify({'error': 'no_file'}), 404
    return send_file(CSVLOG_SCHEMA_FILE, as_attachment=True,
                     download_name='LOGGER_schema.xlsx')


@csvlog_bp.route('/api/csvlog-download-template', methods=['GET'])
def download_template():
    """Download a protected LOGGER.xlsx template (preserves existing schema + adds Body Vitals)."""
    out, err = generate_logger_template(CSVLOG_SCHEMA_FILE)
    if err:
        return jsonify({'error': err}), 500
    return send_file(out, as_attachment=True,
                     download_name='LOGGER_template.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@csvlog_bp.route('/api/csvlog-export', methods=['GET'])
def export_trades():
    user_id = current_user.id if current_user.is_authenticated else None
    data = get_all_trades(user_id=user_id)
    trades = data.get('trades', []) if isinstance(data, dict) else (data or [])
    out, err = export_csvlog_excel(trades, CSVLOG_SCHEMA_FILE)
    if err:
        return jsonify({'error': err}), 500
    return send_file(out, as_attachment=True,
                     download_name='csvlog_export.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

```

## File: `routes/strategy_routes.py`
```py
from flask import Blueprint, request, jsonify
from flask_login import current_user
from services.strategy_data_service import get_nifty_data, get_real_trades
import pandas as pd
import pytz
import calendar
import traceback
import os
import json

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
        user_id = current_user.id if current_user.is_authenticated else None
        df, zones, real_trades = get_nifty_data(symbol, start_date, end_date, timeframe, start_time, end_time, source=source, dhan_token=dhan_token, dhan_cid=dhan_cid, strategy_type=strategy, strategy_params=strategy_params, user_id=user_id)

        if df.empty:
             return jsonify({'error': 'No data found for the selected range.'}), 404
        
        chart_data = []
        df_reset = df.reset_index()
        time_col = 'Datetime' if 'Datetime' in df_reset.columns else 'Date'
        
        prev_time = None
        for idx, row in df_reset.iterrows():
            dt = row[time_col].replace(tzinfo=None)
            curr_time = calendar.timegm(dt.timetuple())
            
            item = {
                'time': curr_time,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'ema10': float(row['ema10']) if pd.notnull(row['ema10']) else None,
                'ema20': float(row['ema20']) if pd.notnull(row['ema20']) else None,
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
    from services.strategy_data_service import get_archive_dates
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        dates = get_archive_dates(user_id=user_id)
        return jsonify({'dates': dates})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@strategy_bp.route('/api/strategy/sync-tasks', methods=['GET'])
def get_sync_tasks_route():
    from services.dhan_service import get_sync_tasks
    s = request.args.get('start_date')
    e = request.args.get('end_date')
    tasks = get_sync_tasks(start_date=s, end_date=e)
    return jsonify(tasks)

@strategy_bp.route('/api/strategy/sync-single', methods=['POST'])
def sync_single_route():
    from services.dhan_service import sync_single_task
    data = request.json
    sym = data.get('symbol')
    dt = data.get('end_date') or data.get('date')
    cid = data.get('dhan_cid')
    token = data.get('dhan_token')
    
    if not sym or not dt: return jsonify({'error': 'missing params'}), 400
    try:
        config = None
        if cid and token:
            cid = str(cid).strip()
            token = str(token).strip()
            config = {'client_id': cid, 'access_token': token}
            # Masked logging for debugging
            masked = token[:6] + "..." + token[-4:] if len(token) > 10 else "***"
            print(f"DEBUG: Syncing {sym} on {dt} with CID: {cid} | Token: {masked}")

        res = sync_single_task(sym, dt, config=config)
        
        # Check if service returned a structured error
        if isinstance(res, dict) and res.get('status') == 'error':
            return jsonify(res), 200 # Return as 200 so UI can show the message

        synced = res.get('synced', 0)
        errors = res.get('errors', 0)
        return jsonify({'status': 'success', 'synced': synced, 'errors': errors})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@strategy_bp.route('/api/strategy/pivot-levels', methods=['GET'])
def get_pivot_levels():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Date is required"}), 400
    levels_path = os.path.join('data', 'daily_pivot_levels.json')
    if not os.path.exists(levels_path):
        return jsonify({})
    with open(levels_path, 'r', encoding='utf-8') as f:
        all_levels = json.load(f)
    return jsonify(all_levels.get(date_str, {}))

@strategy_bp.route('/api/strategy/pivot-levels', methods=['POST'])
def save_pivot_levels():
    data = request.json
    date_str = data.get('date')
    levels = data.get('levels')
    if not date_str or not levels:
        return jsonify({"error": "Date and levels are required"}), 400
    levels_path = os.path.join('data', 'daily_pivot_levels.json')
    if os.path.exists(levels_path):
        with open(levels_path, 'r', encoding='utf-8') as f:
            all_levels = json.load(f)
    else:
        all_levels = {}
    all_levels[date_str] = levels
    os.makedirs('data', exist_ok=True)
    with open(levels_path, 'w', encoding='utf-8') as f:
        json.dump(all_levels, f, indent=4)
    return jsonify({"status": "OK"})

@strategy_bp.route('/api/strategy/sync-status')
def sync_status():
    from services.auto_sync_service import get_sync_status
    return jsonify(get_sync_status())
@strategy_bp.route('/api/strategy/trigger-sync', methods=['POST'])
def trigger_sync():
    from services.auto_sync_service import trigger_sync_now
    trigger_sync_now()
    return jsonify({'status': 'OK'})

@strategy_bp.route('/api/strategy/bulk-dl-start', methods=['POST'])
def bulk_dl_start():
    from services.bulk_download_service import start_bulk_download
    data   = request.get_json(silent=True) or {}
    token  = data.get('token', '').strip()
    cid    = data.get('client_id', '').strip()
    if not token or not cid:
        return jsonify({'error': 'token and client_id required'}), 400
    started = start_bulk_download(token, cid)
    if not started:
        return jsonify({'error': 'Already running'}), 409
    return jsonify({'status': 'started'})

@strategy_bp.route('/api/strategy/bulk-dl-status')
def bulk_dl_status():
    from services.bulk_download_service import get_status
    return jsonify(get_status())

```
