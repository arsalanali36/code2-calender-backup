# Backend - App, Config, Build
Consolidated code context for AI assistants.


## File: `app.py`
```py
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
from models import db, User
from flask_login import LoginManager
from services.auto_sync_service import start_background_sync

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
Compress(app)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

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
    allowed_endpoints = ['auth.login', 'auth.register', 'auth.reset_password', 'static', 'options_handler', 'import.admin_push_data']
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
threading.Thread(target=_cleanup_trash, daemon=True).start()
start_background_sync()

# ── JS bundle (rebuild if any source file changed) ────────────────────────────
try:
    from build import build as _build_js
    _build_js()
except Exception as _e:
    print(f'[build] WARNING: JS bundle build failed: {_e}')

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
    """Log all unhandled exceptions to the AI debug log."""
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

```

## File: `config.py`
```py
"""
config.py
---------
Central configuration for the Trading Journal app.
All environment variable reads and path defaults live here.
Import this module wherever you need DATA_FILE, UPLOADS_DIR, etc.
"""
import hashlib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Data paths ────────────────────────────────────────────────────────────────
DATA_FILE          = os.getenv('DATA_FILE',   os.path.join(BASE_DIR, 'data', 'trades.json'))
UPLOADS_DIR        = os.getenv('UPLOADS_DIR', os.path.join(BASE_DIR, 'static', 'uploads'))
TRASH_DIR          = os.path.join(UPLOADS_DIR, '_trash')
AUDIO_DIR          = os.path.join(UPLOADS_DIR, 'audio')
VIDEO_DIR          = os.path.join(UPLOADS_DIR, 'video')
PDF_DIR            = os.path.join(UPLOADS_DIR, 'pdfs')
PDF_META_FILE      = os.path.join(BASE_DIR, 'data', 'pdfs.json')
CSVLOG_SCHEMA_FILE        = os.path.join(BASE_DIR, 'data', 'csvlog_schema.xlsx')
STRUCTURED_TRADES_CSV     = os.path.join(BASE_DIR, 'structured_trades.csv')
AI_DEBUG_LOG              = os.path.join(BASE_DIR, 'data', 'ai_debug.log')


# ── What-If / Dhan data ───────────────────────────────────────────────────────
OHLC_CACHE_DIR       = os.path.join(BASE_DIR, 'data', 'Historical_OHLC', 'Options')
DHAN_CONFIG_FILE     = os.path.join(BASE_DIR, 'data', 'dhan_config.json')
DHAN_SYMBOL_MAP_FILE = os.path.join(BASE_DIR, 'data', 'dhan_symbol_map.json')
DHAN_SCRIP_MASTER    = os.path.join(BASE_DIR, 'data', 'dhan_scrip_master.csv')
SYMBOL_EXPIRY_MAP_FILE     = os.path.join(BASE_DIR, 'data', 'symbol_expiry_map.json')
TRADEBOOK_SYNC_QUEUE_FILE  = os.path.join(BASE_DIR, 'data', 'tradebook_sync_queue.json')

# ── App settings ──────────────────────────────────────────────────────────────
TRASH_EXPIRY_DAYS   = 7
MAX_CONTENT_LENGTH  = 100 * 1024 * 1024          # 100 MB upload limit
def _compute_static_hash() -> str:
    """
    Return a short hash of all JS and CSS file contents under static/.
    Changes only when a file is modified — not on every server restart.
    """
    h = hashlib.md5()
    static_dir = os.path.join(BASE_DIR, 'static')
    for root, _, files in sorted(os.walk(static_dir)):
        for fname in sorted(files):
            if fname.endswith(('.js', '.css')):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, 'rb') as f:
                        h.update(f.read())
                except OSError:
                    pass
    return h.hexdigest()[:10]

CACHE_BUST = _compute_static_hash()

# ── Cloudinary ────────────────────────────────────────────────────────────────
CLOUDINARY_URL_VALUE = os.getenv('CLOUDINARY_URL', '')
USE_CLOUDINARY = bool(CLOUDINARY_URL_VALUE)

if USE_CLOUDINARY:
    try:
        import cloudinary
        cloudinary.config(cloudinary_url=CLOUDINARY_URL_VALUE)
    except ImportError:
        USE_CLOUDINARY = False  # cloudinary package not installed

# ── Server settings ───────────────────────────────────────────────────────────
HOST  = os.getenv('HOST', '0.0.0.0')
PORT  = int(os.getenv('PORT', '5000'))
DEBUG = str(os.getenv('FLASK_DEBUG', 'true')).strip().lower() in ('1', 'true', 'yes')

_secret_key_default = 'your-secret-key-for-dev-fallback'
SECRET_KEY = os.getenv('SECRET_KEY', _secret_key_default)
if SECRET_KEY == _secret_key_default and not os.getenv('FLASK_DEBUG', '').strip().lower() in ('1', 'true', 'yes'):
    raise RuntimeError(
        'SECRET_KEY env var is not set. This is required in production. '
        'Set FLASK_DEBUG=true to allow the insecure default in development.'
    )
ADMIN_API_KEY = os.getenv('ADMIN_API_KEY', '')   # Set this in Render dashboard env vars

# ── CORS ──────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins. Example env value:
#   ALLOWED_ORIGINS=https://code2-calender.onrender.com,http://localhost:5000
_raw_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5000')
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(',') if o.strip()]
SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'data', 'users.db'))
SQLALCHEMY_TRACK_MODIFICATIONS = False

```

