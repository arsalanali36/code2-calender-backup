"""
services/gist_service.py
------------------------
Persistent storage for trades_1.json via GitHub Gist.

Why: Render.com has an ephemeral filesystem. Google Drive service accounts
have no storage quota. GitHub Gist is free, needs no extra packages (stdlib
urllib only), and survives server restarts.

Required env vars (set on Render dashboard):
  GITHUB_TOKEN     — Personal Access Token with 'gist' scope
  GITHUB_GIST_ID   — ID of a private Gist (the long hex string in the URL)
"""
import os
import json
import threading
import urllib.request
import urllib.error

GIST_FILENAME = 'trades_1.json'
_HEADERS = lambda: {
    'Authorization': f'Bearer {os.getenv("GITHUB_TOKEN", "")}',
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
}


def is_configured():
    return bool(os.getenv('GITHUB_TOKEN')) and bool(os.getenv('GITHUB_GIST_ID'))


def upload(local_path):
    """Upload trades_1.json content to the Gist. Blocking."""
    if not is_configured():
        return
    gist_id = os.getenv('GITHUB_GIST_ID')
    try:
        with open(local_path, 'r', encoding='utf-8') as f:
            content = f.read()

        body = json.dumps({'files': {GIST_FILENAME: {'content': content}}}).encode('utf-8')
        req = urllib.request.Request(
            f'https://api.github.com/gists/{gist_id}',
            data=body, method='PATCH', headers=_HEADERS()
        )
        with urllib.request.urlopen(req, timeout=30):
            pass
        print(f'[gist] Uploaded {GIST_FILENAME} to GitHub Gist ✓', flush=True)
    except Exception as e:
        print(f'[gist] Upload FAILED: {e}', flush=True)


def upload_async(local_path):
    """Non-blocking upload — daemon thread so save response is instant."""
    if not is_configured():
        return
    path = str(local_path)
    threading.Thread(target=upload, args=(path,), daemon=True).start()


def download_if_newer(local_path):
    """
    On startup: download from Gist if it's newer than the local file.
    This is what survives Render restarts.
    """
    if not is_configured():
        print('[gist] Not configured — skipping Gist sync on startup', flush=True)
        return

    gist_id = os.getenv('GITHUB_GIST_ID')
    print(f'[gist] Checking GitHub Gist {gist_id[:8]}… for newer data', flush=True)
    try:
        req = urllib.request.Request(
            f'https://api.github.com/gists/{gist_id}',
            headers=_HEADERS()
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            gist_data = json.loads(resp.read().decode('utf-8'))

        file_info = gist_data.get('files', {}).get(GIST_FILENAME)
        if not file_info:
            print(f'[gist] No {GIST_FILENAME} in Gist yet — nothing to download', flush=True)
            return

        from datetime import datetime
        updated_at = gist_data.get('updated_at', '')
        gist_mtime = datetime.fromisoformat(updated_at.replace('Z', '+00:00')).timestamp()
        local_mtime = os.path.getmtime(local_path) if os.path.exists(local_path) else 0

        print(f'[gist] Gist mtime={gist_mtime:.0f}  local mtime={local_mtime:.0f}', flush=True)

        if gist_mtime <= local_mtime + 5:
            print('[gist] Local file is up to date — skipping download', flush=True)
            return

        print(f'[gist] Gist is newer — downloading {GIST_FILENAME}…', flush=True)

        content = file_info.get('content', '')
        if not content or file_info.get('truncated'):
            raw_url = file_info['raw_url']
            with urllib.request.urlopen(raw_url, timeout=60) as r:
                content = r.read().decode('utf-8')

        os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(content)

        trade_count = len(json.loads(content).get('trades', []))
        print(f'[gist] Downloaded {GIST_FILENAME} ({trade_count} trades) from Gist ✓', flush=True)

    except Exception as e:
        print(f'[gist] download_if_newer ERROR: {e}', flush=True)
