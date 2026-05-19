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
