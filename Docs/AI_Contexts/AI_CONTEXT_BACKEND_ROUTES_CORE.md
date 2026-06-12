# Backend - Core Routes (page, trade, image, import, export)
Consolidated code context for AI assistants.


## File: `routes/page_routes.py`
```py
"""
routes/page_routes.py
---------------------
HTML page routes: main app and dev-blog updates.
"""
import json
import os
import time

from flask import Blueprint, render_template, jsonify, send_from_directory, redirect, request
from flask_login import current_user

from config import BASE_DIR, CACHE_BUST, DATA_FILE
from processors.data_processors import get_user_data_file
BUNDLE_PATH = os.path.join(BASE_DIR, 'static', 'js', 'bundle.js')
from services.page_service import get_blog_entries_for_template, get_blog_entries_for_api

MOBILE_DIST = os.path.join(BASE_DIR, 'tradefeed', 'dist')

MOBILE_KEYWORDS = ('Mobile', 'Android', 'iPhone', 'iPad', 'iPod', 'BlackBerry', 'IEMobile', 'Opera Mini')

page_bp = Blueprint('page', __name__)

BLOG_PATH = os.path.join(BASE_DIR, 'data', 'dev-blog.json')


@page_bp.route('/')
def index():
    ua = request.headers.get('User-Agent', '')
    if any(k in ua for k in MOBILE_KEYWORDS):
        return redirect('/mobile/')
    # Unauthenticated visitors land on the public pitch deck, not the login wall
    if not current_user.is_authenticated:
        return redirect('/app-deck')
    # Embed trades data directly in HTML — eliminates the /api/trades round-trip on load
    # Must read the user-specific file so authenticated users see their own data
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        user_data_file = get_user_data_file(user_id)
        with open(user_data_file, 'r', encoding='utf-8') as f:
            initial_data_json = f.read()
        # Validate it's real JSON (don't embed corrupt data)
        json.loads(initial_data_json)
    except Exception:
        initial_data_json = '{}'
    use_bundle = os.environ.get('USE_BUNDLE') == '1' and os.path.exists(BUNDLE_PATH)
    return render_template('index.html', cache_bust=int(time.time()),
                           initial_data_json=initial_data_json,
                           use_bundle=use_bundle)


@page_bp.route('/updates')
def updates():
    entries = get_blog_entries_for_template(BLOG_PATH)
    return render_template('updates.html', entries=entries, cache_bust=int(time.time()))


@page_bp.route('/gallery-classic')
def gallery_classic():
    return render_template('gallery_classic_page.html', cache_bust=int(time.time()))


@page_bp.route('/strategy-lab')
def strategy_lab():
    return render_template('strategy_lab.html', cache_bust=int(time.time()))


@page_bp.route('/mobile/')
@page_bp.route('/mobile')
def mobile():
    return send_from_directory(MOBILE_DIST, 'index.html')


@page_bp.route('/mobile/assets/<path:filename>')
def mobile_assets(filename):
    return send_from_directory(os.path.join(MOBILE_DIST, 'assets'), filename)


_DECK_DEFAULTS = {
    "offer": {
        "highlight": "Free 30-Day Trial",
        "cta": "Start Free Trial"
    },
    "hero_title": "Your Trading Edge Starts Here",
    "hero_subtitle": "The most powerful trading journal built for serious traders. Track, review, and improve every single trade.",
    "tagline": "Har trade ka hisaab. Ab code se.",
    "categories": []
}


@page_bp.route('/app-deck')
def app_deck():
    features_path = os.path.join(BASE_DIR, 'data', 'features.json')
    try:
        if os.path.exists(features_path):
            with open(features_path, 'r', encoding='utf-8') as f:
                deck_data = json.load(f)
        else:
            deck_data = {}
    except Exception:
        deck_data = {}

    # Deep-merge defaults so missing keys never crash the template
    for key, val in _DECK_DEFAULTS.items():
        if key not in deck_data:
            deck_data[key] = val
        elif isinstance(val, dict) and isinstance(deck_data.get(key), dict):
            for subkey, subval in val.items():
                if subkey not in deck_data[key]:
                    deck_data[key][subkey] = subval

    return render_template('app_deck.html', deck=deck_data, cache_bust=int(time.time()))


@page_bp.route('/api/blog-posts')
def blog_posts_api():
    return jsonify(get_blog_entries_for_api(BLOG_PATH))


@page_bp.route('/bulk-download')
def bulk_download_page():
    return render_template('bulk_download.html')

```

