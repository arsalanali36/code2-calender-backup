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
    use_bundle = os.path.exists(BUNDLE_PATH)
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


@page_bp.route('/api/blog-posts')
def blog_posts_api():
    return jsonify(get_blog_entries_for_api(BLOG_PATH))

```

## File: `routes/trade_routes.py`
```py
"""
routes/trade_routes.py
----------------------
API routes for reading and writing the trades payload.
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user

from services.trade_service import get_all_trades, save_trades

trade_bp = Blueprint('trade', __name__)


def _get_user_id():
    """Extract user_id from the current session (None for unauthenticated/single-user)."""
    return current_user.id if current_user.is_authenticated else None


@trade_bp.route('/api/trades', methods=['GET'])
def get_trades():
    return jsonify(get_all_trades(user_id=_get_user_id()))


@trade_bp.route('/api/trades', methods=['POST'])
def post_trades():
    data = request.json
    if not data:
        return jsonify({'error': 'No data'}), 400
    try:
        save_trades(data, user_id=_get_user_id())
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'success': True})

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
from werkzeug.utils import secure_filename

from services.image_service import (
    save_uploaded_image, move_to_trash, get_image_times, copy_image_to_clipboard,
    save_uploaded_pdf, save_pdf_bytes, list_uploaded_pdfs, delete_uploaded_pdf, update_pdf_pages,
)
from config import UPLOADS_DIR, TRASH_DIR, AUDIO_DIR, VIDEO_DIR, PDF_DIR, PDF_META_FILE, USE_CLOUDINARY

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
        result = save_uploaded_image(file, UPLOADS_DIR, last_modified_s, original_filename)
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
    # Fallback: if it's a bare filename (no subfolder), check video/ and audio/
    if '/' not in filename:
        for sub in ('video', 'audio'):
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
    moved = move_to_trash(filename, UPLOADS_DIR, TRASH_DIR)
    return jsonify({'success': moved})


@image_bp.route('/api/image-times', methods=['POST'])
def image_times():
    urls = (request.json or {}).get('urls', [])
    return jsonify(get_image_times(urls, UPLOADS_DIR))


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
    """Check if Cloudinary is configured and reachable."""
    if not USE_CLOUDINARY:
        return jsonify({
            'enabled': False,
            'message': 'CLOUDINARY_URL not set — using local storage'
        })
    try:
        import cloudinary.api
        result = cloudinary.api.ping()
        return jsonify({'enabled': True, 'status': 'connected', 'ping': result})
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
    if not USE_CLOUDINARY and ('/' in filename or '\\' in filename):
        return jsonify({'error': 'Invalid filename'}), 400
    delete_uploaded_pdf(filename, PDF_DIR, PDF_META_FILE)
    return jsonify({'success': True})


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
    user_id = current_user.id if current_user.is_authenticated else None
    try:
        result = import_excel(file.read(), user_id=user_id)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-json', methods=['POST'])
def import_json_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    user_id = current_user.id if current_user.is_authenticated else None
    try:
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR, user_id=user_id)
    except (ValueError, Exception) as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/admin/push-data', methods=['POST'])
def admin_push_data():
    """API-key-protected endpoint to push trades data without login session."""
    key = request.headers.get('X-Api-Key', '')
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    # Admin push uses no user session — saves to default data file
    try:
        result = import_json_or_zip(request.files['file'], UPLOADS_DIR, user_id=None)
    except (ValueError, Exception) as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-raw-csv', methods=['POST'])
def import_raw_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_raw_csv(file)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-historical-csv', methods=['POST'])
def import_historical_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_historical_csv(file, STRUCTURED_TRADES_CSV)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@import_bp.route('/api/import-dhan-csv', methods=['POST'])
def import_dhan_csv_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    try:
        result = import_dhan_csv(file, STRUCTURED_TRADES_CSV)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)

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
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file

from services.export_service import (
    export_simple_excel, export_structured_csv,
    export_logger_excel, build_backup_zip,
)
from config import DATA_FILE, UPLOADS_DIR

export_bp = Blueprint('export', __name__)


@export_bp.route('/api/backup', methods=['GET'])
def backup():
    if not os.path.exists(DATA_FILE):
        return jsonify({'error': 'No data to backup'}), 404
    requested_name = str(request.args.get('name', '')).strip()
    safe_name = re.sub(r'[^A-Za-z0-9_\ -]+', '', requested_name).strip()
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = safe_name if safe_name else f'trading_journal_{timestamp_str}'
    zip_bytes, _ = build_backup_zip(DATA_FILE, UPLOADS_DIR)
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

```
