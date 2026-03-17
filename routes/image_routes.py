"""
routes/image_routes.py
----------------------
API routes for image upload, delete, clipboard copy, timestamps,
and serving uploaded files.
"""
from flask import Blueprint, request, jsonify, send_from_directory, Response

from services.image_service import (
    save_uploaded_image, move_to_trash, get_image_times, copy_image_to_clipboard,
)
from config import UPLOADS_DIR, TRASH_DIR, AUDIO_DIR, VIDEO_DIR, USE_CLOUDINARY

image_bp = Blueprint('image', __name__)


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
        original_filename = request.form.get('original_filename', '')
        result = save_uploaded_image(file, UPLOADS_DIR, last_modified_s, original_filename)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(result)


@image_bp.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve local uploads. Cloudinary files are served directly by Cloudinary CDN."""
    return send_from_directory(UPLOADS_DIR, filename)


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
    ext = _os.path.splitext(file.filename)[1] or '.webm'
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
    ext = _os.path.splitext(file.filename)[1] or '.webm'
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
