"""
routes/import_routes.py
-----------------------
API routes for all import variants: Excel, JSON/ZIP, raw CSV,
Zerodha historical CSV, and Dhan CSV.
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user

from services.import_service import (
    import_excel, import_raw_csv, import_historical_csv,
    import_dhan_csv, import_json_or_zip,
)
from config import UPLOADS_DIR, ADMIN_API_KEY, STRUCTURED_TRADES_CSV

import_bp = Blueprint('import', __name__)


@import_bp.route('/api/import-excel', methods=['POST'])
def import_excel_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        result = import_excel(file.read(), user_id=user_id)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Excel Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/import-json', methods=['POST'])
def import_json_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR, user_id=user_id)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"JSON/ZIP Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/admin/push-data', methods=['POST'])
def admin_push_data():
    """API-key-protected endpoint to push trades data without login session."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    try:
        import json, glob as _glob, os
        from config import DATA_FILE

        file_bytes = request.files['file'].read()
        data = json.loads(file_bytes)

        # Write to trades_N.json (active user file), not trades.json
        data_dir = os.path.dirname(DATA_FILE)
        user_files = [f for f in _glob.glob(os.path.join(data_dir, 'trades_*.json'))
                      if '.backup' not in f and os.path.exists(f)]
        target = max(user_files, key=os.path.getmtime) if user_files else DATA_FILE

        with open(target, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        trade_count = len(data.get('trades', []))
        return jsonify({'ok': True, 'trades': trade_count, 'file': os.path.basename(target)})
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Admin Push Data Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 500


@import_bp.route('/api/import-raw-csv', methods=['POST'])
def import_raw_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        result = import_raw_csv(file)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Raw CSV Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/import-historical-csv', methods=['POST'])
def import_historical_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        result = import_historical_csv(file, STRUCTURED_TRADES_CSV)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Historical CSV Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/import-dhan-csv', methods=['POST'])
def import_dhan_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        result = import_dhan_csv(file, STRUCTURED_TRADES_CSV)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Dhan CSV Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400
