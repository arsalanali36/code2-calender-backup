"""
image_service.py
----------------
Handles all image file operations: upload, delete (to trash), clipboard copy,
and fetching upload timestamps.

Cloudinary mode:  when CLOUDINARY_URL env-var is set, images are uploaded
                  to Cloudinary and the public secure URL is returned.
Local mode:       images are stored in UPLOADS_DIR on disk (default / fallback).
"""

import os
import re
import json
import uuid
import shutil
from datetime import datetime

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_time_from_filename(name: str):
    """Try to extract a datetime from a Windows screenshot filename.
    Matches patterns like: Screenshot 2026-03-10 091700.png
                           Screenshot 2026-03-10 09_17_00.png
                           Screenshot 2026-03-10 09-17-00.png
    Returns seconds-since-epoch float or None.
    """
    m = re.search(r'(\d{4}-\d{2}-\d{2})\D+(\d{2})[\D_-]?(\d{2})[\D_-]?(\d{2})', name)
    if m:
        try:
            dt = datetime.strptime(f'{m.group(1)} {m.group(2)}:{m.group(3)}:{m.group(4)}', '%Y-%m-%d %H:%M:%S')
            return dt.timestamp()
        except ValueError:
            pass
    return None


def _validate_extension(filename: str):
    """Raise ValueError if extension is not in ALLOWED_EXTENSIONS."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Invalid file type: {ext}')
    return ext


# ── Cloudinary upload ─────────────────────────────────────────────────────────

def _upload_to_cloudinary(file_storage, original_filename: str = '') -> dict:
    """
    Upload a FileStorage object to Cloudinary.
    Returns {'url': '<secure_url>', 'filename': '<public_id>', 'cloudinary': True}
    Raises Exception on failure.
    """
    import cloudinary
    import cloudinary.uploader

    # cloudinary library auto-reads CLOUDINARY_URL env-var — no extra config needed.
    public_id = f'trading_journal/{uuid.uuid4()}'

    result = cloudinary.uploader.upload(
        file_storage,
        public_id=public_id,
        resource_type='image',
        overwrite=False,
        # Preserve original format so we don't re-encode unnecessarily
        format=None,
    )

    secure_url = result.get('secure_url', '')
    stored_public_id = result.get('public_id', public_id)

    return {
        'url': secure_url,
        'filename': stored_public_id,   # used for delete later
        'cloudinary': True,
    }


# ── Public API ────────────────────────────────────────────────────────────────

def save_uploaded_image(file_storage, uploads_dir: str, last_modified_s: float = None,
                        original_filename: str = None) -> dict:
    """
    Validate and save / upload an image.

    • If CLOUDINARY_URL is set  → upload to Cloudinary, return live public URL.
    • Otherwise                 → save to local uploads_dir, return /uploads/<filename>.

    Returns dict with at least: {'url': '...', 'filename': '...'}
    Raises ValueError on invalid file type or upload failure.
    """
    from config import USE_CLOUDINARY

    orig_name = original_filename or file_storage.filename or ''
    ext = _validate_extension(orig_name or file_storage.filename)

    # ── Cloudinary path ────────────────────────────────────────────────────────
    if USE_CLOUDINARY:
        try:
            return _upload_to_cloudinary(file_storage, orig_name)
        except Exception as e:
            raise ValueError(f'Cloudinary upload failed: {e}')

    # ── Local disk path ────────────────────────────────────────────────────────
    filename = f'{uuid.uuid4()}{ext}'
    filepath = os.path.join(uploads_dir, filename)
    file_storage.save(filepath)

    # Resolve original time: filename parse → lastModified → file mtime
    original_t = _parse_time_from_filename(orig_name) or last_modified_s or os.path.getmtime(filepath)

    # Write sidecar .meta
    try:
        with open(filepath + '.meta', 'w') as f:
            json.dump({'t': original_t}, f)
    except OSError:
        pass

    return {'url': f'/uploads/{filename}', 'filename': filename}


def move_to_trash(filename: str, uploads_dir: str, trash_dir: str) -> bool:
    """
    Move a file from uploads to _trash. Returns True if moved, False if not found.
    filename must be a basename (no path components) for safety.

    NOTE: Cloudinary files have a public_id like 'trading_journal/abc-123'.
          For those, we attempt Cloudinary deletion; for local files we move to trash.
    """
    # Detect Cloudinary public_id (contains '/' and no local extension pattern that matches)
    if '/' in filename and not os.path.exists(os.path.join(uploads_dir, os.path.basename(filename))):
        try:
            from config import USE_CLOUDINARY
            if USE_CLOUDINARY:
                import cloudinary.uploader
                cloudinary.uploader.destroy(filename, resource_type='image')
                return True
        except Exception:
            pass
        return False

    # Local file
    safe_name = os.path.basename(filename)
    if not safe_name:
        return False
    src = os.path.join(uploads_dir, safe_name)
    if os.path.exists(src):
        shutil.move(src, os.path.join(trash_dir, safe_name))
        # Also move sidecar if it exists
        meta = src + '.meta'
        if os.path.exists(meta):
            try:
                shutil.move(meta, os.path.join(trash_dir, safe_name + '.meta'))
            except Exception:
                pass
        return True
    return False


def get_image_times(urls: list, uploads_dir: str) -> dict:
    """
    Given a list of image URLs (/uploads/<name> or https://... Cloudinary),
    return a mapping of url -> formatted creation time string.

    For Cloudinary URLs we cannot reliably pull the time without an API call,
    so we return an empty string (the UI hides the Time button when blank).
    For local files we read .meta sidecar or fall back to file mtime.
    """
    times = {}
    for url in urls:
        if url.startswith('http://') or url.startswith('https://'):
            # Cloudinary or external URL — no local file to stat
            times[url] = ''
            continue

        filename = os.path.basename(url)
        filepath = os.path.join(uploads_dir, filename)
        if not os.path.exists(filepath):
            continue
        t = None
        meta_path = filepath + '.meta'
        if os.path.exists(meta_path):
            try:
                with open(meta_path) as f:
                    t = json.load(f).get('t')
            except Exception:
                pass
        if not t:
            t = os.path.getmtime(filepath)
        times[url] = datetime.fromtimestamp(t).strftime('%I:%M %p')
    return times


def copy_image_to_clipboard(filename: str, uploads_dir: str):
    """
    Copy a LOCAL image file to the Windows clipboard as a CF_HDROP file reference.
    Raises FileNotFoundError if the file doesn't exist.
    Raises ImportError if win32clipboard is not available (non-Windows).
    Not supported for Cloudinary-hosted images.
    """
    safe_name = os.path.basename(filename)
    if not safe_name:
        raise ValueError('No filename provided')

    filepath = os.path.join(uploads_dir, safe_name)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f'File not found: {safe_name}')

    import win32clipboard
    import struct

    # CF_HDROP: DROPFILES struct (20 bytes) + UTF-16LE double-null-terminated path
    dropfiles = struct.pack('<IIIII', 20, 0, 0, 0, 1)
    file_list = filepath.replace('/', '\\') + '\0\0'
    hdrop_data = dropfiles + file_list.encode('utf-16le')

    win32clipboard.OpenClipboard()
    try:
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32clipboard.CF_HDROP, hdrop_data)
    finally:
        win32clipboard.CloseClipboard()
