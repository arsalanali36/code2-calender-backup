"""
routes/trade_routes.py
----------------------
API routes for reading and writing the trades payload.
"""
import os
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


@trade_bp.route('/api/trades/clear-demo', methods=['POST'])
def clear_demo():
    """Reset a demo-mode user's data to an empty journal."""
    uid = _get_user_id()
    if uid is None:
        return jsonify({'error': 'Unauthorized'}), 401
    empty = {
        'trades': [], 'columns': ['Date', 'Profit', 'Trade'],
        'allTags': [], 'tagColumns': [], 'userColumns': [],
        'dayData': {}, 'tagGroups': {}, 'pdfPageTags': {},
        'importedPdfs': [], 'tagTemplates': {}, 'imgTypes': {}, 'uiSettings': {},
    }
    try:
        save_trades(empty, user_id=uid)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'success': True})


@trade_bp.route('/api/trades/restore-demo', methods=['POST'])
def restore_demo():
    """Restore demo data for the current user (re-generates from source)."""
    uid = _get_user_id()
    if uid is None:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        from services.demo_service import restore_demo_data_for_user
        had_backup = restore_demo_data_for_user(uid)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'success': True, 'has_backup': had_backup})


@trade_bp.route('/api/trades/undo-demo-restore', methods=['POST'])
def undo_demo_restore():
    """Restore the most recent pre-demo backup for the current user."""
    uid = _get_user_id()
    if uid is None:
        return jsonify({'error': 'Unauthorized'}), 401
    import shutil
    from config import BASE_DIR
    backup_dir = os.path.join(BASE_DIR, 'data', 'backups')
    prefix = f'trades_backup_user_{uid}_'
    try:
        files = sorted(
            f for f in os.listdir(backup_dir) if f.startswith(prefix)
        )
    except FileNotFoundError:
        return jsonify({'error': 'No backup found'}), 404
    if not files:
        return jsonify({'error': 'No backup found'}), 404
    latest = os.path.join(backup_dir, files[-1])
    dest = os.path.join(BASE_DIR, 'data', f'trades_{uid}.json')
    try:
        shutil.copy2(latest, dest)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
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
