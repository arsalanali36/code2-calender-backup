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
    """Return {filename: {'date', 'prefix'}} for every LOCAL image in trades data.
    CDN/remote URLs are ignored — only files that exist in UPLOADS_DIR are included."""
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
                if fname and not remote and os.path.exists(os.path.join(UPLOADS_DIR, fname)):
                    image_map[fname] = {'date': date, 'prefix': f'T{i + 1}'}

    for date, dd in day_data.items():
        if not date:
            continue
        for img in (dd.get('images') or []):
            fname, remote = _parse_img(img)
            if fname and not remote and fname not in image_map and os.path.exists(os.path.join(UPLOADS_DIR, fname)):
                image_map[fname] = {'date': date, 'prefix': 'DAY'}
        for img in (dd.get('closeImages') or []):
            fname, remote = _parse_img(img)
            if fname and not remote and fname not in image_map and os.path.exists(os.path.join(UPLOADS_DIR, fname)):
                image_map[fname] = {'date': date, 'prefix': 'CLOSE'}

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
        dest_name = f"{prefix}_{fname}"

        if os.path.exists(local_src):
            dest_dir = _day_dir(base, date)
            os.makedirs(dest_dir, exist_ok=True)
            dest = os.path.join(dest_dir, dest_name)
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
            # Remote CDN image — only create folder if download succeeds
            dest_dir = _day_dir(base, date)
            dest = os.path.join(dest_dir, dest_name)
            _remove_stale(base, fname, dest)
            if not os.path.exists(dest):
                os.makedirs(dest_dir, exist_ok=True)
                if _download_remote(remote, dest):
                    copied += 1
                    if not os.path.exists(local_src):
                        try:
                            shutil.copy2(dest, local_src)
                        except Exception:
                            pass
                else:
                    missing += 1  # CDN inaccessible — count as missing, not error
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
            dest_name = f"{prefix}_{fname}"
            dest_dir = _day_dir(base, date)
            dest = os.path.join(dest_dir, dest_name)
            _remove_stale(base, fname, dest)
            if not os.path.exists(dest):
                if os.path.exists(local_src):
                    os.makedirs(dest_dir, exist_ok=True)
                    try:
                        shutil.copy2(local_src, dest)
                    except Exception:
                        pass
                elif remote:
                    os.makedirs(dest_dir, exist_ok=True)
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


def _last_thursday(year, month):
    """Return YYYY-MM-DD of the last Thursday of the given month."""
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    from datetime import date
    for day in range(last_day, last_day - 7, -1):
        if date(year, month, day).weekday() == 3:  # Thursday
            return f'{year:04d}-{month:02d}-{day:02d}'
    return f'{year:04d}-{month:02d}-{last_day:02d}'


def _parse_option_symbol(name):
    """
    Parse NSE option symbol. Two formats:
      Monthly: NIFTY26APR24100CE   → last Thursday of Apr 2026
      Weekly:  NIFTY2640722900CE   → expiry 2026-04-07
    Returns (underlying, expiry_date_str, strike, opt_type) or None.
    """
    import re
    MON = {'JAN':'1','FEB':'2','MAR':'3','APR':'4','MAY':'5','JUN':'6',
           'JUL':'7','AUG':'8','SEP':'9','OCT':'10','NOV':'11','DEC':'12'}

    # Monthly: UNDERLYING + YY + MON(3 letters) + STRIKE + CE/PE
    m = re.match(r'^([A-Z&]+)(\d{2})([A-Z]{3})(\d+)(CE|PE)$', name)
    if m:
        underlying, yy, mon, strike, opt_type = m.groups()
        mm = int(MON.get(mon, 0))
        if mm:
            expiry = _last_thursday(2000 + int(yy), mm)
        else:
            expiry = f'20{yy}-00'
        return underlying, expiry, strike, opt_type

    # Weekly: UNDERLYING + YY + M (1 digit Jan-Sep) + DD + STRIKE + CE/PE
    m = re.match(r'^([A-Z&]+)(\d{2})([1-9])(\d{2})(\d+)(CE|PE)$', name)
    if m:
        underlying, yy, mm, dd, strike, opt_type = m.groups()
        expiry = f'20{yy}-{int(mm):02d}-{int(dd):02d}'
        return underlying, expiry, strike, opt_type

    # Weekly: UNDERLYING + YY + MM (2 digit Oct-Dec) + DD + STRIKE + CE/PE
    m = re.match(r'^([A-Z&]+)(\d{2})(1[0-2])(\d{2})(\d+)(CE|PE)$', name)
    if m:
        underlying, yy, mm, dd, strike, opt_type = m.groups()
        expiry = f'20{yy}-{int(mm):02d}-{int(dd):02d}'
        return underlying, expiry, strike, opt_type

    return None


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
        stem = os.path.splitext(fname)[0]

        parts = stem.split('_', 1)
        id_or_sym = parts[0]
        fetch_date = parts[1] if len(parts) > 1 else 'unknown'

        underlying = id_or_sym  # fallback
        expiry_label = fetch_date
        dest_fname = fname

        if id_or_sym.isdigit():
            info = scrip_map.get(id_or_sym)
            if info:
                underlying = info['underlying'] or id_or_sym
                expiry_label = f"{info['expiry']} Expiry" if info['expiry'] else fetch_date
                dest_fname = f"{info['strike']}_{info['type']}{ext}"
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


