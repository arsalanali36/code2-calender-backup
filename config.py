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
LOG_DATA_FILE             = os.path.join(BASE_DIR, 'data', 'trade_log.json')
LOG_SCHEMA_FILE           = os.path.join(BASE_DIR, 'data', 'log_schema.json')


# ── Unified OHLC store (single source of truth) ───────────────────────────────
OHLC_DIR             = os.path.join(BASE_DIR, 'data', 'ohlc')
OHLC_WATCHLIST_FILE  = os.path.join(BASE_DIR, 'data', 'ohlc_watchlist.json')

# ── What-If / Dhan data (legacy — being replaced by OHLC_DIR) ─────────────────
OHLC_CACHE_DIR       = os.path.join(BASE_DIR, 'data', 'Historical_OHLC', 'Options')
DHAN_CONFIG_FILE     = os.path.join(BASE_DIR, 'data', 'dhan_config.json')
DHAN_SYMBOL_MAP_FILE = os.path.join(BASE_DIR, 'data', 'dhan_symbol_map.json')
DHAN_SCRIP_MASTER    = os.path.join(BASE_DIR, 'data', 'dhan_scrip_master.csv')
SYMBOL_EXPIRY_MAP_FILE     = os.path.join(BASE_DIR, 'data', 'symbol_expiry_map.json')
TRADEBOOK_SYNC_QUEUE_FILE  = os.path.join(BASE_DIR, 'data', 'tradebook_sync_queue.json')

# ── Algo Lab ──────────────────────────────────────────────────────────────────
ALGO_CONFIG_FILE    = os.path.join(BASE_DIR, 'data', 'algo_config.json')
ALGO_WATCHLIST_FILE = os.path.join(BASE_DIR, 'data', 'algo_watchlist.json')
ALGO_ORDERS_FILE    = os.path.join(BASE_DIR, 'data', 'algo_orders.json')
ALGO_STATE_FILE     = os.path.join(BASE_DIR, 'data', 'algo_state.json')
ALGO_OHLC_DIR       = os.path.join(BASE_DIR, 'data', 'algo_ohlc')

# ── Backup folder ─────────────────────────────────────────────────────────────
BACKUP_CONFIG_FILE  = os.path.join(BASE_DIR, 'data', 'backup_config.json')

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

# ── ImageKit ──────────────────────────────────────────────────────────────────
IMAGEKIT_PRIVATE_KEY  = os.getenv('IMAGEKIT_PRIVATE_KEY', '').strip()
IMAGEKIT_PUBLIC_KEY   = os.getenv('IMAGEKIT_PUBLIC_KEY', '').strip()
IMAGEKIT_URL_ENDPOINT = os.getenv('IMAGEKIT_URL_ENDPOINT', '').strip().rstrip('/')
USE_IMAGEKIT = bool(IMAGEKIT_PRIVATE_KEY and IMAGEKIT_PUBLIC_KEY and IMAGEKIT_URL_ENDPOINT)

# Legacy Cloudinary (kept for backward compat — existing URLs still work via CDN)
CLOUDINARY_URL_VALUE = os.getenv('CLOUDINARY_URL', '')
USE_CLOUDINARY = False  # Migrated to ImageKit

# ── Server settings ───────────────────────────────────────────────────────────
HOST  = os.getenv('HOST', '0.0.0.0')
PORT  = int(os.getenv('PORT', '5000'))
DEBUG = str(os.getenv('FLASK_DEBUG', 'true')).strip().lower() in ('1', 'true', 'yes')

_secret_key_default = 'your-secret-key-for-dev-fallback'
SECRET_KEY = os.getenv('SECRET_KEY', _secret_key_default)
if SECRET_KEY == _secret_key_default and not DEBUG:
    raise RuntimeError(
        'SECRET_KEY env var is not set. This is required in production. '
        'Please set SECRET_KEY in your environment, or set FLASK_DEBUG=true for development.'
    )
ADMIN_API_KEY = os.getenv('ADMIN_API_KEY', '')   # Set this in Render dashboard env vars

# ── Google Drive persistent storage ──────────────────────────────────────────
# Prevents data loss on Render restarts (ephemeral filesystem).
# GDRIVE_CREDENTIALS_JSON — full service account JSON key (paste entire file content)
# GDRIVE_FOLDER_ID        — Google Drive folder ID shared with the service account
GDRIVE_CREDENTIALS_JSON = os.getenv('GDRIVE_CREDENTIALS_JSON', '')
GDRIVE_FOLDER_ID        = os.getenv('GDRIVE_FOLDER_ID', '')

# ── CORS ──────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins. Example env value:
#   ALLOWED_ORIGINS=https://code2-calender.onrender.com,http://localhost:5000
_raw_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5000')
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(',') if o.strip()]
SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'data', 'users.db'))
SQLALCHEMY_TRACK_MODIFICATIONS = False
