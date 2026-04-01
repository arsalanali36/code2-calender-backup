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
