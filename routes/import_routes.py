"""
routes/import_routes.py
-----------------------
API routes for all import variants: Excel, JSON/ZIP, raw CSV,
Zerodha historical CSV, and Dhan CSV.
"""
import os

from flask import Blueprint, request, jsonify

from services.import_service import (
    import_excel, import_raw_csv, import_historical_csv,
    import_dhan_csv, import_json_or_zip,
)
from config import BASE_DIR, UPLOADS_DIR

import_bp = Blueprint('import', __name__)


@import_bp.route('/api/import-excel', methods=['POST'])
def import_excel_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_excel(file.read())
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-json', methods=['POST'])
def import_json_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    try:
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR)
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
        result = import_historical_csv(file, os.path.join(BASE_DIR, 'structured_trades.csv'))
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
        result = import_dhan_csv(file, os.path.join(BASE_DIR, 'structured_trades.csv'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)
