"""
config.py
---------
Central configuration for the Trading Journal app.
All environment variable reads and path defaults live here.
Import this module wherever you need DATA_FILE, UPLOADS_DIR, etc.
"""
import os
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Data paths ────────────────────────────────────────────────────────────────
DATA_FILE          = os.getenv('DATA_FILE',   os.path.join(BASE_DIR, 'data', 'trades.json'))
UPLOADS_DIR        = os.getenv('UPLOADS_DIR', os.path.join(BASE_DIR, 'static', 'uploads'))
TRASH_DIR          = os.path.join(UPLOADS_DIR, '_trash')
CSVLOG_SCHEMA_FILE = os.path.join(BASE_DIR, 'data', 'csvlog_schema.xlsx')

# ── App settings ──────────────────────────────────────────────────────────────
TRASH_EXPIRY_DAYS   = 7
MAX_CONTENT_LENGTH  = 100 * 1024 * 1024          # 100 MB upload limit
CACHE_BUST          = int(time.time())

# ── Server settings ───────────────────────────────────────────────────────────
HOST  = os.getenv('HOST', '0.0.0.0')
PORT  = int(os.getenv('PORT', '5000'))
DEBUG = str(os.getenv('FLASK_DEBUG', 'true')).strip().lower() in ('1', 'true', 'yes')

SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-for-dev-fallback')
SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'data', 'users.db'))
SQLALCHEMY_TRACK_MODIFICATIONS = False

# ── Cloudinary (optional — set CLOUDINARY_URL on Render for cloud image storage) ──
# Format: cloudinary://api_key:api_secret@cloud_name
CLOUDINARY_URL = os.getenv('CLOUDINARY_URL', '')
USE_CLOUDINARY  = bool(CLOUDINARY_URL)
