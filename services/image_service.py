"""
image_service.py
----------------
Handles all image file operations: upload, delete (to trash), clipboard copy,
and fetching upload timestamps.

Storage backend is chosen at startup:
  - If CLOUDINARY_URL env var is set  → images go to Cloudinary (cloud)
  - Otherwise                         → images saved to local UPLOADS_DIR
"""

import os
import re
import json
import uuid
import shutil
from datetime import datetime

from config import USE_CLOUDINARY

if USE_CLOUDINARY:
    import cloudinary
    import cloudinary.uploader

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}


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


def _cloudinary_public_id(url: str) -> str:
    """Extract the Cloudinary public_id from a full secure URL.
    e.g. https://res.cloudinary.com/cloud/image/upload/v123/trading-journal/abc.jpg
    → 'trading-journal/abc'
    """
    parts = url.split('/upload/')
    if len(parts) != 2:
        return ''
    pid = parts[1]
    pid = re.sub(r'^v\d+/', '', pid)          # strip version prefix
    pid = os.path.splitext(pid)[0]            # strip extension
    return pid


def save_uploaded_image(file_storage, uploads_dir: str, last_modified_s: float = None,
                        original_filename: str = None) -> dict:
    """
    Validate and save an uploaded image file.
    Returns {'url': '<url>', 'filename': '<filename>'}
    Raises ValueError on invalid type.

    If USE_CLOUDINARY is True, uploads to Cloudinary and returns a full https URL.
    Otherwise saves locally and returns '/uploads/<filename>'.
    """
    ext = os.path.splitext(file_storage.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Invalid file type: {ext}')

    orig_name = original_filename or file_storage.filename or ''

    if USE_CLOUDINARY:
        result = cloudinary.uploader.upload(
            file_storage,
            folder='trading-journal',
            resource_type='image',
        )
        url = result['secure_url']
        filename = f"{result['public_id'].split('/')[-1]}.{result['format']}"
        return {'url': url, 'filename': filename}

    # ── Local filesystem ─────────────────────────────────────────────────────
    filename = f'{uuid.uuid4()}{ext}'
    filepath = os.path.join(uploads_dir, filename)
    file_storage.save(filepath)

    original_t = _parse_time_from_filename(orig_name) or last_modified_s or os.path.getmtime(filepath)
    try:
        with open(filepath + '.meta', 'w') as f:
            json.dump({'t': original_t}, f)
    except OSError:
        pass

    return {'url': f'/uploads/{filename}', 'filename': filename}


def move_to_trash(filename: str, uploads_dir: str, trash_dir: str) -> bool:
    """
    Remove/trash an image.
    - If filename is a full Cloudinary https URL → destroy on Cloudinary.
    - Otherwise → move local file to _trash.
    Returns True on success, False if not found.
    """
    if filename.startswith('http'):
        if USE_CLOUDINARY:
            try:
                public_id = _cloudinary_public_id(filename)
                if public_id:
                    cloudinary.uploader.destroy(public_id)
            except Exception:
                pass
        return True

    safe_name = os.path.basename(filename)
    if not safe_name:
        return False
    src = os.path.join(uploads_dir, safe_name)
    if os.path.exists(src):
        shutil.move(src, os.path.join(trash_dir, safe_name))
        return True
    return False


def get_image_times(urls: list, uploads_dir: str) -> dict:
    """
    Given a list of image URLs, return url → formatted creation time string.
    Cloudinary URLs are skipped (no local .meta sidecar available).
    """
    times = {}
    for url in urls:
        if url.startswith('http'):
            continue  # Cloudinary — time not available server-side
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
    Copy an image file to the Windows clipboard as a CF_HDROP file reference.
    Raises FileNotFoundError if the file doesn't exist.
    Raises ImportError if win32clipboard is not available (non-Windows).
    Raises ValueError if called with a cloud URL (not supported).
    """
    if filename.startswith('http'):
        raise ValueError('Clipboard copy not supported for cloud-hosted images')

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
