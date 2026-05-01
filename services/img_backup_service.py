"""
services/img_backup_service.py
-------------------------------
Image backup: copies app images to a user-chosen folder with
prefix naming (T1_, T2_, DAY_, CLOSE_) and date sub-folders.
"""
import os
import json
import shutil
from collections import defaultdict

from config import BACKUP_CONFIG_FILE, UPLOADS_DIR
from processors.data_processors import find_best_trades_file


def _get_backup_folder():
    if not os.path.exists(BACKUP_CONFIG_FILE):
        return None
    try:
        with open(BACKUP_CONFIG_FILE, encoding='utf-8') as f:
            cfg = json.load(f)
        folder = cfg.get('folder', '').strip()
        return folder or None
    except Exception:
        return None


def build_image_map():
    """Return {filename: {'date': str, 'prefix': str}} for every image in trades data."""
    trades_file = find_best_trades_file()
    with open(trades_file, encoding='utf-8') as f:
        data = json.load(f)

    image_map = {}
    trades_list = data.get('trades', [])
    day_data = data.get('dayData', {})

    # Group trades by date (preserve list order → T1, T2, ...)
    by_date = defaultdict(list)
    for t in trades_list:
        d = t.get('date', '')
        if d:
            by_date[d].append(t)

    for date, ts in by_date.items():
        for i, t in enumerate(ts):
            for img in (t.get('images') or []):
                fname = img.split('/')[-1] if '/' in img else img
                if fname:
                    image_map[fname] = {'date': date, 'prefix': f'T{i + 1}'}

    for date, dd in day_data.items():
        if not date:
            continue
        for img in (dd.get('images') or []):
            fname = img.split('/')[-1] if '/' in img else img
            if fname and fname not in image_map:
                image_map[fname] = {'date': date, 'prefix': 'DAY'}
        for img in (dd.get('closeImages') or []):
            fname = img.split('/')[-1] if '/' in img else img
            if fname and fname not in image_map:
                image_map[fname] = {'date': date, 'prefix': 'CLOSE'}

    return image_map


def _backed_filenames(base_dir):
    """Set of original filenames (prefix stripped) already in the backup tree."""
    backed = set()
    if not os.path.exists(base_dir):
        return backed
    for date_dir in os.listdir(base_dir):
        dpath = os.path.join(base_dir, date_dir)
        if not os.path.isdir(dpath):
            continue
        for f in os.listdir(dpath):
            idx = f.find('_')
            backed.add(f[idx + 1:] if idx != -1 else f)
    return backed


def get_backup_stats():
    folder = _get_backup_folder()
    try:
        image_map = build_image_map()
    except Exception:
        image_map = {}
    total = len(image_map)

    if not folder:
        return {'total_app': total, 'backed_up': 0, 'not_backed_up': total, 'folder': ''}

    base = os.path.join(folder, 'uploaded_imgs')
    backed = _backed_filenames(base)
    backed_up = sum(1 for fn in image_map if fn in backed)

    return {
        'total_app': total,
        'backed_up': backed_up,
        'not_backed_up': total - backed_up,
        'folder': folder,
    }


def _remove_stale(base, fname, correct_day_dir, correct_dest_name):
    """Remove any stale copy of fname with wrong prefix or in wrong date folder."""
    if not os.path.exists(base):
        return
    for date_dir in os.listdir(base):
        dpath = os.path.join(base, date_dir)
        if not os.path.isdir(dpath):
            continue
        for f in os.listdir(dpath):
            if f.endswith(fname):
                full = os.path.join(dpath, f)
                if dpath != correct_day_dir or f != correct_dest_name:
                    try:
                        os.remove(full)
                    except Exception:
                        pass


def sync_all_to_backup():
    """Full sync: copy all app images to backup with correct prefix and date folder."""
    folder = _get_backup_folder()
    if not folder:
        return {'ok': False, 'error': 'No backup folder configured'}

    try:
        image_map = build_image_map()
    except Exception as e:
        return {'ok': False, 'error': str(e)}

    base = os.path.join(folder, 'uploaded_imgs')
    copied = skipped = missing = 0
    errors = []

    for fname, info in image_map.items():
        src = os.path.join(UPLOADS_DIR, fname)
        if not os.path.exists(src):
            missing += 1
            continue

        date = info['date']
        prefix = info['prefix']
        day_dir = os.path.join(base, date)
        os.makedirs(day_dir, exist_ok=True)

        dest_name = f"{prefix}_{fname}"
        dest = os.path.join(day_dir, dest_name)

        _remove_stale(base, fname, day_dir, dest_name)

        if not os.path.exists(dest):
            try:
                shutil.copy2(src, dest)
                copied += 1
            except Exception as e:
                errors.append(f"{fname}: {e}")
        else:
            skipped += 1

    return {
        'ok': True,
        'copied': copied,
        'skipped': skipped,
        'missing': missing,
        'errors': errors[:10],
    }


def sync_date_to_backup(date):
    """Resync a single date after trade save — renames backup files if prefix changed."""
    folder = _get_backup_folder()
    if not folder:
        return
    try:
        image_map = build_image_map()
        base = os.path.join(folder, 'uploaded_imgs')
        date_images = {fn: info for fn, info in image_map.items() if info['date'] == date}
        if not date_images:
            return

        day_dir = os.path.join(base, date)
        os.makedirs(day_dir, exist_ok=True)

        for fname, info in date_images.items():
            src = os.path.join(UPLOADS_DIR, fname)
            if not os.path.exists(src):
                continue
            prefix = info['prefix']
            dest_name = f"{prefix}_{fname}"
            dest = os.path.join(day_dir, dest_name)
            _remove_stale(base, fname, day_dir, dest_name)
            if not os.path.exists(dest):
                try:
                    shutil.copy2(src, dest)
                except Exception:
                    pass
    except Exception:
        pass  # best-effort; never break the save flow
