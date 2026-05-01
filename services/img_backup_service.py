"""
services/img_backup_service.py
-------------------------------
Image backup: copies app images to a user-chosen folder with
prefix naming (T1_, T2_, DAY_, CLOSE_) and date sub-folders.

Structure: uploaded_imgs/02 - Feb/2026-02-03/T1_filename.jpg
"""
import os
import json
import shutil
from collections import defaultdict

from config import BACKUP_CONFIG_FILE, UPLOADS_DIR
from processors.data_processors import find_best_trades_file

_MONTH_NAMES = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}


def _month_folder(date_str):
    """'2026-02-03' -> '02 - Feb'"""
    parts = date_str.split('-')
    if len(parts) < 2:
        return 'Unknown'
    mm = parts[1]
    return f"{mm} - {_MONTH_NAMES.get(mm, mm)}"


def _day_dir(base, date_str):
    """Full path to the date sub-folder inside the month folder."""
    return os.path.join(base, _month_folder(date_str), date_str)


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


def _all_backup_files(base):
    """Yield (original_filename, full_path) for every file in the backup tree."""
    if not os.path.exists(base):
        return
    for month_dir in os.listdir(base):
        mpath = os.path.join(base, month_dir)
        if not os.path.isdir(mpath):
            continue
        for date_dir in os.listdir(mpath):
            dpath = os.path.join(mpath, date_dir)
            if not os.path.isdir(dpath):
                continue
            for f in os.listdir(dpath):
                idx = f.find('_')
                orig = f[idx + 1:] if idx != -1 else f
                yield orig, os.path.join(dpath, f)


def _backed_filenames(base):
    return {orig for orig, _ in _all_backup_files(base)}


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


def _remove_stale(base, fname, correct_full_dest):
    """Remove any stale copy of fname that isn't at correct_full_dest."""
    for orig, full_path in list(_all_backup_files(base)):
        if orig == fname and full_path != correct_full_dest:
            try:
                os.remove(full_path)
            except Exception:
                pass


def sync_all_to_backup():
    """Full sync: copy all app images to backup with correct prefix and date/month folders."""
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
        dest_dir = _day_dir(base, date)
        os.makedirs(dest_dir, exist_ok=True)

        dest_name = f"{prefix}_{fname}"
        dest = os.path.join(dest_dir, dest_name)

        _remove_stale(base, fname, dest)

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

        for fname, info in date_images.items():
            src = os.path.join(UPLOADS_DIR, fname)
            if not os.path.exists(src):
                continue
            prefix = info['prefix']
            dest_dir = _day_dir(base, date)
            os.makedirs(dest_dir, exist_ok=True)
            dest_name = f"{prefix}_{fname}"
            dest = os.path.join(dest_dir, dest_name)
            _remove_stale(base, fname, dest)
            if not os.path.exists(dest):
                try:
                    shutil.copy2(src, dest)
                except Exception:
                    pass
    except Exception:
        pass


def migrate_flat_to_month_folders(folder):
    """
    One-time migration: move files from old flat structure
    (uploaded_imgs/2026-02-03/file) to new month structure
    (uploaded_imgs/02 - Feb/2026-02-03/file).
    """
    base = os.path.join(folder, 'uploaded_imgs')
    if not os.path.exists(base):
        return 0

    moved = 0
    for entry in os.listdir(base):
        epath = os.path.join(base, entry)
        # Old flat date folders look like YYYY-MM-DD
        if not os.path.isdir(epath):
            continue
        parts = entry.split('-')
        if len(parts) != 3 or len(parts[0]) != 4:
            continue  # already a month folder or unknown

        date_str = entry
        new_dir = _day_dir(base, date_str)
        if new_dir == epath:
            continue  # already in right place (shouldn't happen)

        os.makedirs(new_dir, exist_ok=True)
        for f in os.listdir(epath):
            src = os.path.join(epath, f)
            dst = os.path.join(new_dir, f)
            if not os.path.exists(dst):
                shutil.move(src, dst)
                moved += 1

        # Remove old empty folder
        try:
            os.rmdir(epath)
        except OSError:
            pass

    return moved
