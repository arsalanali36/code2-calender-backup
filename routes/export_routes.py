"""
routes/export_routes.py
-----------------------
API routes for all export variants: Excel, structured CSV,
logger Excel, and full backup ZIP.
"""
import io
import os
import re
import json
import shutil
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file

from services.export_service import (
    export_simple_excel, export_structured_csv,
    export_logger_excel, build_backup_zip,
)
from config import DATA_FILE, UPLOADS_DIR, ADMIN_API_KEY, DEBUG

export_bp = Blueprint('export', __name__)


@export_bp.route('/api/backup', methods=['GET'])
def backup():
    if not os.path.exists(DATA_FILE):
        return jsonify({'error': 'No data to backup'}), 404
    requested_name = str(request.args.get('name', '')).strip()
    safe_name = re.sub(r'[^A-Za-z0-9_\ -]+', '', requested_name).strip()
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = safe_name if safe_name else f'trading_journal_{timestamp_str}'
    zip_bytes, _ = build_backup_zip(DATA_FILE, UPLOADS_DIR)
    return send_file(
        io.BytesIO(zip_bytes),
        as_attachment=True,
        download_name=f'{base_name}.zip',
        mimetype='application/zip',
    )


@export_bp.route('/api/export-excel', methods=['POST'])
def export_excel():
    data = request.json or {}
    trades  = data.get('trades', [])
    columns = data.get('columns', [])
    if not trades:
        return jsonify({'error': 'No data to export'}), 400
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    return send_file(
        export_simple_excel(trades, columns),
        as_attachment=True,
        download_name=f'trading_journal_{timestamp_str}.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


@export_bp.route('/api/export-structured-csv', methods=['POST'])
def export_structured_csv_route():
    data = request.json or {}
    trades   = data.get('trades', [])
    req_cols = data.get('columns', [])
    if not trades:
        return jsonify({'error': 'No data to export'}), 400
    return send_file(
        export_structured_csv(trades, req_cols),
        as_attachment=True,
        download_name='structured_trades.csv',
        mimetype='text/csv',
    )


@export_bp.route('/api/export-logger-excel', methods=['POST'])
def export_logger_excel_route():
    data = request.json or {}
    trades = data.get('trades', [])
    if not trades:
        return jsonify({'error': 'No data to export'}), 400
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    return send_file(
        export_logger_excel(trades),
        as_attachment=True,
        download_name=f'trade_logger_export_{timestamp_str}.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


@export_bp.route('/api/admin/get-data', methods=['GET'])
def admin_get_data():
    """API-key-protected: returns full trades JSON for live→localhost sync."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = request.args.get('user_id', None)
    if user_id is not None:
        try:
            user_id = int(user_id)
        except ValueError:
            return jsonify({'error': 'Invalid user_id'}), 400
    try:
        from processors.data_processors import get_user_data_file
        data_file = get_user_data_file(user_id)
        if not os.path.exists(data_file):
            return jsonify({'error': 'Data file not found'}), 404
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({'ok': True, 'data': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


LIVE_URL = 'https://code2-calender.onrender.com'


@export_bp.route('/api/admin/data-version', methods=['GET'])
def admin_data_version():
    """API-key-protected: returns file mtime + trade count for sync comparison."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        if not os.path.exists(DATA_FILE):
            return jsonify({'ok': True, 'updated_at': None, 'trades': 0})
        mtime = os.path.getmtime(DATA_FILE)
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({'ok': True, 'updated_at': mtime, 'trades': len(data.get('trades', []))})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/api/sync/status', methods=['GET'])
def sync_status():
    """Localhost-only: compare local vs live data version, return sync direction."""
    if not DEBUG:
        return jsonify({'error': 'Only available in development mode'}), 403
    if not ADMIN_API_KEY:
        return jsonify({'ok': False, 'error': 'ADMIN_API_KEY not set'}), 500

    local_ts = os.path.getmtime(DATA_FILE) if os.path.exists(DATA_FILE) else 0

    import urllib.request as _urlreq
    try:
        req = _urlreq.Request(f'{LIVE_URL}/api/admin/data-version', headers={'X-Api-Key': ADMIN_API_KEY})
        with _urlreq.urlopen(req, timeout=10) as resp:
            live = json.loads(resp.read().decode('utf-8'))
        live_ts = live.get('updated_at') or 0
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Cannot reach live: {str(e)}'}), 502

    if live_ts > local_ts + 2:
        direction = 'pull'
    elif local_ts > live_ts + 2:
        direction = 'push'
    else:
        direction = 'equal'

    return jsonify({'ok': True, 'local_ts': local_ts, 'live_ts': live_ts, 'direction': direction})


def _backup_local(prefix):
    """Backup local DATA_FILE before overwriting. Returns backup path or None."""
    if not os.path.exists(DATA_FILE):
        return None
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = os.path.join(os.path.dirname(DATA_FILE), 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f'{prefix}_{ts}.json')
    shutil.copy2(DATA_FILE, backup_path)
    return backup_path


@export_bp.route('/api/pull-from-live', methods=['POST'])
def pull_from_live():
    """Localhost-only: pull trades data from the live server and save locally."""
    if not DEBUG:
        return jsonify({'error': 'Only available in development mode'}), 403
    if not ADMIN_API_KEY:
        return jsonify({'error': 'ADMIN_API_KEY not configured'}), 500

    import urllib.request
    endpoint = f'{LIVE_URL}/api/admin/get-data'
    try:
        req = urllib.request.Request(endpoint, headers={'X-Api-Key': ADMIN_API_KEY})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'error': f'Failed to fetch from live: {str(e)}'}), 502

    if not raw.get('ok') or 'data' not in raw:
        return jsonify({'error': 'Live server returned unexpected response'}), 502

    _backup_local('pre_pull')
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(raw['data'], f, ensure_ascii=False, indent=2)

    trade_count = len(raw['data'].get('trades', []))
    return jsonify({'ok': True, 'trades': trade_count, 'message': f'Pulled {trade_count} trades from live'})


@export_bp.route('/api/push-to-live', methods=['POST'])
def push_to_live():
    """Localhost-only: push local trades data to the live server."""
    if not DEBUG:
        return jsonify({'error': 'Only available in development mode'}), 403
    if not ADMIN_API_KEY:
        return jsonify({'error': 'ADMIN_API_KEY not configured'}), 500
    if not os.path.exists(DATA_FILE):
        return jsonify({'error': 'Local data file not found'}), 404

    import urllib.request
    with open(DATA_FILE, 'rb') as f:
        json_bytes = f.read()

    # Validate JSON before sending
    try:
        local_data = json.loads(json_bytes)
    except Exception:
        return jsonify({'error': 'Local trades.json is invalid JSON'}), 400

    boundary = 'FormBoundaryKhazana2026'
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="trades.json"\r\n'
        f'Content-Type: application/json\r\n\r\n'
    ).encode() + json_bytes + f'\r\n--{boundary}--\r\n'.encode()

    endpoint = f'{LIVE_URL}/api/admin/push-data'
    try:
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={
                'X-Api-Key': ADMIN_API_KEY,
                'Content-Type': f'multipart/form-data; boundary={boundary}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'error': f'Failed to push to live: {str(e)}'}), 502

    trade_count = len(local_data.get('trades', []))
    return jsonify({'ok': True, 'trades': trade_count, 'message': f'Pushed {trade_count} trades to live'})
