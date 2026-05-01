"""
app.py
------
Flask application entry point.
Handles only: app creation, startup tasks (directory setup, bootstrap,
background trash cleanup), and blueprint registration.

All route logic lives in routes/.
All business logic lives in services/.
All data processing lives in processors/.
Configuration lives in config.py.
"""
import os
import time
import json
import shutil
import logging
import threading
from datetime import datetime, timedelta

# Load .env file for local development (safe to call even if file doesn't exist)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — env vars must be set manually

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)

from flask import Flask, request, redirect, url_for
from flask_compress import Compress
from werkzeug.middleware.proxy_fix import ProxyFix
from extensions import limiter

from config import (
    BASE_DIR, DATA_FILE, UPLOADS_DIR, TRASH_DIR,
    TRASH_EXPIRY_DAYS, MAX_CONTENT_LENGTH, HOST, PORT, DEBUG,
    SECRET_KEY, SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS,
    ALLOWED_ORIGINS,
)
from routes.page_routes   import page_bp
from routes.trade_routes  import trade_bp
from routes.image_routes  import image_bp
from routes.import_routes import import_bp
from routes.export_routes import export_bp
from routes.csvlog_routes  import csvlog_bp
from routes.auth_routes    import auth_bp
from routes.whatif_routes  import whatif_bp
from routes.strategy_routes import strategy_bp
from routes.log_routes import log_bp
from routes.algo_routes import algo_bp
from routes.ohlc_routes import ohlc_bp
from models import db, User
from flask_login import LoginManager
from services.auto_sync_service import start_background_sync
from services.local_backup_service import start_local_backup_service
from services.algo_ohlc_fetcher import start_ohlc_fetcher
from services.ohlc_scheduler import start_scheduler as start_ohlc_scheduler

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
Compress(app)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# ── CACHE BUSTING ────────────────────────────────────────────────────────────
@app.after_request
def add_cache_header(response):
    if app.debug:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers['Cache-Control'] = 'public, max-age=0'
    return response

@app.context_processor
def override_url_for():
    """
    Append a version timestamp (?v=...) to static file URLs automatically.
    """
    return dict(url_for=dated_url_for)

def dated_url_for(endpoint, **values):
    if endpoint == 'static':
        filename = values.get('filename', None)
        if filename:
            file_path = os.path.join(app.static_folder, filename)
            if os.path.exists(file_path):
                values['v'] = int(os.stat(file_path).st_mtime)
    return url_for(endpoint, **values)

# ── App setup ─────────────────────────────────────────────────────────────────

db.init_app(app)

limiter.init_app(app)

login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Api-Key'
        response.headers['Vary'] = 'Origin'
    # Long cache for versioned static assets (?v=CACHE_BUST guarantees freshness on change)
    if request.path.startswith('/static/') and request.args.get('v'):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response

@app.before_request
def require_login():
    from flask_login import current_user
    allowed_endpoints = ['auth.login', 'auth.register', 'auth.reset_password', 'static', 'options_handler', 'import.admin_push_data', 'export.admin_get_data', 'export.admin_data_version']
    if request.endpoint and request.endpoint not in allowed_endpoints:
        if not current_user.is_authenticated:
            if request.path.startswith('/api/'):
                return {'error': 'Unauthorized'}, 401
            return redirect(url_for('auth.login'))

@app.route('/api/<path:path>', methods=['OPTIONS'])
def options_handler(path):
    from flask import make_response
    origin = request.headers.get('Origin', '')
    r = make_response('', 204)
    if origin in ALLOWED_ORIGINS:
        r.headers['Access-Control-Allow-Origin'] = origin
        r.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        r.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Api-Key'
        r.headers['Vary'] = 'Origin'
    return r

# Ensure required directories exist.
# If a path is a broken symlink (e.g. Google Drive not mounted), replace it with a
# real local folder so the app can still start without the external drive.
def _ensure_dir(path):
    try:
        os.makedirs(path, exist_ok=True)
    except (FileExistsError, OSError):
        # Broken symlink → remove it and create a real directory in its place
        if os.path.islink(path) and not os.path.exists(path):
            print(f"[startup] WARNING: broken symlink {path!r} — replacing with local folder")
            os.unlink(path)
            os.makedirs(path, exist_ok=True)

for _d in [os.path.dirname(DATA_FILE), UPLOADS_DIR, TRASH_DIR]:
    _ensure_dir(_d)


# ── Startup tasks ─────────────────────────────────────────────────────────────

