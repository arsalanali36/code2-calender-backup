"""
routes/log_routes.py
--------------------
HTTP routes for Trade Log+ feature.
Serves the /log page and all /api/log/* endpoints.
"""
from flask import Blueprint, jsonify, render_template, request, Response
from flask_login import current_user

from services import log_service

log_bp = Blueprint('log', __name__)


def _uid():
    return current_user.id if current_user.is_authenticated else None


# ── Page ──────────────────────────────────────────────────────────────────────

@log_bp.route('/log')
def log_page():
    schema    = log_service.get_schema()
    auto_cols = log_service.AUTO_COLS
    return render_template('log.html', schema=schema, auto_cols=auto_cols)


# ── Data ──────────────────────────────────────────────────────────────────────

@log_bp.route('/api/log/data')
def api_log_data():
    start = request.args.get('start') or None
    end   = request.args.get('end')   or None
    rows  = log_service.get_log_data(start_date=start, end_date=end)
    return jsonify({'rows': rows, 'count': len(rows)})


@log_bp.route('/api/log/annotate', methods=['POST'])
def api_annotate():
    body  = request.get_json(force=True) or {}
    date  = body.get('date',  '').strip()
    seq   = body.get('seq',   '').strip()
    field = body.get('field', '').strip()
    value = body.get('value', '')
    if not all([date, seq, field]):
        return jsonify({'error': 'missing fields'}), 400
    log_service.save_annotation(date, seq, field, value)
    return jsonify({'ok': True})


# ── Schema ────────────────────────────────────────────────────────────────────

@log_bp.route('/api/log/schema', methods=['GET'])
def api_get_schema():
    return jsonify(log_service.get_schema())


@log_bp.route('/api/log/schema', methods=['POST'])
def api_save_schema():
    schema = request.get_json(force=True)
    if not isinstance(schema, list):
        return jsonify({'error': 'expected a list'}), 400
    log_service.save_schema(schema)
    return jsonify({'ok': True})


@log_bp.route('/api/log/schema/download')
def api_schema_download():
    csv_text = log_service.schema_to_csv()
    return Response(
        csv_text,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename="log_schema.csv"'},
    )


@log_bp.route('/api/log/schema/upload', methods=['POST'])
def api_schema_upload():
    if 'file' in request.files:
        raw = request.files['file'].read().decode('utf-8-sig')
    else:
        raw = (request.get_data() or b'').decode('utf-8-sig')
    if not raw.strip():
        return jsonify({'error': 'empty file'}), 400
    schema = log_service.csv_to_schema(raw)
    log_service.save_schema(schema)
    return jsonify({'ok': True, 'schema': schema})


# ── Export ────────────────────────────────────────────────────────────────────

@log_bp.route('/api/log/export')
def api_export():
    start = request.args.get('start') or None
    end   = request.args.get('end')   or None
    csv_text = log_service.export_annotations_csv(start, end)
    return Response(
        csv_text,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename="trade_log_export.csv"'},
    )
