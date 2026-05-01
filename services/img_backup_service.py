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


def _parse_img(url):
    """Return (filename, remote_url_or_None) for an image URL."""
    if not url:
        return None, None
    fname = url.split('/')[-1].split('?')[0]
    if not fname:
        return None, None
    remote = url if url.startswith('http') else None
    return fname, remote


def build_image_map():
    """Return {filename: {'date', 'prefix', 'remote'}} for every image in trades data.
    'remote' is the CDN URL if not stored locally, else None."""
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
                fname, remote = _parse_img(img)
                if fname:
                    image_map[fname] = {'date': date, 'prefix': f'T{i + 1}', 'remote': remote}

    for date, dd in day_data.items():
        if not date:
            continue
        for img in (dd.get('images') or []):
            fname, remote = _parse_img(img)
            if fname and fname not in image_map:
                image_map[fname] = {'date': date, 'prefix': 'DAY', 'remote': remote}
        for img in (dd.get('closeImages') or []):
            fname, remote = _parse_img(img)
            if fname and fname not in image_map:
                image_map[fname] = {'date': date, 'prefix': 'CLOSE', 'remote': remote}

    return image_map


def _download_remote(url, dest_path):
    """Download a remote image URL to dest_path. Returns True on success."""
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        with open(dest_path, 'wb') as f:
            f.write(data)
        return True
    except Exception:
        return False


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
        date = info['date']
        prefix = info['prefix']
        remote = info.get('remote')

        local_src = os.path.join(UPLOADS_DIR, fname)

        dest_dir = _day_dir(base, date)
        os.makedirs(dest_dir, exist_ok=True)
        dest_name = f"{prefix}_{fname}"
        dest = os.path.join(dest_dir, dest_name)

        if os.path.exists(local_src):
            _remove_stale(base, fname, dest)
            if not os.path.exists(dest):
                try:
                    shutil.copy2(local_src, dest)
                    copied += 1
                except Exception as e:
                    errors.append(f"{fname}: {e}")
            else:
                skipped += 1
        elif remote:
            # Remote CDN image — download directly to backup
            _remove_stale(base, fname, dest)
            if not os.path.exists(dest):
                if _download_remote(remote, dest):
                    copied += 1
                    # Also save locally so app doesn't depend on CDN
                    if not os.path.exists(local_src):
                        try:
                            shutil.copy2(dest, local_src)
                        except Exception:
                            pass
                else:
                    errors.append(f"Download failed: {remote[:60]}")
            else:
                skipped += 1
        else:
            missing += 1

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
            prefix = info['prefix']
            remote = info.get('remote')
            local_src = os.path.join(UPLOADS_DIR, fname)
            dest_dir = _day_dir(base, date)
            os.makedirs(dest_dir, exist_ok=True)
            dest_name = f"{prefix}_{fname}"
            dest = os.path.join(dest_dir, dest_name)
            _remove_stale(base, fname, dest)
            if not os.path.exists(dest):
                if os.path.exists(local_src):
                    try:
                        shutil.copy2(local_src, dest)
                    except Exception:
                        pass
                elif remote:
                    if _download_remote(remote, dest) and not os.path.exists(local_src):
                        try:
                            shutil.copy2(dest, local_src)
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


# ── OHLC Equity Backup ────────────────────────────────────────────────────────

def sync_ohlc_equity_to_backup():
    """
    Copy algo_ohlc/SYMBOL_DATE.json files to:
    backup/ohlc_equity/SYMBOL/DATE.json
    """
    folder = _get_backup_folder()
    if not folder:
        return {'ok': False, 'error': 'No backup folder configured'}

    from config import BASE_DIR
    src_dir = os.path.join(BASE_DIR, 'data', 'algo_ohlc')
    if not os.path.exists(src_dir):
        return {'ok': True, 'copied': 0, 'skipped': 0, 'note': 'No algo_ohlc folder'}

    base = os.path.join(folder, 'ohlc_equity')
    copied = skipped = 0

    for fname in os.listdir(src_dir):
        if not fname.endswith('.json'):
            continue
        # SYMBOL_DATE.json  e.g. RELIANCE_2026-04-30.json
        parts = fname.replace('.json', '').rsplit('_', 1)
        if len(parts) != 2:
            continue
        symbol, date = parts
        dest_dir = os.path.join(base, symbol)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, f'{date}.json')
        src = os.path.join(src_dir, fname)
        if not os.path.exists(dest):
            try:
                shutil.copy2(src, dest)
                copied += 1
            except Exception:
                pass
        else:
            skipped += 1

    return {'ok': True, 'copied': copied, 'skipped': skipped}