## File: `routes/trade_routes.py`
```py
"""
routes/trade_routes.py
----------------------
API routes for reading and writing the trades payload.
"""
import os
from flask import Blueprint, request, jsonify
from flask_login import current_user

from services.trade_service import get_all_trades, save_trades

trade_bp = Blueprint('trade', __name__)


def _get_user_id():
    """Extract user_id from the current session (None for unauthenticated/single-user)."""
    return current_user.id if current_user.is_authenticated else None


@trade_bp.route('/api/trades', methods=['GET'])
def get_trades():
    uid = _get_user_id()
    _ensure_demo_data(uid)
    return jsonify(get_all_trades(user_id=uid))


def _ensure_demo_data(uid):
    """Generate demo data on first load if user has no data file yet (belt-and-suspenders fallback)."""
    if uid is None or uid == 1:
        return
    from config import BASE_DIR
    dest = os.path.join(BASE_DIR, 'data', f'trades_{uid}.json')
    if not os.path.exists(dest):
        try:
            from services.demo_service import generate_demo_data_for_user
            generate_demo_data_for_user(uid)
        except Exception:
            pass


@trade_bp.route('/api/trades', methods=['POST'])
def post_trades():
    data = request.json
    if not data:
        return jsonify({'error': 'No data'}), 400
    try:
        save_trades(data, user_id=_get_user_id())
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    # Resync backup for any date touched in this save (real-time prefix rename)
    _trigger_backup_sync(data)
    return jsonify({'success': True})


@trade_bp.route('/api/trades/clear-demo', methods=['POST'])
def clear_demo():
    """Reset a demo-mode user's data to an empty journal."""
    uid = _get_user_id()
    if uid is None:
        return jsonify({'error': 'Unauthorized'}), 401
    empty = {
        'trades': [], 'columns': ['Date', 'Profit', 'Trade'],
        'allTags': [], 'tagColumns': [], 'userColumns': [],
        'dayData': {}, 'tagGroups': {}, 'pdfPageTags': {},
        'importedPdfs': [], 'tagTemplates': {}, 'imgTypes': {}, 'uiSettings': {},
    }
    try:
        save_trades(empty, user_id=uid)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'success': True})


@trade_bp.route('/api/trades/restore-demo', methods=['POST'])
def restore_demo():
    """Restore demo data for the current user (re-generates from source)."""
    uid = _get_user_id()
    if uid is None:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        from services.demo_service import restore_demo_data_for_user
        had_backup = restore_demo_data_for_user(uid)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'success': True, 'has_backup': had_backup})


@trade_bp.route('/api/trades/undo-demo-restore', methods=['POST'])
def undo_demo_restore():
    """Restore the most recent pre-demo backup for the current user."""
    uid = _get_user_id()
    if uid is None:
        return jsonify({'error': 'Unauthorized'}), 401
    import shutil
    from config import BASE_DIR
    backup_dir = os.path.join(BASE_DIR, 'data', 'backups')
    prefix = f'trades_backup_user_{uid}_'
    try:
        files = sorted(
            f for f in os.listdir(backup_dir) if f.startswith(prefix)
        )
    except FileNotFoundError:
        return jsonify({'error': 'No backup found'}), 404
    if not files:
        return jsonify({'error': 'No backup found'}), 404
    latest = os.path.join(backup_dir, files[-1])
    dest = os.path.join(BASE_DIR, 'data', f'trades_{uid}.json')
    try:
        shutil.copy2(latest, dest)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'success': True})


def _trigger_backup_sync(data):
    """Fire-and-forget: resync backup for dates present in the saved payload."""
    import threading
    from services.img_backup_service import sync_date_to_backup
    dates = set()
    for t in (data.get('trades') or []):
        d = t.get('date', '')
        if d:
            dates.add(d)
    for d in (data.get('dayData') or {}).keys():
        if d:
            dates.add(d)
    if dates:
        threading.Thread(target=lambda: [sync_date_to_backup(d) for d in dates], daemon=True).start()

```

