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
import shutil
import threading
from datetime import datetime, timedelta

from flask import Flask, request
from werkzeug.middleware.proxy_fix import ProxyFix

from config import (
    BASE_DIR, DATA_FILE, UPLOADS_DIR, TRASH_DIR,
    TRASH_EXPIRY_DAYS, MAX_CONTENT_LENGTH, HOST, PORT, DEBUG,
)
from routes.page_routes   import page_bp
from routes.trade_routes  import trade_bp
from routes.image_routes  import image_bp
from routes.import_routes import import_bp
from routes.export_routes import export_bp

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['X-App-Cors'] = 'active'
    return response

@app.route('/api/<path:path>', methods=['OPTIONS'])
def options_handler(path):
    from flask import make_response
    r = make_response('', 204)
    r.headers['Access-Control-Allow-Origin'] = '*'
    r.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    r.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return r

# Ensure required directories exist
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(TRASH_DIR, exist_ok=True)


# ── Startup tasks ─────────────────────────────────────────────────────────────

def _bootstrap_persistent_storage():
    """
    One-time seed: if using external DATA/UPLOADS paths (e.g. Render disk),
    copy bundled local data so the app starts with existing data.
    """
    default_data_file   = os.path.join(BASE_DIR, 'data', 'trades.json')
    default_uploads_dir = os.path.join(BASE_DIR, 'static', 'uploads')

    try:
        if (DATA_FILE != default_data_file
                and not os.path.exists(DATA_FILE)
                and os.path.exists(default_data_file)):
            shutil.copy2(default_data_file, DATA_FILE)
    except Exception:
        pass

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
    while True:
        try:
            cutoff = datetime.now() - timedelta(days=TRASH_EXPIRY_DAYS)
            for fname in os.listdir(TRASH_DIR):
                fpath = os.path.join(TRASH_DIR, fname)
                if os.path.isfile(fpath):
                    mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                    if mtime < cutoff:
                        os.remove(fpath)
        except Exception:
            pass
        time.sleep(86400)  # check every 24 hours


_bootstrap_persistent_storage()
threading.Thread(target=_cleanup_trash, daemon=True).start()

# ── Blueprint registration ────────────────────────────────────────────────────
app.register_blueprint(page_bp)
app.register_blueprint(trade_bp)
app.register_blueprint(image_bp)
app.register_blueprint(import_bp)
app.register_blueprint(export_bp)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("  Trading Journal - Starting Server")
    print(f"  Open: http://localhost:{PORT}")
    print("=" * 50)
    app.run(debug=DEBUG, host=HOST, port=PORT)