## File: `models.py`
```py
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

```

## File: `extensions.py`
```py
"""
extensions.py
-------------
Flask extension instances (limiter, etc.) created here to avoid circular imports.
Import these in app.py to init_app(), and in routes to apply decorators.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])

```

## File: `requirements.txt`
```txt
Flask>=3.0.0
Flask-Cors>=4.0.0
pandas>=2.0.0
openpyxl>=3.1.0
gunicorn>=21.2.0
Flask-Login>=0.6.3
Flask-SQLAlchemy>=3.1.1
cloudinary>=1.36.0
python-dotenv>=1.0.0
flask-limiter>=4.0
flask-compress>=1.14
yfinance>=0.2.0

```

## File: `build.py`
```py
"""
build.py
--------
Concatenates all local JS modules (in load order from index.html) into
static/js/bundle.js.

Run manually:   python build.py
Auto-run:       called from app.py startup when any source file is newer than bundle.

Vendor files (static/js/vendor/*.js) are NOT bundled — they're already local
and loaded separately so the browser can cache them independently.
"""
import os
import re
import sys

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
INDEX_HTML = os.path.join(BASE_DIR, 'templates', 'index.html')
BUNDLE_OUT = os.path.join(BASE_DIR, 'static', 'js', 'bundle.js')


def get_local_script_paths():
    """Parse index.html and return ordered list of local (non-vendor) JS file paths."""
    with open(INDEX_HTML, encoding='utf-8') as f:
        html = f.read()
    # Match all local /static/js/ scripts that are NOT vendor and NOT bundle itself
    matches = re.findall(r'<script[^>]+src="(/static/js/(?!vendor)(?!bundle)[^"?]+)', html)
    paths = []
    for src in matches:
        # Convert URL path to filesystem path
        fpath = os.path.join(BASE_DIR, src.lstrip('/').replace('/', os.sep))
        if os.path.isfile(fpath):
            paths.append((src, fpath))
        else:
            print(f'  [build] WARNING: not found: {fpath}', file=sys.stderr)
    return paths


def needs_rebuild(source_paths):
    """Return True if bundle.js doesn't exist or any source is newer than bundle."""
    if not os.path.exists(BUNDLE_OUT):
        return True
    bundle_mtime = os.path.getmtime(BUNDLE_OUT)
    # Also check index.html itself (script order could have changed)
    if os.path.getmtime(INDEX_HTML) > bundle_mtime:
        return True
    for _, fpath in source_paths:
        if os.path.getmtime(fpath) > bundle_mtime:
            return True
    return False


def build(force=False):
    """Build bundle.js. Returns True if bundle was (re)built."""
    paths = get_local_script_paths()
    if not paths:
        print('[build] No local scripts found in index.html', file=sys.stderr)
        return False

    if not force and not needs_rebuild(paths):
        return False  # already up to date

    parts = [
        '/* Trading Journal — JS bundle (auto-generated by build.py) */',
        '/* Do NOT edit this file directly — edit the source modules  */',
        '',
    ]
    total_bytes = 0
    for src, fpath in paths:
        with open(fpath, encoding='utf-8') as f:
            content = f.read()
        parts.append(f'\n/* ── {src} ── */')
        parts.append(content)
        total_bytes += len(content.encode('utf-8'))

    bundle_content = '\n'.join(parts)
    with open(BUNDLE_OUT, 'w', encoding='utf-8') as f:
        f.write(bundle_content)

    print(f'[build] bundle.js: {len(paths)} files -> {total_bytes / 1024:.0f} KB '
          f'({os.path.getsize(BUNDLE_OUT) / 1024:.0f} KB on disk)')
    return True


if __name__ == '__main__':
    force = '--force' in sys.argv
    rebuilt = build(force=force)
    if not rebuilt:
        print('[build] bundle.js is up to date — use --force to rebuild')

```

## File: `render.yaml`
```yaml
services:
  - type: web
    name: code2-calender
    env: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --workers 2 --threads 4 --timeout 120
    disks:
      - name: code2-calender-data
        mountPath: /var/data
        sizeGB: 1
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.9"
      - key: DATA_FILE
        value: /var/data/trades.json
      - key: UPLOADS_DIR
        value: /var/data/uploads
      - key: CLOUDINARY_URL
        sync: false   # Set this secret in the Render dashboard → Environment


```
