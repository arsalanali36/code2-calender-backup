"""
services/bulk_download_service.py
----------------------------------
Bulk OHLC download for all trade instruments.
Priority: April → March → February (newest first).
Runs in a background thread — no Claude session needed.
"""
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import datetime, timedelta

INSTRUMENT_TIMEOUT = 30   # seconds per instrument before giving up

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRADES_FILE = os.path.join(BASE_DIR, 'data', 'trades_1.json')
OPTIONS_DIR = os.path.join(BASE_DIR, 'data', 'Historical_OHLC', 'Options')

# ── Global progress state ─────────────────────────────────────────────────────
_state = {
    'running':   False,
    'done':      False,
    'total':     0,
    'current':   0,
    'skipped':   0,
    'failed':    0,
    'ok':        0,
    'current_task': '',
    'log':       [],   # list of log lines (newest appended)
    'started_at': None,
}
_lock = threading.Lock()


def get_status():
    with _lock:
        return dict(_state)


def _log(msg):
    ts = datetime.now().strftime('%H:%M:%S')
    line = f"[{ts}] {msg}"
    with _lock:
        _state['log'].append(line)
        if len(_state['log']) > 500:
            _state['log'] = _state['log'][-500:]
    print(line)


# ── Instrument / date helpers ─────────────────────────────────────────────────

def _is_old_style(sym):
    """'NIFTY 10 FEB 25500 PUT' style — space-separated."""
    return ' ' in sym.strip()


def _csv_exists_and_valid(sym):
    """Return True if a non-empty CSV already exists for this instrument."""
    path = os.path.join(OPTIONS_DIR, f'{sym}.csv')
    if not os.path.exists(path):
        return False
    try:
        size = os.path.getsize(path)
        if size < 100:          # basically empty
            return False
        # Quick header check
        with open(path, 'r') as f:
            first = f.readline()
        return 'open' in first.lower() or 'Open' in first
    except Exception:
        return False


def _delete_corrupt(sym):
    path = os.path.join(OPTIONS_DIR, f'{sym}.csv')
    meta = os.path.join(OPTIONS_DIR, f'{sym}.meta')
    for p in [path, meta]:
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass


def _collect_tasks():
    """
    Read trades_1.json → return list of (instrument, trade_date) sorted
    April-first (newest date first), skipping index / already-complete entries.
    """
    try:
        with open(TRADES_FILE, encoding='utf-8') as f:
            trades = json.load(f).get('trades', [])
    except Exception as e:
        _log(f"ERROR reading trades file: {e}")
        return []

    # instrument → set of trade dates
    inst_dates = {}
    for t in trades:
        sym = (t.get('Instrument') or t.get('instrument') or '').strip()
        dt  = (t.get('trade_date') or t.get('date') or '').strip()
        if not sym or not dt:
            continue
        # Skip index
        if 'NSEI' in sym.upper() or sym.upper() in ('INDEX', 'NIFTY 50'):
            continue
        inst_dates.setdefault(sym, set()).add(dt)

    # Flatten & sort newest first
    tasks = []
    for sym, dates in inst_dates.items():
        for dt in dates:
            tasks.append((sym, dt))

    tasks.sort(key=lambda x: x[1], reverse=True)   # April → March → Feb
    return tasks


# ── Main download worker ──────────────────────────────────────────────────────

def _download_worker(token, client_id):
    from services.dhan_service import fetch_expired_option_ohlc

    with _lock:
        _state.update({
            'running': True, 'done': False,
            'current': 0, 'skipped': 0, 'failed': 0, 'ok': 0,
            'log': [], 'started_at': datetime.now().isoformat(),
        })

    config = {'access_token': token.strip(), 'client_id': client_id.strip()}
    _log("=== Bulk Download Started ===")
    _log(f"Token: ...{token[-10:]}")

    tasks = _collect_tasks()
    # Deduplicate — one entry per instrument (newest date)
    seen_instruments = set()
    unique_tasks = []
    for sym, dt in tasks:
        if sym not in seen_instruments:
            seen_instruments.add(sym)
            unique_tasks.append((sym, dt))

    with _lock:
        _state['total'] = len(unique_tasks)

    _log(f"Found {len(unique_tasks)} unique instruments to process")
    _log("Priority: April → March → February")
    _log("─" * 50)

    old_style_skipped = []

    for idx, (sym, dt) in enumerate(unique_tasks, 1):
        with _lock:
            _state['current'] = idx
            _state['current_task'] = f"{sym} ({idx}/{len(unique_tasks)})"

        # Skip old-style (can't reliably map to Dhan)
        if _is_old_style(sym):
            _log(f"SKIP (old format) [{idx}/{len(unique_tasks)}] {sym}")
            old_style_skipped.append(sym)
            with _lock:
                _state['skipped'] += 1
            continue

        # Delete corrupt if present
        if _csv_exists_and_valid(sym):
            _log(f"ALREADY OK [{idx}/{len(unique_tasks)}] {sym}")
            with _lock:
                _state['ok'] += 1
            continue

        path = os.path.join(OPTIONS_DIR, f'{sym}.csv')
        if os.path.exists(path):
            _log(f"CORRUPT → deleting & re-downloading: {sym}")
            _delete_corrupt(sym)

        # Download with timeout
        _log(f"DOWNLOADING [{idx}/{len(unique_tasks)}] {sym}  date={dt}")
        try:
            with ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(fetch_expired_option_ohlc, sym, dt, None, config)
                result = future.result(timeout=INSTRUMENT_TIMEOUT)

            if result == "ALREADY_COMPLETE":
                _log(f"  → Already complete")
                with _lock:
                    _state['ok'] += 1
            elif result == "AUTH_FAILED":
                _log(f"  → AUTH FAILED — stopping!")
                with _lock:
                    _state['failed'] += 1
                break
            elif result is None or (hasattr(result, 'empty') and result.empty):
                _log(f"  → No data returned (expired/not found) — SKIP")
                with _lock:
                    _state['skipped'] += 1
            else:
                rows = len(result) if hasattr(result, '__len__') else '?'
                _log(f"  → OK  ({rows} rows)")
                with _lock:
                    _state['ok'] += 1
        except FuturesTimeout:
            _log(f"  → TIMEOUT ({INSTRUMENT_TIMEOUT}s) — SKIP")
            with _lock:
                _state['skipped'] += 1
        except Exception as e:
            err = str(e)[:120]
            _log(f"  → FAILED: {err}")
            with _lock:
                _state['failed'] += 1

        time.sleep(0.5)   # rate limit

    # Summary
    _log("─" * 50)
    _log("=== DONE ===")
    with _lock:
        s = _state
        _log(f"Total: {s['total']}  |  OK: {s['ok']}  |  Skipped: {s['skipped']}  |  Failed: {s['failed']}")
    if old_style_skipped:
        _log(f"Old-format skipped ({len(old_style_skipped)}): {', '.join(old_style_skipped)}")

    with _lock:
        _state['running'] = False
        _state['done']    = True
        _state['current_task'] = 'Complete'


def start_bulk_download(token, client_id):
    """Start download in background thread. Returns False if already running."""
    with _lock:
        if _state['running']:
            return False
    t = threading.Thread(target=_download_worker, args=(token, client_id), daemon=True)
    t.start()
    return True