# ── OHLC Options Backup ───────────────────────────────────────────────────────

def _load_scrip_map():
    """Return {security_id: {'underlying', 'expiry', 'strike', 'type'}} from CSV."""
    import csv
    from config import BASE_DIR
    csv_path = os.path.join(BASE_DIR, 'data', 'dhan_scrip_master.csv')
    result = {}
    if not os.path.exists(csv_path):
        return result
    with open(csv_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            sid = row.get('SEM_SMST_SECURITY_ID', '').strip()
            sym = row.get('SM_SYMBOL_NAME', '') or row.get('SEM_TRADING_SYMBOL', '')
            expiry = row.get('SEM_EXPIRY_DATE', '')[:10]  # YYYY-MM-DD
            strike = row.get('SEM_STRIKE_PRICE', '').split('.')[0]
            opt_type = row.get('SEM_OPTION_TYPE', '')
            # Underlying: extract from trading symbol e.g. NIFTY-May2026-25650-PE
            trading = row.get('SEM_TRADING_SYMBOL', '')
            underlying = trading.split('-')[0] if '-' in trading else trading[:10]
            if sid:
                result[sid] = {
                    'underlying': underlying,
                    'expiry': expiry,
                    'strike': strike,
                    'type': opt_type,
                }
    return result


def _parse_option_symbol(name):
    """
    Parse a symbol-style filename prefix like BANKNIFTY26APR57500CE.
    Returns (underlying, expiry_label, strike, opt_type) or None.
    """
    import re
    # Pattern: UNDERLYING + date(YYMONDD or similar) + STRIKE + CE/PE
    m = re.match(r'^([A-Z]+)(\d{2})([A-Z]{3})(\d+)(CE|PE)$', name)
    if not m:
        return None
    underlying, yy, mon, strike, opt_type = m.groups()
    mon_map = {'JAN':'01','FEB':'02','MAR':'03','APR':'04','MAY':'05','JUN':'06',
               'JUL':'07','AUG':'08','SEP':'09','OCT':'10','NOV':'11','DEC':'12'}
    mm = mon_map.get(mon, '00')
    expiry = f'20{yy}-{mm}'  # approximate month
    return underlying, expiry, strike, opt_type


def sync_ohlc_options_to_backup():
    """
    Copy Historical_OHLC/Options/ files to:
    backup/ohlc_options/UNDERLYING/YYYY-MM-DD Expiry/STRIKE_TYPE.csv
    """
    folder = _get_backup_folder()
    if not folder:
        return {'ok': False, 'error': 'No backup folder configured'}

    from config import BASE_DIR
    src_dir = os.path.join(BASE_DIR, 'data', 'Historical_OHLC', 'Options')
    if not os.path.exists(src_dir):
        return {'ok': True, 'copied': 0, 'skipped': 0, 'note': 'No Options folder'}

    scrip_map = _load_scrip_map()
    base = os.path.join(folder, 'ohlc_options')
    copied = skipped = 0

    for fname in os.listdir(src_dir):
        src = os.path.join(src_dir, fname)
        if not os.path.isfile(src):
            continue

        ext = os.path.splitext(fname)[1]  # .csv or .meta
        stem = os.path.splitext(fname)[0]  # e.g. 13_2026-04-15 or BANKNIFTY26APR57500CE_2026-04-15

        parts = stem.split('_', 1)
        if len(parts) < 2:
            continue
        id_or_sym, fetch_date = parts[0], parts[1]

        underlying = 'UNKNOWN'
        expiry_label = fetch_date
        dest_fname = fname

        if id_or_sym.isdigit():
            info = scrip_map.get(id_or_sym)
            if info:
                underlying = info['underlying'] or 'UNKNOWN'
                expiry_label = f"{info['expiry']} Expiry" if info['expiry'] else fetch_date
                strike = info['strike']
                opt_type = info['type']
                dest_fname = f"{strike}_{opt_type}{ext}"
        else:
            parsed = _parse_option_symbol(id_or_sym)
            if parsed:
                underlying, expiry_month, strike, opt_type = parsed
                expiry_label = f"{expiry_month} Expiry"
                dest_fname = f"{strike}_{opt_type}{ext}"

        dest_dir = os.path.join(base, underlying, expiry_label)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, dest_fname)

        if not os.path.exists(dest):
            try:
                shutil.copy2(src, dest)
                copied += 1
            except Exception:
                pass
        else:
            skipped += 1

    return {'ok': True, 'copied': copied, 'skipped': skipped}


