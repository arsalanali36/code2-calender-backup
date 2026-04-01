"""
services/backup_service.py
--------------------------
Auto-backup logic: copy the trades data file to a timestamped backup,
keep only the last 30 per user. Called after every successful save.
"""
import logging
import os
import shutil
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_last_backup_time: float = 0
_INTERVAL = 300  # seconds between auto-backups (5 minutes)
_MAX_BACKUPS = 30


def auto_backup(data_file: str, user_id=None) -> None:
    """
    If at least _INTERVAL seconds have passed since the last backup,
    copy data_file to the backups/ subdirectory next to it.
    Thread-safe via a module-level lock.
    """
    global _last_backup_time
    now = time.time()

    with _lock:
        if now - _last_backup_time < _INTERVAL:
            return
        _last_backup_time = now

    try:
        backup_dir = os.path.join(os.path.dirname(data_file), 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        user_prefix = f'user_{user_id}_' if user_id is not None else ''
        backup_file = os.path.join(backup_dir, f'trades_backup_{user_prefix}{timestamp}.json')
        shutil.copy2(data_file, backup_file)

        # Prune old backups — keep only the most recent _MAX_BACKUPS
        prefix = f'trades_backup_{user_prefix}'
        all_backups = sorted(
            os.path.join(backup_dir, f)
            for f in os.listdir(backup_dir)
            if f.startswith(prefix)
        )
        for old in all_backups[:-_MAX_BACKUPS]:
            os.remove(old)

    except Exception:
        logger.exception('Auto-backup failed for %s', data_file)
