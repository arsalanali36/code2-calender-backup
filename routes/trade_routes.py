"""
routes/trade_routes.py
----------------------
API routes for reading and writing the trades payload.
"""
from flask import Blueprint, request, jsonify

from services.trade_service import get_all_trades, save_trades

trade_bp = Blueprint('trade', __name__)


@trade_bp.route('/api/trades', methods=['GET'])
def get_trades():
    return jsonify(get_all_trades())


@trade_bp.route('/api/trades', methods=['POST'])
def post_trades():
    data = request.json
    if not data:
        return jsonify({'error': 'No data'}), 400
    try:
        save_trades(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'success': True})