# ── Journal JSON Backup ───────────────────────────────────────────────────────

_JOURNAL_FILES = {
    # (src relative to BASE_DIR, dest relative to journal_data/)
    'data/trades_1.json':               'trades.json',
    'data/algo_config.json':            'algo/algo_config.json',
    'data/algo_watchlist.json':         'algo/algo_watchlist.json',
    'data/algo_orders.json':            'algo/algo_orders.json',
    'data/daily_pivot_levels.json':     'strategy/daily_pivot_levels.json',
    'data/symbol_expiry_map.json':      'strategy/symbol_expiry_map.json',
    'data/manual_pivots.json':          'strategy/manual_pivots.json',
    'data/dhan_config.json':            'config/dhan_config.json',
    'data/dhan_symbol_map.json':        'config/dhan_symbol_map.json',
    'data/pdfs.json':                   'config/pdfs.json',
    'data/features.json':               'config/features.json',
    'data/log_schema.json':             'config/log_schema.json',
}


def sync_journal_data_to_backup():
    """
    Copy trades JSON and config files to backup/journal_data/.
    Also extract tags/columns from trades into a separate tags.json.
    """
    folder = _get_backup_folder()
    if not folder:
        return {'ok': False, 'error': 'No backup folder configured'}

    from config import BASE_DIR
    base = os.path.join(folder, 'journal_data')
    copied = skipped = 0

    for src_rel, dest_rel in _JOURNAL_FILES.items():
        src = os.path.join(BASE_DIR, src_rel)
        if not os.path.exists(src):
            continue
        dest = os.path.join(base, dest_rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        # Always overwrite JSON data (it changes)
        try:
            shutil.copy2(src, dest)
            copied += 1
        except Exception:
            pass

    # Extract tags, columns, tag groups into readable tags.json
    try:
        trades_file = os.path.join(BASE_DIR, 'data', 'trades_1.json')
        with open(trades_file, encoding='utf-8') as f:
            data = json.load(f)
        tags_snapshot = {
            'allTags':      data.get('allTags', []),
            'columns':      data.get('columns', []),
            'tagColumns':   data.get('tagColumns', []),
            'tagGroups':    data.get('tagGroups', {}),
            'tagTemplates': data.get('tagTemplates', []),
            'imgTypes':     data.get('imgTypes', []),
        }
        tags_dest = os.path.join(base, 'tags.json')
        with open(tags_dest, 'w', encoding='utf-8') as f:
            json.dump(tags_snapshot, f, ensure_ascii=False, indent=2)
        copied += 1
    except Exception:
        pass

    return {'ok': True, 'copied': copied, 'skipped': skipped}


# ── Full Data Backup ──────────────────────────────────────────────────────────

def sync_all_data():
    """Run all backup operations: images + OHLC equity + options + journal JSON."""
    results = {}
    results['images']       = sync_all_to_backup()
    results['ohlc_equity']  = sync_ohlc_equity_to_backup()
    results['ohlc_options'] = sync_ohlc_options_to_backup()
    results['journal']      = sync_journal_data_to_backup()
    return results


def get_full_backup_stats():
    """Stats for all backup categories."""
    folder = _get_backup_folder()
    from config import BASE_DIR

    def _count_dir(path):
        if not os.path.exists(path):
            return 0
        return sum(len(fs) for _, _, fs in os.walk(path))

    img_stats = get_backup_stats()

    ohlc_eq_src   = len([f for f in os.listdir(os.path.join(BASE_DIR,'data','algo_ohlc'))
                         if f.endswith('.json')]) if os.path.exists(os.path.join(BASE_DIR,'data','algo_ohlc')) else 0
    opt_src_dir   = os.path.join(BASE_DIR,'data','Historical_OHLC','Options')
    ohlc_opt_src  = len(os.listdir(opt_src_dir)) if os.path.exists(opt_src_dir) else 0

    bk_eq    = _count_dir(os.path.join(folder,'ohlc_equity'))  if folder else 0
    bk_opt   = _count_dir(os.path.join(folder,'ohlc_options')) if folder else 0
    bk_jdata = _count_dir(os.path.join(folder,'journal_data')) if folder else 0

    return {
        'images':       img_stats,
        'ohlc_equity':  {'total': ohlc_eq_src,  'backed_up': bk_eq},
        'ohlc_options': {'total': ohlc_opt_src, 'backed_up': bk_opt},
        'journal':      {'total': len(_JOURNAL_FILES) + 1, 'backed_up': bk_jdata},
        'folder':       folder or '',
    }
