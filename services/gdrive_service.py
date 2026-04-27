"""
services/gdrive_service.py
--------------------------
Persistent storage for trades_1.json on Google Drive.

Why: Render.com has an ephemeral filesystem — any file written on the live
server is lost on restart/redeploy. This service syncs trades data to/from
a Google Drive folder so restarts never lose data.

Required env vars (set on Render dashboard):
  GDRIVE_CREDENTIALS_JSON  — full content of service account JSON key file
  GDRIVE_FOLDER_ID         — Google Drive folder ID (share it with the SA email)
"""
import os
import json
import threading
import logging
from io import BytesIO

log = logging.getLogger(__name__)

GDRIVE_FILENAME = 'trades_1.json'
_service_cache = None
_service_lock = threading.Lock()


def is_configured():
    return bool(os.getenv('GDRIVE_CREDENTIALS_JSON')) and bool(os.getenv('GDRIVE_FOLDER_ID'))


def _get_service():
    global _service_cache
    if _service_cache:
        return _service_cache
    with _service_lock:
        if _service_cache:
            return _service_cache
        creds_json = os.getenv('GDRIVE_CREDENTIALS_JSON', '').strip()
        if not creds_json:
            return None
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            info = json.loads(creds_json)
            scopes = ['https://www.googleapis.com/auth/drive']
            creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
            _service_cache = build('drive', 'v3', credentials=creds, cache_discovery=False)
            log.info('[gdrive] Google Drive service initialised')
            return _service_cache
        except Exception as e:
            log.error('[gdrive] Failed to build Drive service: %s', e)
            return None


def _find_file_id(service, folder_id):
    """Return the Drive file ID of trades_1.json in folder, or None if not found."""
    try:
        q = f"name='{GDRIVE_FILENAME}' and '{folder_id}' in parents and trashed=false"
        results = service.files().list(
            q=q, fields='files(id,modifiedTime,size)', pageSize=1
        ).execute()
        files = results.get('files', [])
        return files[0] if files else None
    except Exception as e:
        log.error('[gdrive] _find_file_id error: %s', e)
        return None


def upload(local_path):
    """Upload (create or update) trades_1.json to Google Drive. Blocking."""
    if not is_configured():
        return
    service = _get_service()
    if not service:
        return
    folder_id = os.getenv('GDRIVE_FOLDER_ID')
    try:
        from googleapiclient.http import MediaFileUpload
        existing = _find_file_id(service, folder_id)
        media = MediaFileUpload(local_path, mimetype='application/json', resumable=False)
        if existing:
            service.files().update(
                fileId=existing['id'], media_body=media
            ).execute()
            log.info('[gdrive] Updated %s on Drive', GDRIVE_FILENAME)
        else:
            meta = {'name': GDRIVE_FILENAME, 'parents': [folder_id]}
            service.files().create(
                body=meta, media_body=media, fields='id'
            ).execute()
            log.info('[gdrive] Created %s on Drive', GDRIVE_FILENAME)
    except Exception as e:
        log.error('[gdrive] Upload failed: %s', e)


def upload_async(local_path):
    """Non-blocking upload — fires in a daemon thread so the save response is instant."""
    if not is_configured():
        return
    # Copy path string to avoid closure issues
    path = str(local_path)
    threading.Thread(target=upload, args=(path,), daemon=True).start()


def download_if_newer(local_path):
    """
    On server startup: if Drive has a newer version of trades_1.json, download it.
    This is the key function that survives restarts — Drive is the source of truth
    when the local (ephemeral) file is stale or missing.
    """
    if not is_configured():
        log.info('[gdrive] Not configured — skipping Drive sync on startup')
        return
    service = _get_service()
    if not service:
        return
    folder_id = os.getenv('GDRIVE_FOLDER_ID')
    try:
        existing = _find_file_id(service, folder_id)
        if not existing:
            log.info('[gdrive] No file on Drive yet — nothing to download')
            return

        # Parse Drive's RFC3339 mtime to a Unix timestamp
        from datetime import datetime, timezone
        gdrive_mtime_str = existing.get('modifiedTime', '')
        gdrive_mtime = datetime.fromisoformat(
            gdrive_mtime_str.replace('Z', '+00:00')
        ).timestamp()

        local_mtime = os.path.getmtime(local_path) if os.path.exists(local_path) else 0

        log.info('[gdrive] Drive mtime=%.0f  local mtime=%.0f', gdrive_mtime, local_mtime)

        if gdrive_mtime <= local_mtime + 5:
            log.info('[gdrive] Local file is up to date — skipping download')
            return

        log.info('[gdrive] Drive is newer — downloading %s…', GDRIVE_FILENAME)
        from googleapiclient.http import MediaIoBaseDownload
        request = service.files().get_media(fileId=existing['id'])
        buf = BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
        with open(local_path, 'wb') as f:
            f.write(buf.getvalue())

        trade_count = len(json.loads(buf.getvalue()).get('trades', []))
        log.info('[gdrive] Downloaded %s (%d trades) from Drive', GDRIVE_FILENAME, trade_count)

    except Exception as e:
        log.error('[gdrive] download_if_newer error: %s', e)
