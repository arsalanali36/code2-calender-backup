"""
local_backup_service.py
-----------------------
Background auto-backup — protects tags, notes, pin-notes, images, ALL user data.

Schedule:
  • Every 30 min  → fast JSON-only backup to data/local_backups/  (keeps last 30)
  • Every 2 hours → full ZIP backup (data/ + uploads/) to data/local_backups/  (keeps last 10)
  • Every 1 hour  → git add + commit + push  (local dev only, skipped on Render)

Startup: waits 3 minutes after Flask boots before first run.
"""

import glob
import logging
import os
import shutil
import subprocess
import threading
import time
from datetime import datetime

logger = logging.getLogger('local_backup')

JSON_INTERVAL_SEC  = 30 * 60      # 30 minutes
ZIP_INTERVAL_SEC   = 2  * 60 * 60  # 2 hours
GIT_INTERVAL_SEC   = 1  * 60 * 60  # 1 hour
MAX_JSON_BACKUPS   = 30
MAX_ZIP_BACKUPS    = 10
STARTUP_DELAY_SEC  = 180           # 3 minutes after Flask start


# ── Helpers ────────────────────────────────────────────────────────────────────

def _local_backups_dir():
    from config import BASE_DIR
    d = os.path.join(BASE_DIR, 'data', 'local_backups')
    os.makedirs(d, exist_ok=True)
    return d


def _is_render():
    return bool(os.getenv('RENDER') or os.getenv('RENDER_SERVICE_ID'))


def _git_available():
    try:
        from config import BASE_DIR
        r = subprocess.run(
            ['git', '-C', BASE_DIR, 'status', '--porcelain'],
            capture_output=True, text=True, timeout=10
        )
        return r.returncode == 0
    except Exception:
        return False


def _prune(pattern, keep):
    files = sorted(glob.glob(pattern))
    while len(files) > keep:
        os.remove(files.pop(0))


# ── JSON backup (fast, 30 min) ─────────────────────────────────────────────────

def do_json_backup():
    """Copy all trades*.json files to data/local_backups/ with timestamp."""
    try:
        from config import BASE_DIR, DATA_FILE
        data_dir  = os.path.dirname(DATA_FILE)
        out_dir   = _local_backups_dir()
        ts        = datetime.now().strftime('%Y%m%d_%H%M%S')
        copied    = 0

        for src in glob.glob(os.path.join(data_dir, 'trades*.json')):
            basename = os.path.basename(src)          # e.g. trades_1.json
            name, ext = os.path.splitext(basename)
            dst = os.path.join(out_dir, f'{name}_{ts}{ext}')
            shutil.copy2(src, dst)
            copied += 1

        if copied:
            logger.info(f'[local_backup] JSON backup: {copied} file(s) @ {ts}')
            _prune(os.path.join(out_dir, 'trades_*_*.json'), MAX_JSON_BACKUPS)
    except Exception as e:
        logger.error(f'[local_backup] JSON backup failed: {e}')


# ── Full ZIP backup (data + images, 2 hours) ───────────────────────────────────

def do_zip_backup():
    """Full ZIP: data/ + uploads/ — uses existing build_backup_zip service."""
    try:
        from config import UPLOADS_DIR
        from services.export_service import build_backup_zip
        from processors.data_processors import find_best_trades_file

        zip_bytes, ts = build_backup_zip(find_best_trades_file(), UPLOADS_DIR)
        out_dir = _local_backups_dir()
        fname   = f'full_backup_{ts}.zip'
        fpath   = os.path.join(out_dir, fname)

        with open(fpath, 'wb') as f:
            f.write(zip_bytes)

        size_mb = len(zip_bytes) / (1024 * 1024)
        logger.info(f'[local_backup] Full ZIP saved: {fname} ({size_mb:.1f} MB)')
        _prune(os.path.join(out_dir, 'full_backup_*.zip'), MAX_ZIP_BACKUPS)
    except Exception as e:
        logger.error(f'[local_backup] ZIP backup failed: {e}')


# ── Git backup (1 hour) ────────────────────────────────────────────────────────

def do_git_backup():
    """git add trades*.json → commit → push. Local dev only."""
    if _is_render() or not _git_available():
        return
    try:
        from config import BASE_DIR, DATA_FILE
        data_dir = os.path.dirname(DATA_FILE)

        # Only commit if there are actual changes
        status = subprocess.run(
            ['git', '-C', BASE_DIR, 'status', '--porcelain'],
            capture_output=True, text=True, timeout=10
        )
        if not status.stdout.strip():
            logger.info('[local_backup] Git: nothing changed, skip')
            return

        # Stage trades files
        for f in glob.glob(os.path.join(data_dir, 'trades*.json')):
            subprocess.run(['git', '-C', BASE_DIR, 'add', f], timeout=10, check=False)

        # Stage Historical_OHLC data (index + options CSVs downloaded from Dhan)
        ohlc_dir = os.path.join(data_dir, 'Historical_OHLC')
        if os.path.isdir(ohlc_dir):
            subprocess.run(['git', '-C', BASE_DIR, 'add', ohlc_dir], timeout=30, check=False)

        ts  = datetime.now().strftime('%Y-%m-%d %H:%M')
        msg = f'auto-backup: {ts}'

        commit = subprocess.run(
            ['git', '-C', BASE_DIR, 'commit', '-m', msg],
            capture_output=True, text=True, timeout=30
        )
        if commit.returncode != 0:
            # Nothing staged / already committed
            logger.info(f'[local_backup] Git commit skipped: {commit.stdout.strip() or commit.stderr.strip()}')
            return

        push = subprocess.run(
            ['git', '-C', BASE_DIR, 'push', 'origin', 'master'],
            capture_output=True, text=True, timeout=60
        )
        if push.returncode == 0:
            logger.info(f'[local_backup] Git pushed: {msg}')
        else:
            logger.warning(f'[local_backup] Git push failed: {push.stderr.strip()}')
    except Exception as e:
        logger.error(f'[local_backup] Git backup error: {e}')


# ── Background worker ──────────────────────────────────────────────────────────

def _backup_worker():
    time.sleep(STARTUP_DELAY_SEC)   # let Flask finish booting first

    last_zip = 0
    last_git = 0

    while True:
        now = time.time()

        # JSON backup every 30 min
        do_json_backup()

        # Full ZIP every 2 hours
        if now - last_zip >= ZIP_INTERVAL_SEC:
            do_zip_backup()
            last_zip = time.time()

        # Git every 1 hour
        if now - last_git >= GIT_INTERVAL_SEC:
            do_git_backup()
            last_git = time.time()

        time.sleep(JSON_INTERVAL_SEC)


def start_local_backup_service():
    """Call this from app.py to start the auto-backup background thread."""
    t = threading.Thread(target=_backup_worker, daemon=True, name='local-backup')
    t.start()
    logger.info(
        '[local_backup] Auto-backup started '
        '(JSON every 30min | Full ZIP every 2h | Git push every 1h)'
    )
