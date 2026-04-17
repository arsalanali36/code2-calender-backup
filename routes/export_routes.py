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
from processors.data_processors import find_best_trades_file

export_bp = Blueprint('export', __name__)


@export_bp.route('/api/backup', methods=['GET'])
def backup():
    active_file = find_best_trades_file()
    if not os.path.exists(active_file):
        return jsonify({'error': 'No data to backup'}), 404
    requested_name = str(request.args.get('name', '')).strip()
    safe_name = re.sub(r'[^A-Za-z0-9_\ -]+', '', requested_name).strip()
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = safe_name if safe_name else f'trading_journal_{timestamp_str}'
    zip_bytes, _ = build_backup_zip(active_file, UPLOADS_DIR)
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


_find_best_trades_file = find_best_trades_file


@export_bp.route('/api/admin/get-data', methods=['GET'])
def admin_get_data():
    """API-key-protected: returns full trades JSON for live→localhost sync."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data_file = _find_best_trades_file()
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({'ok': True, 'data': data, 'file': os.path.basename(data_file)})
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
        data_file = _find_best_trades_file()
        if not os.path.exists(data_file):
            return jsonify({'ok': True, 'updated_at': None, 'trades': 0})
        mtime = os.path.getmtime(data_file)
        with open(data_file, 'r', encoding='utf-8') as f:
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

    local_file = _find_best_trades_file()
    local_ts = os.path.getmtime(local_file) if os.path.exists(local_file) else 0
    try:
        with open(local_file, 'r', encoding='utf-8') as f:
            local_trades = len(json.load(f).get('trades', []))
    except Exception:
        local_trades = 0

    import urllib.request as _urlreq
    try:
        req = _urlreq.Request(f'{LIVE_URL}/api/admin/data-version', headers={'X-Api-Key': ADMIN_API_KEY})
        with _urlreq.urlopen(req, timeout=60) as resp:
            live = json.loads(resp.read().decode('utf-8'))
        live_ts = live.get('updated_at') or 0
        live_trades = live.get('trades', 0)
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Cannot reach live: {str(e)}'}), 502

    if live_ts > local_ts + 2:
        direction = 'pull'
    elif local_ts > live_ts + 2:
        direction = 'push'
    else:
        direction = 'equal'

    # Safety: never auto-pull if live has significantly fewer trades (bootstrap/corrupt data guard)
    if direction == 'pull' and live_trades < local_trades - 5:
        direction = 'safe_skip'

    return jsonify({
        'ok': True,
        'local_ts': local_ts, 'live_ts': live_ts,
        'local_trades': local_trades, 'live_trades': live_trades,
        'direction': direction,
    })


def _backup_local(prefix):
    """Backup the active local trades file before overwriting."""
    active = _find_best_trades_file()
    if not os.path.exists(active):
        return None
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = os.path.join(os.path.dirname(active), 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f'{prefix}_{ts}.json')
    shutil.copy2(active, backup_path)
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
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'error': f'Failed to fetch from live: {str(e)}'}), 502

    if not raw.get('ok') or 'data' not in raw:
        return jsonify({'error': 'Live server returned unexpected response'}), 502

    _backup_local('pre_pull')
    target = _find_best_trades_file()
    with open(target, 'w', encoding='utf-8') as f:
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

    source = _find_best_trades_file()
    if not os.path.exists(source):
        return jsonify({'error': 'Local data file not found'}), 404

    import urllib.request
    with open(source, 'rb') as f:
        json_bytes = f.read()

    # Validate JSON before sending
    try:
        local_data = json.loads(json_bytes)
    except Exception:
        return jsonify({'error': f'Local {os.path.basename(source)} is invalid JSON'}), 400

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
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'error': f'Failed to push to live: {str(e)}'}), 502

    trade_count = len(local_data.get('trades', []))
    return jsonify({'ok': True, 'trades': trade_count, 'message': f'Pushed {trade_count} trades to live'})
