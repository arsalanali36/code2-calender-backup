"""
image_service.py
----------------
Handles all image file operations: upload, delete (to trash), clipboard copy,
and fetching upload timestamps.
"""

import os
import uuid
import shutil
from datetime import datetime

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}


def save_uploaded_image(file_storage, uploads_dir: str) -> dict:
    """
    Validate and save an uploaded image file.
    Returns {'url': '/uploads/<filename>', 'filename': '<filename>'}
    Raises ValueError on invalid type.
    """
    ext = os.path.splitext(file_storage.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Invalid file type: {ext}')

    filename = f'{uuid.uuid4()}{ext}'
    filepath = os.path.join(uploads_dir, filename)
    file_storage.save(filepath)
    return {'url': f'/uploads/{filename}', 'filename': filename}


def move_to_trash(filename: str, uploads_dir: str, trash_dir: str) -> bool:
    """
    Move a file from uploads to _trash. Returns True if moved, False if not found.
    filename must be a basename (no path components) for safety.
    """
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
    Given a list of image URLs (/uploads/<name>), return a mapping of
    url -> formatted creation time string.
    """
    times = {}
    for url in urls:
        filename = os.path.basename(url)
        filepath = os.path.join(uploads_dir, filename)
        if os.path.exists(filepath):
            ctime = os.path.getctime(filepath)
            times[url] = datetime.fromtimestamp(ctime).strftime('%I:%M %p')
    return times


def copy_image_to_clipboard(filename: str, uploads_dir: str):
    """
    Copy an image file to the Windows clipboard as a CF_HDROP file reference.
    Raises FileNotFoundError if the file doesn't exist.
    Raises ImportError if win32clipboard is not available (non-Windows).
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
