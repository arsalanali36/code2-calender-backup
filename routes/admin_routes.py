import os
import json
import shutil
from datetime import datetime
from flask import Blueprint, render_template, abort, redirect, url_for, jsonify, request
from flask_login import current_user
from models import db, User
from config import BASE_DIR, UPLOADS_DIR

admin_bp = Blueprint('admin', __name__)


def _trade_count(user_id):
    path = os.path.join(BASE_DIR, 'data', f'trades_{user_id}.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return len(data.get('trades', []))
    except Exception:
        return 0


def _image_count(user_id):
    user_dir = os.path.join(UPLOADS_DIR, f'user_{user_id}')
    if not os.path.isdir(user_dir):
        return 0
    exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
    return sum(
        1 for f in os.listdir(user_dir)
        if os.path.splitext(f)[1].lower() in exts
    )


@admin_bp.route('/admin')
def admin_panel():
    if not current_user.is_authenticated or current_user.id != 1:
        abort(403)

    users = User.query.order_by(User.created_at).all()
    now = datetime.utcnow()

    rows = []
    for u in users:
        created = u.created_at or datetime(2026, 1, 1)
        last = u.last_seen

        if last:
            diff = now - last
            if diff.seconds < 3600 and diff.days == 0:
                active_str = f"{diff.seconds // 60}m ago"
            elif diff.days == 0:
                active_str = f"{diff.seconds // 3600}h ago"
            else:
                active_str = f"{diff.days}d ago"
            is_online = diff.days == 0 and diff.seconds < 300
        else:
            active_str = "Never"
            is_online = False

        rows.append({
            'id': u.id,
            'email': u.email,
            'created': created.strftime('%d %b %Y'),
            'last_seen': active_str,
            'is_online': is_online,
            'trades': _trade_count(u.id),
            'images': _image_count(u.id),
            'is_admin': u.id == 1,
        })

    return render_template('admin.html', users=rows, total=len(rows))


@admin_bp.route('/admin/deploy', methods=['POST'])
def deploy():
    """Admin-only: git pull + docker restart. Triggered via POST from localhost."""
    if not current_user.is_authenticated or current_user.id != 1:
        abort(403)
    import subprocess, threading

    def _run():
        try:
            subprocess.run(['git', 'pull', 'origin', 'master'],
                           cwd=BASE_DIR, capture_output=True, timeout=60)
            subprocess.run(['docker', 'restart', 'code2'],
                           capture_output=True, timeout=30)
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({'status': 'deploying — wait 15s then reload'})


@admin_bp.route('/admin/delete-user/<int:user_id>', methods=['POST'])
def delete_user(user_id):
    if not current_user.is_authenticated or current_user.id != 1:
        abort(403)
    if user_id == 1:
        return jsonify({'error': 'Cannot delete admin'}), 400

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()

    # Remove user's trades file
    trades_file = os.path.join(BASE_DIR, 'data', f'trades_{user_id}.json')
    if os.path.exists(trades_file):
        os.remove(trades_file)

    # Remove user's uploads folder
    user_uploads = os.path.join(UPLOADS_DIR, f'user_{user_id}')
    if os.path.isdir(user_uploads):
        shutil.rmtree(user_uploads)

    return jsonify({'success': True})