## File: `routes/image_routes.py`
```py
"""
routes/image_routes.py
----------------------
API routes for image upload, delete, clipboard copy, timestamps,
and serving uploaded files.
"""
import os
import uuid
import time
import json
import threading

from flask import Blueprint, request, jsonify, send_from_directory, Response
from flask_login import current_user
from werkzeug.utils import secure_filename

from services.image_service import (
    save_uploaded_image, move_to_trash, get_image_times, copy_image_to_clipboard,
    save_uploaded_pdf, save_pdf_bytes, list_uploaded_pdfs, delete_uploaded_pdf, update_pdf_pages,
)
from config import UPLOADS_DIR, TRASH_DIR, AUDIO_DIR, VIDEO_DIR, PDF_DIR, PDF_META_FILE, USE_IMAGEKIT, BACKUP_CONFIG_FILE, get_uploads_dir, get_trash_dir

image_bp = Blueprint('image', __name__)

# ── PDF processing job tracker ────────────────────────────────────────────────
_pdf_jobs      = {}   # job_id -> state dict
_pdf_jobs_lock = threading.Lock()


@image_bp.route('/api/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        last_modified_ms = request.form.get('last_modified_ms')
        last_modified_s = float(last_modified_ms) / 1000.0 if last_modified_ms else None
        original_filename = secure_filename(request.form.get('original_filename', ''))
        uid = current_user.id if current_user.is_authenticated else None
        user_uploads = get_uploads_dir(uid)
        os.makedirs(user_uploads, exist_ok=True)
        os.makedirs(get_trash_dir(uid), exist_ok=True)
        result = save_uploaded_image(file, user_uploads, last_modified_s, original_filename)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@image_bp.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve local uploads. Cloudinary files are served directly by Cloudinary CDN.
    Falls back to video/ and audio/ subfolders if file not found in root (handles old wrong-path references).
    """
    import os as _os
    # Try exact path first
    if _os.path.exists(_os.path.join(UPLOADS_DIR, filename)):
        return send_from_directory(UPLOADS_DIR, filename)
    # Fallback: if it's a bare filename (no subfolder), check user_1/, video/, audio/
    if '/' not in filename:
        for sub in ('user_1', 'video', 'audio'):
            alt = _os.path.join(UPLOADS_DIR, sub, filename)
            if _os.path.exists(alt):
                return send_from_directory(_os.path.join(UPLOADS_DIR, sub), filename)
    return send_from_directory(UPLOADS_DIR, filename)  # will 404 naturally


@image_bp.route('/api/delete-image', methods=['POST'])
def delete_image():
    data = request.json or {}
    filename = data.get('filename', '')
    if not filename:
        return jsonify({'error': 'No filename'}), 400
    uid = current_user.id if current_user.is_authenticated else None
    moved = move_to_trash(filename, get_uploads_dir(uid), get_trash_dir(uid))
    return jsonify({'success': moved})


@image_bp.route('/api/image-times', methods=['POST'])
def image_times():
    urls = (request.json or {}).get('urls', [])
    uid = current_user.id if current_user.is_authenticated else None
    return jsonify(get_image_times(urls, get_uploads_dir(uid)))


@image_bp.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio'}), 400
    file = request.files['audio']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    import uuid, os as _os
    _os.makedirs(AUDIO_DIR, exist_ok=True)
    ext = _os.path.splitext(secure_filename(file.filename))[1] or '.webm'
    fname = f"{uuid.uuid4().hex}{ext}"
    file.save(_os.path.join(AUDIO_DIR, fname))
    return jsonify({'url': f'/uploads/audio/{fname}'})


@image_bp.route('/api/upload-video', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video'}), 400
    file = request.files['video']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    import uuid, os as _os
    _os.makedirs(VIDEO_DIR, exist_ok=True)
    ext = _os.path.splitext(secure_filename(file.filename))[1] or '.webm'
    fname = f"{uuid.uuid4().hex}{ext}"
    file.save(_os.path.join(VIDEO_DIR, fname))
    return jsonify({'url': f'/uploads/video/{fname}'})


@image_bp.route('/api/delete-video', methods=['POST'])
def delete_video():
    import os as _os
    url = (request.json or {}).get('url', '')
    if not url:
        return jsonify({'error': 'No url'}), 400
    fname = url.split('/')[-1]
    fpath = _os.path.join(VIDEO_DIR, fname)
    if _os.path.exists(fpath):
        _os.remove(fpath)
    return jsonify({'success': True})


@image_bp.route('/api/delete-audio', methods=['POST'])
def delete_audio():
    import os as _os
    url = (request.json or {}).get('url', '')
    if not url:
        return jsonify({'error': 'No url'}), 400
    fname = url.split('/')[-1]
    fpath = _os.path.join(AUDIO_DIR, fname)
    if _os.path.exists(fpath):
        _os.remove(fpath)
    return jsonify({'success': True})


@image_bp.route('/api/cloudinary-status')
def cloudinary_status():
    """Check if ImageKit is configured and reachable."""
    if not USE_IMAGEKIT:
        return jsonify({
            'enabled': False,
            'message': 'IMAGEKIT env vars not set — using local storage'
        })
    try:
        from services.image_service import _get_imagekit
        ik = _get_imagekit()
        return jsonify({'enabled': True, 'status': 'connected', 'provider': 'imagekit'})
    except Exception as e:
        return jsonify({'enabled': True, 'status': 'error', 'message': str(e)}), 500


@image_bp.route('/api/proxy-download')
def proxy_image_download():
    """Server-side image proxy — fetches any URL and returns it as a file download.
    Bypasses browser CORS restrictions (Cloudinary, etc.)."""
    import urllib.request
    url = request.args.get('url', '').strip()
    if not url or not url.startswith('http'):
        return jsonify({'error': 'Invalid URL'}), 400
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
            content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0].strip()
        # Derive filename from URL
        fname = url.split('?')[0].split('/')[-1] or 'image.jpg'
        response = Response(data, content_type=content_type)
        response.headers['Content-Disposition'] = f'attachment; filename="{fname}"'
        response.headers['Cache-Control'] = 'no-store'
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@image_bp.route('/api/copy-image-to-clipboard', methods=['POST'])
def copy_image_to_clipboard_route():
    data = request.json or {}
    filename = data.get('filename', '')
    if not filename:
        return jsonify({'error': 'No filename'}), 400
    try:
        copy_image_to_clipboard(filename, UPLOADS_DIR)
        return jsonify({'success': True})
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@image_bp.route('/api/upload-tag-image', methods=['POST'])
def upload_tag_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image'}), 400
    file = request.files['image']
    tag_name = request.form.get('tag_name')
    if not tag_name:
        return jsonify({'error': 'No tag name'}), 400
    
    import os, uuid
    target_dir = os.path.join(UPLOADS_DIR, 'tag_images')
    os.makedirs(target_dir, exist_ok=True)
    
    ext = os.path.splitext(secure_filename(file.filename))[1] or '.png'
    # Use tag name as part of filename for easier debugging, but sanitize it
    safe_name = "".join([c for c in tag_name if c.isalnum() or c in (' ', '.', '_')]).rstrip()
    fname = f"{safe_name}_{uuid.uuid4().hex[:8]}{ext}"
    file.save(os.path.join(target_dir, fname))
    
    return jsonify({'url': f'/uploads/tag_images/{fname}'})


@image_bp.route('/api/delete-tag-image', methods=['POST'])
def delete_tag_image():
    data = request.json or {}
    url = data.get('url', '')
    if not url or 'tag_images' not in url:
        return jsonify({'error': 'Invalid URL'}), 400

    import os
    fname = url.split('/')[-1]
    fpath = os.path.join(UPLOADS_DIR, 'tag_images', fname)
    if os.path.exists(fpath):
        os.remove(fpath)
    return jsonify({'success': True})


# ── PDF file storage routes ────────────────────────────────────────────────────

@image_bp.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    """Upload PDF, start background page-split processing, return job_id immediately."""
    if 'pdf' not in request.files:
        return jsonify({'error': 'No pdf'}), 400
    file = request.files['pdf']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        pdf_bytes = file.read()
        orig_name = file.filename
    except Exception as e:
        return jsonify({'error': f'Read failed: {e}'}), 500

    if not orig_name.lower().endswith('.pdf'):
        return jsonify({'error': 'Invalid file type'}), 400

    job_id = uuid.uuid4().hex
    with _pdf_jobs_lock:
        _pdf_jobs[job_id] = {
            'status': 'processing',
            'current': 0,
            'total': 0,
            'record': None,
            'error': None,
        }

    def run():
        def on_progress(current, total):
            with _pdf_jobs_lock:
                if job_id in _pdf_jobs:
                    _pdf_jobs[job_id]['current'] = current
                    _pdf_jobs[job_id]['total']   = total
        try:
            record = save_pdf_bytes(
                pdf_bytes, orig_name,
                PDF_DIR, PDF_META_FILE,
                progress_cb=on_progress,
            )
            with _pdf_jobs_lock:
                _pdf_jobs[job_id]['record'] = record
                _pdf_jobs[job_id]['status'] = 'done'
        except Exception as exc:
            with _pdf_jobs_lock:
                _pdf_jobs[job_id]['error']  = str(exc)
                _pdf_jobs[job_id]['status'] = 'error'

    threading.Thread(target=run, daemon=True).start()
    return jsonify({'job_id': job_id})


@image_bp.route('/api/pdf-job/<job_id>', methods=['GET'])
def pdf_job_progress(job_id):
    """SSE stream: sends job progress until done/error."""
    def generate():
        while True:
            with _pdf_jobs_lock:
                job = dict(_pdf_jobs.get(job_id, {}))
            if not job:
                yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                break
            yield f"data: {json.dumps(job)}\n\n"
            if job['status'] in ('done', 'error'):
                # Clean up job entry after a short while
                threading.Timer(30, lambda: _pdf_jobs.pop(job_id, None)).start()
                break
            time.sleep(0.35)

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


@image_bp.route('/api/list-pdfs', methods=['GET'])
def list_pdfs():
    """Return metadata for all stored PDF files."""
    return jsonify(list_uploaded_pdfs(PDF_DIR, PDF_META_FILE))


@image_bp.route('/api/delete-pdf', methods=['POST'])
def delete_pdf():
    """Delete a PDF from Cloudinary or local disk."""
    data = request.json or {}
    filename = data.get('filename', '')
    if not filename:
        return jsonify({'error': 'Invalid filename'}), 400
    # Local safety check — block path traversal for local filenames
    if not USE_IMAGEKIT and ('/' in filename or '\\' in filename):
        return jsonify({'error': 'Invalid filename'}), 400
    delete_uploaded_pdf(filename, PDF_DIR, PDF_META_FILE)
    return jsonify({'success': True})


@image_bp.route('/api/backup-folder', methods=['GET'])
def get_backup_folder():
    import json as _json
    if not os.path.exists(BACKUP_CONFIG_FILE):
        return jsonify({'folder': ''})
    try:
        with open(BACKUP_CONFIG_FILE) as f:
            return jsonify(_json.load(f))
    except Exception:
        return jsonify({'folder': ''})


@image_bp.route('/api/backup-folder', methods=['POST'])
def set_backup_folder():
    import json as _json
    data = request.json or {}
    folder = data.get('folder', '').strip()
    try:
        with open(BACKUP_CONFIG_FILE, 'w') as f:
            _json.dump({'folder': folder}, f)
        return jsonify({'ok': True, 'folder': folder})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@image_bp.route('/api/backup-status', methods=['GET'])
def backup_status():
    from services.img_backup_service import get_backup_stats
    return jsonify(get_backup_stats())


@image_bp.route('/api/backup-sync', methods=['POST'])
def backup_sync():
    from services.img_backup_service import sync_all_to_backup
    result = sync_all_to_backup()
    return jsonify(result)


@image_bp.route('/api/backup-migrate', methods=['POST'])
def backup_migrate():
    from services.img_backup_service import migrate_flat_to_month_folders, _get_backup_folder
    folder = _get_backup_folder()
    if not folder:
        return jsonify({'ok': False, 'error': 'No backup folder configured'})
    moved = migrate_flat_to_month_folders(folder)
    return jsonify({'ok': True, 'moved': moved})


@image_bp.route('/api/backup-full-stats', methods=['GET'])
def backup_full_stats():
    from services.img_backup_service import get_full_backup_stats
    return jsonify(get_full_backup_stats())


@image_bp.route('/api/backup-full-sync', methods=['POST'])
def backup_full_sync():
    from services.img_backup_service import sync_all_data
    result = sync_all_data()
    return jsonify(result)


@image_bp.route('/api/backup-full-sync-stream', methods=['GET'])
def backup_full_sync_stream():
    from flask import Response, stream_with_context
    from services.img_backup_service import sync_all_data_stream
    return Response(
        stream_with_context(sync_all_data_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


@image_bp.route('/api/update-pdf-pages', methods=['POST'])
def update_pdf_pages_route():
    """Update pages array for a PDF (delete/reorder individual pages)."""
    data = request.json or {}
    filename = data.get('filename', '')
    pages    = data.get('pages', [])
    if not filename:
        return jsonify({'error': 'No filename'}), 400
    if not isinstance(pages, list):
        return jsonify({'error': 'pages must be array'}), 400
    found = update_pdf_pages(filename, pages, PDF_META_FILE)
    return jsonify({'success': True, 'found': found})

```

