"""
routes/export_routes.py
-----------------------
API routes for all export variants: Excel, structured CSV,
logger Excel, and full backup ZIP.
"""
import io
import os
import re
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file

from services.export_service import (
    export_simple_excel, export_structured_csv,
    export_logger_excel, build_backup_zip,
)
from config import DATA_FILE, UPLOADS_DIR

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
