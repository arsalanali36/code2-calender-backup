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
    user_id = current_user.id if current_user.is_authenticated else None
    try:
        result = import_excel(file.read(), user_id=user_id)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-json', methods=['POST'])
def import_json_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    user_id = current_user.id if current_user.is_authenticated else None
    try:
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR, user_id=user_id)
    except (ValueError, Exception) as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/admin/push-data', methods=['POST'])
def admin_push_data():
    """API-key-protected endpoint to push trades data without login session."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    # Admin push uses no user session — saves to default data file
    try:
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR, user_id=None)
    except (ValueError, Exception) as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-raw-csv', methods=['POST'])
def import_raw_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_raw_csv(file)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-historical-csv', methods=['POST'])
def import_historical_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_historical_csv(file, STRUCTURED_TRADES_CSV)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-dhan-csv', methods=['POST'])
def import_dhan_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_dhan_csv(file, STRUCTURED_TRADES_CSV)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)
