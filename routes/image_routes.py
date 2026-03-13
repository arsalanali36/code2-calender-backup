"""
routes/image_routes.py
----------------------
API routes for image upload, delete, clipboard copy, timestamps,
and serving uploaded files.
"""
from flask import Blueprint, request, jsonify, send_from_directory

from services.image_service import (
    save_uploaded_image, move_to_trash, get_image_times, copy_image_to_clipboard,
)
from config import UPLOADS_DIR, TRASH_DIR, USE_CLOUDINARY

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