## File: `routes/import_routes.py`
```py
"""
routes/import_routes.py
-----------------------
API routes for all import variants: Excel, JSON/ZIP, raw CSV,
Zerodha historical CSV, and Dhan CSV.
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user

from services.import_service import (
    import_excel, import_raw_csv, import_historical_csv,
    import_dhan_csv, import_json_or_zip,
)
from config import UPLOADS_DIR, ADMIN_API_KEY, STRUCTURED_TRADES_CSV

import_bp = Blueprint('import', __name__)


@import_bp.route('/api/import-excel', methods=['POST'])
def import_excel_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        result = import_excel(file.read(), user_id=user_id)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Excel Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/import-json', methods=['POST'])
def import_json_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR, user_id=user_id)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"JSON/ZIP Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/admin/push-data', methods=['POST'])
def admin_push_data():
    """API-key-protected endpoint to push trades data without login session."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    try:
        import json, glob as _glob, os
        from config import DATA_FILE

        file_bytes = request.files['file'].read()
        data = json.loads(file_bytes)

        # Write to trades_N.json (active user file), not trades.json
        data_dir = os.path.dirname(DATA_FILE)
        user_files = [f for f in _glob.glob(os.path.join(data_dir, 'trades_*.json'))
                      if '.backup' not in f and os.path.exists(f)]
        target = max(user_files, key=os.path.getmtime) if user_files else DATA_FILE

        with open(target, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        trade_count = len(data.get('trades', []))
        return jsonify({'ok': True, 'trades': trade_count, 'file': os.path.basename(target)})
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Admin Push Data Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 500


@import_bp.route('/api/import-raw-csv', methods=['POST'])
def import_raw_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        result = import_raw_csv(file)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Raw CSV Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/import-historical-csv', methods=['POST'])
def import_historical_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        result = import_historical_csv(file, STRUCTURED_TRADES_CSV)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Historical CSV Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400


@import_bp.route('/api/import-dhan-csv', methods=['POST'])
def import_dhan_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    try:
        result = import_dhan_csv(file, STRUCTURED_TRADES_CSV)
        return jsonify(result)
    except Exception as e:
        from services.debug_service import log_ai_error
        log_ai_error(f"Dhan CSV Import Error: {str(e)}", e)
        return jsonify({'error': str(e)}), 400

```

