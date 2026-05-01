"""
routes/trade_routes.py
----------------------
API routes for reading and writing the trades payload.
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user

from services.trade_service import get_all_trades, save_trades

trade_bp = Blueprint('trade', __name__)


def _get_user_id():
    """Extract user_id from the current session (None for unauthenticated/single-user)."""
    return current_user.id if current_user.is_authenticated else None


@trade_bp.route('/api/trades', methods=['GET'])
def get_trades():
    return jsonify(get_all_trades(user_id=_get_user_id()))


@trade_bp.route('/api/trades', methods=['POST'])
def post_trades():
    data = request.json
    if not data:
        return jsonify({'error': 'No data'}), 400
    try:
        save_trades(data, user_id=_get_user_id())
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    # Resync backup for any date touched in this save (real-time prefix rename)
    _trigger_backup_sync(data)
    return jsonify({'success': True})


def _trigger_backup_sync(data):
    """Fire-and-forget: resync backup for dates present in the saved payload."""
    import threading
    from services.img_backup_service import sync_date_to_backup
    dates = set()
    for t in (data.get('trades') or []):
        d = t.get('date', '')
        if d:
            dates.add(d)
    for d in (data.get('dayData') or {}).keys():
        if d:
            dates.add(d)
    if dates:
        threading.Thread(target=lambda: [sync_date_to_backup(d) for d in dates], daemon=True).start()