def _bootstrap_persistent_storage():
    """
    One-time seed: if using external DATA/UPLOADS paths (e.g. Render disk),
    copy bundled local data so the app starts with existing data.

    Set FORCE_DATA_REFRESH=1 env var to force-overwrite the disk trades.json
    AND all per-user trades_N.json files with the deployed versions.
    Remove after one deploy.
    """
    import glob as _glob
    default_data_dir    = os.path.join(BASE_DIR, 'data')
    default_data_file   = os.path.join(default_data_dir, 'trades.json')
    default_uploads_dir = os.path.join(BASE_DIR, 'static', 'uploads')

    force_refresh = os.getenv('FORCE_DATA_REFRESH', '').strip() == '1'

    try:
        if DATA_FILE != default_data_file and os.path.exists(default_data_file):
            # Seed/refresh trades.json
            if force_refresh or not os.path.exists(DATA_FILE):
                shutil.copy2(default_data_file, DATA_FILE)
                print(f"[bootstrap] trades.json {'force-refreshed' if force_refresh else 'seeded'} → {DATA_FILE}")
            # Seed/refresh all per-user trades_N.json files
            if force_refresh:
                for src in _glob.glob(os.path.join(default_data_dir, 'trades_*.json')):
                    if '.backup' in src:
                        continue
                    dst_dir = os.path.dirname(DATA_FILE)
                    dst = os.path.join(dst_dir, os.path.basename(src))
                    shutil.copy2(src, dst)
                    print(f"[bootstrap] force-refreshed {os.path.basename(src)} → {dst}")
    except Exception as e:
        print(f"[bootstrap] WARNING: could not copy trades files: {e}")

    try:
        if UPLOADS_DIR != default_uploads_dir and os.path.isdir(default_uploads_dir):
            for root, _, files in os.walk(default_uploads_dir):
                for fname in files:
                    src = os.path.join(root, fname)
                    rel = os.path.relpath(src, default_uploads_dir)
                    if rel.startswith('_trash'):
                        continue
                    dst = os.path.join(UPLOADS_DIR, rel)
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    if not os.path.exists(dst):
                        shutil.copy2(src, dst)
    except Exception:
        pass


def _cleanup_trash():
    """Delete files from _trash older than TRASH_EXPIRY_DAYS. Runs daily in background."""
    import logging
    while True:
        try:
            cutoff = datetime.now() - timedelta(days=TRASH_EXPIRY_DAYS)
            for fname in os.listdir(TRASH_DIR):
                fpath = os.path.join(TRASH_DIR, fname)
                if os.path.isfile(fpath):
                    mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                    if mtime < cutoff:
                        os.remove(fpath)
        except Exception as e:
            logging.exception('[cleanup_trash] Unexpected error: %s', e)
        time.sleep(86400)  # check every 24 hours


_bootstrap_persistent_storage()

# ── Google Drive startup sync ─────────────────────────────────────────────────
# On live server (Render), restore data from Drive if it's newer than the local
# ephemeral file. This runs synchronously so the app always starts with fresh data.
try:
    from services import gist_service
    _data_dir = os.path.join(BASE_DIR, 'data')
    _gist_target = os.path.join(_data_dir, 'trades_1.json')
    gist_service.download_if_newer(_gist_target)
except Exception as _gist_err:
    print(f'[gist] Startup sync error (non-fatal): {_gist_err}')

threading.Thread(target=_cleanup_trash, daemon=True).start()
start_background_sync()
start_local_backup_service()
start_ohlc_fetcher()
start_ohlc_scheduler()

# ── JS bundle (only built when USE_BUNDLE=1 — skipped in local dev) ───────────
if os.environ.get('USE_BUNDLE') == '1':
    try:
        from build import build as _build_js
        _build_js()
    except Exception as _e:
        print(f'[build] WARNING: JS bundle build failed: {_e}')
else:
    print('[build] DEV MODE — bundle skipped, serving individual JS files')

with app.app_context():
    db.create_all()

# ── Blueprint registration ────────────────────────────────────────────────────
app.register_blueprint(page_bp)
app.register_blueprint(trade_bp)
app.register_blueprint(image_bp)
app.register_blueprint(import_bp)
app.register_blueprint(export_bp)
app.register_blueprint(csvlog_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(whatif_bp)
app.register_blueprint(strategy_bp)
app.register_blueprint(log_bp)
app.register_blueprint(algo_bp)
app.register_blueprint(ohlc_bp)


# ── Entry point ───────────────────────────────────────────────────────────────
@app.route('/api/debug-data')
def debug_data():
    """Debug route: shows the actual data file being used for the current user."""
    from processors.data_processors import get_user_data_file
    from flask_login import current_user as cu
    try:
        uid = cu.id if cu.is_authenticated else None
        actual_file = get_user_data_file(uid)
        with open(actual_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        trades = data.get('trades', [])
        feb10 = [t for t in trades if t.get('date') == '2026-02-10']
        # Count local vs cloudinary image refs across all trades + dayData
        local_imgs = cloud_imgs = 0
        for t in trades:
            for img in t.get('images', []):
                if img.startswith('http'): cloud_imgs += 1
                else: local_imgs += 1
        for d in data.get('dayData', {}).values():
            for img in d.get('images', []):
                if img.startswith('http'): cloud_imgs += 1
                else: local_imgs += 1
        return {
            "actual_file": actual_file,
            "default_data_file": DATA_FILE,
            "force_refresh_env": os.getenv('FORCE_DATA_REFRESH'),
            "total_trades": len(trades),
            "images_cloudinary": cloud_imgs,
            "images_local_broken": local_imgs,
            "feb10_sample": feb10[0].get('images', [])[:3] if feb10 else "Not found"
        }
    except Exception as e:
        return {"error": str(e)}

@app.errorhandler(Exception)
def handle_exception(e):
    """Log all unhandled exceptions (except 404s) to the AI debug log."""
    # Ignore 404 Not Found errors to keep logs clean
    from werkzeug.exceptions import NotFound
    if isinstance(e, NotFound):
        return str(e), 404

    from services.debug_service import log_ai_error
    log_ai_error(f"Unhandled Exception: {str(e)}", e)
    # Return original behavior for Flask
    return str(e), 500

if __name__ == '__main__':

    print("=" * 50)
    print("  Trading Journal - Starting Server")
    print(f"  Open: http://localhost:{PORT}")
    print("=" * 50)
    app.run(debug=DEBUG, host=HOST, port=PORT)