## File: `routes/export_routes.py`
```py
"""
routes/export_routes.py
-----------------------
API routes for all export variants: Excel, structured CSV,
logger Excel, and full backup ZIP.
"""
import io
import os
import re
import json
import shutil
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file

from services.export_service import (
    export_simple_excel, export_structured_csv,
    export_logger_excel, build_backup_zip,
)
from flask_login import current_user
from config import DATA_FILE, UPLOADS_DIR, ADMIN_API_KEY, DEBUG, BASE_DIR
from processors.data_processors import find_best_trades_file

export_bp = Blueprint('export', __name__)


@export_bp.route('/api/backup', methods=['GET'])
def backup():
    active_file = find_best_trades_file()
    if not os.path.exists(active_file):
        return jsonify({'error': 'No data to backup'}), 404
    requested_name = str(request.args.get('name', '')).strip()
    safe_name = re.sub(r'[^A-Za-z0-9_\ -]+', '', requested_name).strip()
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = safe_name if safe_name else f'trading_journal_{timestamp_str}'
    # Only zip current user's uploads folder, not all users'
    uid = current_user.id if current_user.is_authenticated else None
    user_uploads = os.path.join(BASE_DIR, 'static', 'uploads', f'user_{uid}') if uid else UPLOADS_DIR
    zip_bytes, _ = build_backup_zip(active_file, user_uploads)
    return send_file(
        io.BytesIO(zip_bytes),
        as_attachment=True,
        download_name=f'{base_name}.zip',
        mimetype='application/zip',
    )


@export_bp.route('/api/export-excel', methods=['POST'])
def export_excel():
    data = request.json or {}
    trades  = data.get('trades', [])
    columns = data.get('columns', [])
    if not trades:
        return jsonify({'error': 'No data to export'}), 400
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    return send_file(
        export_simple_excel(trades, columns),
        as_attachment=True,
        download_name=f'trading_journal_{timestamp_str}.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


@export_bp.route('/api/export-structured-csv', methods=['POST'])
def export_structured_csv_route():
    data = request.json or {}
    trades   = data.get('trades', [])
    req_cols = data.get('columns', [])
    if not trades:
        return jsonify({'error': 'No data to export'}), 400
    return send_file(
        export_structured_csv(trades, req_cols),
        as_attachment=True,
        download_name='structured_trades.csv',
        mimetype='text/csv',
    )


@export_bp.route('/api/export-logger-excel', methods=['POST'])
def export_logger_excel_route():
    data = request.json or {}
    trades = data.get('trades', [])
    if not trades:
        return jsonify({'error': 'No data to export'}), 400
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    return send_file(
        export_logger_excel(trades),
        as_attachment=True,
        download_name=f'trade_logger_export_{timestamp_str}.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


_find_best_trades_file = find_best_trades_file


@export_bp.route('/api/admin/get-data', methods=['GET'])
def admin_get_data():
    """API-key-protected: returns full trades JSON for live→localhost sync."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data_file = _find_best_trades_file()
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({'ok': True, 'data': data, 'file': os.path.basename(data_file)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


LIVE_URL = os.getenv('LIVE_SERVER_URL', 'https://code2-calender.onrender.com').rstrip('/')


@export_bp.route('/api/admin/data-version', methods=['GET'])
def admin_data_version():
    """API-key-protected: returns file mtime + trade count for sync comparison."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data_file = _find_best_trades_file()
        if not os.path.exists(data_file):
            return jsonify({'ok': True, 'updated_at': None, 'trades': 0})
        mtime = os.path.getmtime(data_file)
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({'ok': True, 'updated_at': mtime, 'trades': len(data.get('trades', []))})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/api/sync/status', methods=['GET'])
def sync_status():
    """Localhost-only: compare local vs live data version, return sync direction."""
    if not DEBUG:
        return jsonify({'error': 'Only available in development mode'}), 403
    if not ADMIN_API_KEY:
        return jsonify({'ok': False, 'error': 'ADMIN_API_KEY not set'}), 500

    local_file = _find_best_trades_file()
    local_ts = os.path.getmtime(local_file) if os.path.exists(local_file) else 0
    try:
        with open(local_file, 'r', encoding='utf-8') as f:
            local_trades = len(json.load(f).get('trades', []))
    except Exception:
        local_trades = 0

    import urllib.request as _urlreq
    try:
        req = _urlreq.Request(f'{LIVE_URL}/api/admin/data-version', headers={'X-Api-Key': ADMIN_API_KEY})
        with _urlreq.urlopen(req, timeout=60) as resp:
            live = json.loads(resp.read().decode('utf-8'))
        live_ts = live.get('updated_at') or 0
        live_trades = live.get('trades', 0)
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Cannot reach live: {str(e)}'}), 502

    if live_ts > local_ts + 2:
        direction = 'pull'
    elif local_ts > live_ts + 2:
        direction = 'push'
    else:
        direction = 'equal'

    # Safety: never auto-pull if live has significantly fewer trades (bootstrap/corrupt data guard)
    if direction == 'pull' and live_trades < local_trades - 5:
        direction = 'safe_skip'

    return jsonify({
        'ok': True,
        'local_ts': local_ts, 'live_ts': live_ts,
        'local_trades': local_trades, 'live_trades': live_trades,
        'direction': direction,
    })


def _backup_local(prefix):
    """Backup the active local trades file before overwriting."""
    active = _find_best_trades_file()
    if not os.path.exists(active):
        return None
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = os.path.join(os.path.dirname(active), 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f'{prefix}_{ts}.json')
    shutil.copy2(active, backup_path)
    return backup_path


def _pull_with_credentials(email, password):
    """Login to live server with credentials, fetch /api/my-data."""
    import urllib.request, urllib.parse, http.cookiejar
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    # Step 1: login
    login_data = urllib.parse.urlencode({'email': email, 'password': password}).encode()
    login_req = urllib.request.Request(f'{LIVE_URL}/auth/login', data=login_data,
                                       headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with opener.open(login_req, timeout=30) as r:
        body = r.read().decode('utf-8', errors='replace')
        if 'invalid' in body.lower() or 'incorrect' in body.lower():
            raise RuntimeError('Login failed — wrong email or password')

    # Step 2: fetch data
    with opener.open(f'{LIVE_URL}/api/my-data', timeout=90) as r:
        return json.loads(r.read().decode('utf-8'))


@export_bp.route('/api/pull-from-live', methods=['POST'])
def pull_from_live():
    """Localhost-only: pull trades data from the live server and save locally.
    Tries ADMIN_API_KEY first; falls back to email/password credentials."""
    if not DEBUG:
        return jsonify({'error': 'Only available in development mode'}), 403

    import urllib.request
    body = request.get_json(silent=True) or {}
    email    = body.get('email', '').strip()
    password = body.get('password', '').strip()

    raw = None

    # ── Attempt 1: ADMIN_API_KEY ──────────────────────────────────────────────
    if ADMIN_API_KEY:
        try:
            req = urllib.request.Request(
                f'{LIVE_URL}/api/admin/get-data',
                headers={'X-Api-Key': ADMIN_API_KEY}
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = json.loads(resp.read().decode('utf-8'))
        except Exception:
            raw = None

    # ── Attempt 2: email + password (session login) ───────────────────────────
    if (not raw or not raw.get('ok')) and email and password:
        try:
            raw = _pull_with_credentials(email, password)
        except Exception as e:
            return jsonify({'error': f'Credential login failed: {str(e)}'}), 502

    if not raw:
        return jsonify({
            'error': 'ADMIN_API_KEY mismatch. Provide email+password to pull via login.',
            'needs_credentials': True
        }), 401

    if not raw.get('ok') or 'data' not in raw:
        return jsonify({'error': f'Live server error: {raw.get("error", "unexpected response")}'}), 502

    _backup_local('pre_pull')
    target = _find_best_trades_file()
    with open(target, 'w', encoding='utf-8') as f:
        json.dump(raw['data'], f, ensure_ascii=False, indent=2)

    trade_count = len(raw['data'].get('trades', []))
    return jsonify({'ok': True, 'trades': trade_count, 'message': f'Pulled {trade_count} trades from live'})


@export_bp.route('/api/push-to-live', methods=['POST'])
def push_to_live():
    """Localhost-only: push local trades data to the live server."""
    if not DEBUG:
        return jsonify({'error': 'Only available in development mode'}), 403
    if not ADMIN_API_KEY:
        return jsonify({'error': 'ADMIN_API_KEY not configured'}), 500

    source = _find_best_trades_file()
    if not os.path.exists(source):
        return jsonify({'error': 'Local data file not found'}), 404

    import urllib.request
    with open(source, 'rb') as f:
        json_bytes = f.read()

    # Validate JSON before sending
    try:
        local_data = json.loads(json_bytes)
    except Exception:
        return jsonify({'error': f'Local {os.path.basename(source)} is invalid JSON'}), 400

    boundary = 'FormBoundaryKhazana2026'
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="trades.json"\r\n'
        f'Content-Type: application/json\r\n\r\n'
    ).encode() + json_bytes + f'\r\n--{boundary}--\r\n'.encode()

    endpoint = f'{LIVE_URL}/api/admin/push-data'
    try:
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={
                'X-Api-Key': ADMIN_API_KEY,
                'Content-Type': f'multipart/form-data; boundary={boundary}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'error': f'Failed to push to live: {str(e)}'}), 502

    trade_count = len(local_data.get('trades', []))
    return jsonify({'ok': True, 'trades': trade_count, 'message': f'Pushed {trade_count} trades to live'})


@export_bp.route('/api/my-data', methods=['GET'])
def my_data():
    """Session-authenticated: returns the logged-in user's full trades JSON.
    Used by pull_from_live as a fallback when ADMIN_API_KEY doesn't match."""
    from flask_login import current_user
    if not current_user.is_authenticated:
        return jsonify({'error': 'Login required'}), 401
    try:
        data_file = find_best_trades_file()
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({'ok': True, 'data': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/api/my-data/version', methods=['GET'])
def my_data_version():
    """Session-authenticated: returns file mtime + trade count."""
    from flask_login import current_user
    if not current_user.is_authenticated:
        return jsonify({'error': 'Login required'}), 401
    try:
        data_file = find_best_trades_file()
        mtime = os.path.getmtime(data_file) if os.path.exists(data_file) else 0
        with open(data_file, 'r', encoding='utf-8') as f:
            trades = len(json.load(f).get('trades', []))
        return jsonify({'ok': True, 'updated_at': mtime, 'trades': trades})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

```