def _write_trades_csv(trades_list, dest_path):
    """Write trades list as a human-readable CSV."""
    import csv
    if not trades_list:
        return
    # Collect all keys across all trades for header
    all_keys = []
    seen = set()
    priority = ['date', 'Instrument', 'Buy Time', 'Buy Price (Avg)', 'Sell Price (Avg)',
                'Qty', 'Pt', 'Rs', 'Net P/L', 'Gross P/L', 'Day P&L', 'Broker', 'Note']
    for k in priority:
        if k not in seen:
            all_keys.append(k)
            seen.add(k)
    for t in trades_list:
        for k in t.keys():
            if k not in seen and k != 'images':
                all_keys.append(k)
                seen.add(k)
    with open(dest_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=all_keys, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(trades_list)


def _write_tags_csv(tags_snapshot, dest_path):
    """Write tags list as CSV."""
    import csv
    tags = tags_snapshot.get('allTags', [])
    if not tags:
        return
    with open(dest_path, 'w', newline='', encoding='utf-8-sig') as f:
        if isinstance(tags[0], dict):
            writer = csv.DictWriter(f, fieldnames=list(tags[0].keys()))
            writer.writeheader()
            writer.writerows(tags)
        else:
            writer = csv.writer(f)
            writer.writerow(['tag'])
            for t in tags:
                writer.writerow([t])


def _write_ohlc_csv(candles, dest_path):
    """Write OHLC candles list as CSV."""
    import csv
    if not candles:
        return
    keys = list(candles[0].keys()) if isinstance(candles[0], dict) else ['open','high','low','close','volume']
    with open(dest_path, 'w', newline='', encoding='utf-8-sig') as f:
        if isinstance(candles[0], dict):
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(candles)
        else:
            writer = csv.writer(f)
            writer.writerow(keys)
            writer.writerows(candles)


def sync_journal_data_to_backup():
    """Copy trades + config to journal_data/ as both JSON and CSV."""
    folder = _get_backup_folder()
    if not folder:
        return {'ok': False, 'error': 'No backup folder configured'}

    from config import BASE_DIR
    base = os.path.join(folder, 'journal_data')
    copied = 0

    for src_rel, dest_rel in _JOURNAL_FILES.items():
        src = os.path.join(BASE_DIR, src_rel)
        if not os.path.exists(src):
            continue
        dest = os.path.join(base, dest_rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        try:
            shutil.copy2(src, dest)
            copied += 1
        except Exception:
            pass

    # Extract trades + tags → JSON and CSV
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
        # tags.json
        with open(os.path.join(base, 'tags.json'), 'w', encoding='utf-8') as f:
            json.dump(tags_snapshot, f, ensure_ascii=False, indent=2)
        copied += 1

        # trades.csv
        _write_trades_csv(data.get('trades', []), os.path.join(base, 'trades.csv'))
        copied += 1

        # tags.csv
        _write_tags_csv(tags_snapshot, os.path.join(base, 'tags.csv'))
        copied += 1

    except Exception:
        pass

    return {'ok': True, 'copied': copied}


# ── Full Data Backup with SSE progress ───────────────────────────────────────

def sync_all_data():
    """Run all backup operations — non-streaming version."""
    return {
        'images':       sync_all_to_backup(),
        'ohlc_equity':  sync_ohlc_equity_to_backup(),
        'ohlc_options': sync_ohlc_options_to_backup(),
        'journal':      sync_journal_data_to_backup(),
    }


def sync_all_data_stream():
    """
    Generator: yields SSE-formatted progress lines during full backup.
    Each yield: 'data: {json}\\n\\n'
    """
    import time

    def _emit(phase, done, total, msg=''):
        pct = round(done / total * 100) if total else 0
        payload = json.dumps({'phase': phase, 'done': done, 'total': total, 'pct': pct, 'msg': msg})
        return f'data: {payload}\n\n'

    folder = _get_backup_folder()
    if not folder:
        yield _emit('error', 0, 1, 'No backup folder configured')
        return

    results = {}

    # ── Phase 1: Images ──────────────────────────────────────────────────────
    try:
        image_map = build_image_map()
    except Exception:
        image_map = {}
    total_img = len(image_map)
    yield _emit('images', 0, total_img, 'Images shuru...')

    img_base = os.path.join(folder, 'uploaded_imgs')
    copied = skipped = missing = 0
    errors = []
    items = list(image_map.items())

    for i, (fname, info) in enumerate(items):
        date   = info['date']
        prefix = info['prefix']
        remote = info.get('remote')
        local_src = os.path.join(UPLOADS_DIR, fname)
        dest_name = f"{prefix}_{fname}"
        dest_dir  = _day_dir(img_base, date)
        dest = os.path.join(dest_dir, dest_name)

        if os.path.exists(local_src):
            os.makedirs(dest_dir, exist_ok=True)
            _remove_stale(img_base, fname, dest)
            if not os.path.exists(dest):
                try:
                    shutil.copy2(local_src, dest)
                    copied += 1
                except Exception as e:
                    errors.append(str(e))
            else:
                skipped += 1
        elif remote:
            _remove_stale(img_base, fname, dest)
            if not os.path.exists(dest):
                os.makedirs(dest_dir, exist_ok=True)
                if _download_remote(remote, dest):
                    copied += 1
                    if not os.path.exists(local_src):
                        try: shutil.copy2(dest, local_src)
                        except Exception: pass
                else:
                    missing += 1  # CDN inaccessible
            else:
                skipped += 1
        else:
            missing += 1

        if i % 20 == 0 or i == total_img - 1:
            yield _emit('images', i + 1, total_img,
                        f'Copied {copied}, skipped {skipped}, missing {missing}')

    results['images'] = {'ok': True, 'copied': copied, 'skipped': skipped, 'missing': missing}

    # ── Phase 2: OHLC Equity ─────────────────────────────────────────────────
    from config import BASE_DIR
    eq_src_dir = os.path.join(BASE_DIR, 'data', 'algo_ohlc')
    eq_files = [f for f in os.listdir(eq_src_dir) if f.endswith('.json')] if os.path.exists(eq_src_dir) else []
    total_eq = len(eq_files)
    yield _emit('ohlc_equity', 0, total_eq, 'OHLC Equity shuru...')

    eq_base = os.path.join(folder, 'ohlc_equity')
    eq_copied = eq_skipped = 0
    for i, fname in enumerate(eq_files):
        parts = fname.replace('.json', '').rsplit('_', 1)
        if len(parts) == 2:
            symbol, date = parts
            dest_dir = os.path.join(eq_base, symbol)
            os.makedirs(dest_dir, exist_ok=True)
            src = os.path.join(eq_src_dir, fname)

            # Copy JSON
            dest_json = os.path.join(dest_dir, f'{date}.json')
            if not os.path.exists(dest_json):
                try:
                    shutil.copy2(src, dest_json)
                    eq_copied += 1
                except Exception:
                    pass
            else:
                eq_skipped += 1

            # Also write CSV of candles
            dest_csv = os.path.join(dest_dir, f'{date}.csv')
            if not os.path.exists(dest_csv):
                try:
                    with open(src, encoding='utf-8') as fh:
                        d = json.load(fh)
                    candles = d.get('candles', [])
                    if candles:
                        _write_ohlc_csv(candles, dest_csv)
                except Exception:
                    pass

        if i % 5 == 0 or i == total_eq - 1:
            yield _emit('ohlc_equity', i + 1, total_eq, f'Copied {eq_copied}')

    results['ohlc_equity'] = {'ok': True, 'copied': eq_copied, 'skipped': eq_skipped}

    # ── Phase 3: OHLC Options ────────────────────────────────────────────────
    opt_src_dir = os.path.join(BASE_DIR, 'data', 'Historical_OHLC', 'Options')
    opt_files = os.listdir(opt_src_dir) if os.path.exists(opt_src_dir) else []
    total_opt = len(opt_files)
    yield _emit('ohlc_options', 0, total_opt, 'Options shuru...')

    scrip_map = _load_scrip_map()
    opt_base = os.path.join(folder, 'ohlc_options')
    opt_copied = opt_skipped = 0

    for i, fname in enumerate(opt_files):
        src = os.path.join(opt_src_dir, fname)
        if not os.path.isfile(src):
            continue
        ext  = os.path.splitext(fname)[1]
        stem = os.path.splitext(fname)[0]
        parts = stem.split('_', 1)
        if len(parts) < 2:
            continue
        id_or_sym = parts[0]
        underlying = id_or_sym
        expiry_label = parts[1] if len(parts) > 1 else 'unknown'
        dest_fname = fname

        if id_or_sym.isdigit():
            info = scrip_map.get(id_or_sym)
            if info:
                underlying   = info['underlying'] or id_or_sym
                expiry_label = f"{info['expiry']} Expiry" if info['expiry'] else parts[1]
                dest_fname   = f"{info['strike']}_{info['type']}{ext}"
        else:
            parsed = _parse_option_symbol(id_or_sym)
            if parsed:
                underlying, expiry_month, strike, opt_type = parsed
                expiry_label = f"{expiry_month} Expiry"
                dest_fname = f"{strike}_{opt_type}{ext}"

        dest_dir = os.path.join(opt_base, underlying, expiry_label)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, dest_fname)
        if not os.path.exists(dest):
            try:
                shutil.copy2(src, dest)
                opt_copied += 1
            except Exception:
                pass
        else:
            opt_skipped += 1

        if i % 20 == 0 or i == total_opt - 1:
            yield _emit('ohlc_options', i + 1, total_opt, f'Copied {opt_copied}')

    results['ohlc_options'] = {'ok': True, 'copied': opt_copied, 'skipped': opt_skipped}

    # ── Phase 4: Journal Data ────────────────────────────────────────────────
    total_j = len(_JOURNAL_FILES) + 3  # +3 for tags.json, trades.csv, tags.csv
    yield _emit('journal', 0, total_j, 'Journal data shuru...')

    jd_result = sync_journal_data_to_backup()
    results['journal'] = jd_result
    yield _emit('journal', total_j, total_j, f"Copied {jd_result.get('copied', 0)}")

    # ── Done ─────────────────────────────────────────────────────────────────
    done_payload = json.dumps({'phase': 'done', 'results': results})
    yield f'data: {done_payload}\n\n'


def get_full_backup_stats():
    """Stats for all backup categories."""
    folder = _get_backup_folder()
    from config import BASE_DIR

    def _count_dir(path):
        if not os.path.exists(path):
            return 0
        return sum(len(fs) for _, _, fs in os.walk(path))

    img_stats = get_backup_stats()

    eq_src_dir = os.path.join(BASE_DIR, 'data', 'algo_ohlc')
    ohlc_eq_src = len([f for f in os.listdir(eq_src_dir) if f.endswith('.json')]) if os.path.exists(eq_src_dir) else 0
    opt_src_dir = os.path.join(BASE_DIR, 'data', 'Historical_OHLC', 'Options')
    ohlc_opt_src = len([f for f in os.listdir(opt_src_dir) if f.endswith('.csv')]) if os.path.exists(opt_src_dir) else 0

    # Equity: count only .json files in backup (each source also produces a .csv — don't double-count)
    def _count_json(path):
        if not os.path.exists(path): return 0
        return sum(1 for _, _, fs in os.walk(path) for f in fs if f.endswith('.json'))

    def _count_csv(path):
        if not os.path.exists(path): return 0
        return sum(1 for _, _, fs in os.walk(path) for f in fs if f.endswith('.csv'))

    bk_eq    = _count_json(os.path.join(folder, 'ohlc_equity'))  if folder else 0
    bk_opt   = _count_csv(os.path.join(folder, 'ohlc_options'))  if folder else 0
    bk_jdata = _count_dir(os.path.join(folder, 'journal_data'))  if folder else 0

    return {
        'images':       img_stats,
        'ohlc_equity':  {'total': ohlc_eq_src,  'backed_up': bk_eq},
        'ohlc_options': {'total': ohlc_opt_src, 'backed_up': bk_opt},
        'journal':      {'total': len(_JOURNAL_FILES) + 3, 'backed_up': bk_jdata},
        'folder':       folder or '',
    }
