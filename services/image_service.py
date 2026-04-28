"""
image_service.py
----------------
Handles all image file operations: upload, delete (to trash), clipboard copy,
and fetching upload timestamps.

ImageKit mode:  when IMAGEKIT_* env-vars are set, images are uploaded to
                ImageKit CDN and the public URL is returned.
Local mode:     images are stored in UPLOADS_DIR on disk (default / fallback).
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


# ── ImageKit upload ───────────────────────────────────────────────────────────

def _get_imagekit():
    """Return an initialized ImageKit v5 client."""
    from imagekitio import ImageKit
    from config import IMAGEKIT_PRIVATE_KEY
    return ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)


def _upload_to_imagekit(file_storage, original_filename: str = '') -> dict:
    """
    Upload a FileStorage object to ImageKit (v5 SDK).
    Returns {'url': '<cdn_url>', 'filename': '<file_id>', 'imagekit': True}
    Raises Exception on failure.
    """
    import io
    from config import IMAGEKIT_URL_ENDPOINT
    file_bytes = file_storage.read()
    fname = original_filename or file_storage.filename or f'{uuid.uuid4()}.jpg'
    safe_name = re.sub(r'[^\w.\-]', '_', os.path.basename(fname))

    ik = _get_imagekit()
    result = ik.files.upload(
        file=io.BytesIO(file_bytes),
        file_name=safe_name,
        folder='/trading_journal/',
        use_unique_file_name=True,
    )
    file_id = result.file_id
    url = f"{IMAGEKIT_URL_ENDPOINT}/trading_journal/{result.name}"
    return {
        'url': url,
        'filename': file_id,   # fileId used for delete later
        'imagekit': True,
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
    from config import USE_IMAGEKIT

    orig_name = original_filename or file_storage.filename or ''
    ext = _validate_extension(orig_name or file_storage.filename)

    # ── ImageKit path ──────────────────────────────────────────────────────────
    if USE_IMAGEKIT:
        try:
            return _upload_to_imagekit(file_storage, orig_name)
        except Exception as e:
            raise ValueError(f'ImageKit upload failed: {e}')

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
    # ImageKit fileId is a long hex string (no '/' and no local file)
    if not os.path.exists(os.path.join(uploads_dir, os.path.basename(filename))):
        # Try ImageKit delete by fileId
        try:
            from config import USE_IMAGEKIT
            if USE_IMAGEKIT and filename and '.' not in filename:
                ik = _get_imagekit()
                ik.files.delete(filename)
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


# ── PDF page splitting ────────────────────────────────────────────────────────

def split_pdf_to_images(pdf_bytes: bytes, pdf_name: str, dpi: int = 220,
                        progress_cb=None) -> list:
    """
    Render each PDF page to JPG and upload to Cloudinary (or save locally).
    progress_cb(current_page, total_pages) called after each page.
    Returns list of image URLs, one per page.
    """
    import io
    import fitz  # PyMuPDF
    from config import USE_IMAGEKIT, UPLOADS_DIR

    safe = re.sub(r'[^\w\-]', '_', os.path.splitext(os.path.basename(pdf_name))[0])[:35]
    mat  = fitz.Matrix(dpi / 72, dpi / 72)
    doc  = fitz.open(stream=pdf_bytes, filetype='pdf')
    total = len(doc)
    page_urls = []

    try:
        for i in range(total):
            pix       = doc[i].get_pixmap(matrix=mat, alpha=False)
            jpg_bytes = pix.tobytes('jpeg', jpg_quality=85)

            if USE_IMAGEKIT:
                from config import IMAGEKIT_URL_ENDPOINT
                ik = _get_imagekit()
                fname = f'{safe}_p{i+1}_{uuid.uuid4().hex[:6]}.jpg'
                res = ik.files.upload(
                    file=io.BytesIO(jpg_bytes),
                    file_name=fname,
                    folder='/trading_journal/pdf_pages/',
                    use_unique_file_name=True,
                )
                page_urls.append(f"{IMAGEKIT_URL_ENDPOINT}/trading_journal/pdf_pages/{res.name}")
            else:
                fname = f'pdf_{safe}_p{i+1}_{uuid.uuid4().hex[:6]}.jpg'
                fpath = os.path.join(UPLOADS_DIR, fname)
                with open(fpath, 'wb') as f:
                    f.write(jpg_bytes)
                page_urls.append(f'/uploads/{fname}')

            if progress_cb:
                try:
                    progress_cb(i + 1, total)
                except Exception:
                    pass
    finally:
        doc.close()

    return page_urls


# ── PDF helpers (Cloudinary or local) ────────────────────────────────────────

def _load_pdf_meta(pdf_meta_file: str) -> list:
    """Read pdfs.json; return [] if missing or corrupt."""
    try:
        with open(pdf_meta_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_pdf_meta(records: list, pdf_meta_file: str):
    os.makedirs(os.path.dirname(pdf_meta_file), exist_ok=True)
    with open(pdf_meta_file, 'w', encoding='utf-8') as f:
        json.dump(records, f)


def save_pdf_bytes(pdf_bytes: bytes, orig_name: str, pdf_dir: str,
                   pdf_meta_file: str, progress_cb=None) -> dict:
    """Process pre-read PDF bytes (called from background thread with progress tracking).
    Raw PDF is NOT uploaded to Cloudinary (free plan 10 MB raw limit).
    Only the split JPEG pages are uploaded to Cloudinary.
    """
    import time as _time
    from config import USE_IMAGEKIT

    ext = os.path.splitext(orig_name)[1].lower()
    if ext != '.pdf':
        raise ValueError(f'Invalid file type: {ext}')
    ts = int(_time.time() * 1000)

    if USE_IMAGEKIT:
        # Only split JPEG pages go to ImageKit (raw PDF stays local)
        uid = uuid.uuid4().hex
        pages = split_pdf_to_images(pdf_bytes, orig_name, progress_cb=progress_cb)
        record = {
            'filename':  f'imagekit/pdfs/{uid}',
            'name':      orig_name,
            'url':       '',
            'size':      len(pdf_bytes),
            'timestamp': ts,
            'pages':     pages,
        }
    else:
        os.makedirs(pdf_dir, exist_ok=True)
        fname = f'{uuid.uuid4().hex}_{secure_filename_safe(orig_name)}'
        fpath = os.path.join(pdf_dir, fname)
        with open(fpath, 'wb') as f:
            f.write(pdf_bytes)
        pages = split_pdf_to_images(pdf_bytes, orig_name, progress_cb=progress_cb)
        record = {
            'filename':  fname,
            'name':      orig_name,
            'url':       f'/uploads/pdfs/{fname}',
            'size':      os.path.getsize(fpath),
            'timestamp': ts,
            'pages':     pages,
        }

    records = _load_pdf_meta(pdf_meta_file)
    records.insert(0, record)
    _save_pdf_meta(records, pdf_meta_file)
    return record


def save_uploaded_pdf(file_storage, pdf_dir: str, pdf_meta_file: str,
                      original_filename: str = None, progress_cb=None) -> dict:
    """
    Save / upload a PDF file.

    • If CLOUDINARY_URL is set  → upload to Cloudinary (resource_type='raw'),
                                   store metadata in pdfs.json, return Cloudinary URL.
    • Otherwise                 → save to local pdf_dir, return /uploads/pdfs/<filename>.

    Returns dict: {'url', 'name', 'filename', 'size', 'timestamp'}
    """
    import time as _time
    from config import USE_IMAGEKIT

    orig_name = original_filename or file_storage.filename or 'upload.pdf'
    ext = os.path.splitext(orig_name)[1].lower()
    if ext != '.pdf':
        raise ValueError(f'Invalid file type: {ext}')

    ts = int(_time.time() * 1000)

    if USE_IMAGEKIT:
        pdf_bytes = file_storage.read()
        pages = split_pdf_to_images(pdf_bytes, orig_name, progress_cb=progress_cb)
        uid = uuid.uuid4().hex
        record = {
            'filename':  f'imagekit/pdfs/{uid}',
            'name':      orig_name,
            'url':       '',
            'size':      len(pdf_bytes),
            'timestamp': ts,
            'pages':     pages,
        }
        records = _load_pdf_meta(pdf_meta_file)
        records.insert(0, record)
        _save_pdf_meta(records, pdf_meta_file)
        return record

    # ── Local disk ────────────────────────────────────────────────────────────
    os.makedirs(pdf_dir, exist_ok=True)
    fname = f'{uuid.uuid4().hex}_{secure_filename_safe(orig_name)}'
    fpath = os.path.join(pdf_dir, fname)
    pdf_bytes = file_storage.read()
    with open(fpath, 'wb') as f:
        f.write(pdf_bytes)
    size = os.path.getsize(fpath)
    pages = split_pdf_to_images(pdf_bytes, orig_name, progress_cb=progress_cb)
    return {
        'filename':  fname,
        'name':      orig_name,
        'url':       f'/uploads/pdfs/{fname}',
        'size':      size,
        'timestamp': ts,
        'pages':     pages,
    }


def secure_filename_safe(name: str) -> str:
    """Minimal safe filename — keep alphanumerics, dots, hyphens, underscores."""
    import re as _re
    name = os.path.basename(name)
    name = _re.sub(r'[^\w.\-]', '_', name)
    return name or 'upload.pdf'


def list_uploaded_pdfs(pdf_dir: str, pdf_meta_file: str) -> list:
    """
    Return list of PDF metadata dicts sorted newest-first.

    Cloudinary mode: read from pdfs.json.
    Local mode:      scan pdf_dir filesystem.
    """
    from config import USE_IMAGEKIT

    if USE_IMAGEKIT:
        return _load_pdf_meta(pdf_meta_file)

    # Local
    result = []
    if not os.path.isdir(pdf_dir):
        return result
    for fname in os.listdir(pdf_dir):
        if not fname.lower().endswith('.pdf'):
            continue
        fpath = os.path.join(pdf_dir, fname)
        stat  = os.stat(fpath)
        parts = fname.split('_', 1)
        display_name = parts[1] if len(parts) == 2 else fname
        result.append({
            'filename':  fname,
            'name':      display_name,
            'url':       f'/uploads/pdfs/{fname}',
            'size':      stat.st_size,
            'timestamp': int(stat.st_mtime * 1000),
        })
    result.sort(key=lambda x: x['timestamp'], reverse=True)
    return result


def update_pdf_pages(filename: str, pages: list, pdf_meta_file: str) -> bool:
    """Update the pages array for a PDF (delete/reorder). Returns True if found."""
    records = _load_pdf_meta(pdf_meta_file)
    for r in records:
        if r.get('filename') == filename:
            r['pages'] = pages
            _save_pdf_meta(records, pdf_meta_file)
            return True
    return False


def delete_uploaded_pdf(filename: str, pdf_dir: str, pdf_meta_file: str) -> bool:
    """
    Delete a PDF by filename / Cloudinary public_id.
    Returns True if deleted, False if not found.
    """
    from config import USE_IMAGEKIT

    if USE_IMAGEKIT or filename.startswith('imagekit/') or filename.startswith('trading_journal/'):
        # Just remove from metadata — raw PDF was never uploaded to ImageKit
        records = _load_pdf_meta(pdf_meta_file)
        before  = len(records)
        records = [r for r in records if r.get('filename') != filename]
        _save_pdf_meta(records, pdf_meta_file)
        return len(records) < before

    # Local
    safe_name = os.path.basename(filename)
    fpath = os.path.join(pdf_dir, safe_name)
    if os.path.exists(fpath):
        os.remove(fpath)
        return True
    return False


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

    try:
        import win32clipboard
    except ImportError:
        raise ImportError('win32clipboard is not available on this platform (Windows only)')

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
