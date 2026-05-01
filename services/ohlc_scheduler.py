"""
services/ohlc_scheduler.py
--------------------------
Background OHLC scheduler — downloads 1-min candles for all instruments.

Two modes:
  Live (9:15-15:35 IST, Mon-Fri):  refresh every LIVE_INTERVAL_SEC
  EOD  (15:35-23:00 IST, Mon-Fri): gap-fill anything missed today
  Idle (outside market hours):     sleep until next check

Symbols from:
  1. trades_1.json        -> Instrument field, filtered by trade date
  2. ohlc_watchlist.json  -> user-managed additions

Rate limit guard: INTER_CALL_DELAY seconds between API calls.
"""
import json
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

import services.ohlc_service as ohlc

log = logging.getLogger(__name__)

LIVE_INTERVAL_SEC = 5 * 60   # refresh every 5 min during market hours
INTER_CALL_DELAY  = 0.6      # seconds between Dhan API calls

_state = {
    'running': False,
    'phase':   'idle',    # 'idle' | 'live' | 'eod'
    'last_run': None,
    'current': None,
    'ok': 0, 'skipped': 0, 'failed': 0,
    'log': [],
}
_state_lock   = threading.Lock()
_trigger      = threading.Event()
_started      = False
_started_lock = threading.Lock()


# ── Time helpers ──────────────────────────────────────────────────────────────

def _ist_now() -> datetime:
    utc = datetime.now(timezone.utc)
    return (utc + timedelta(hours=5, minutes=30)).replace(tzinfo=None)


def _today_str() -> str:
    return _ist_now().strftime('%Y-%m-%d')


def _is_market_open() -> bool:
    now = _ist_now()
    if now.weekday() >= 5:
        return False
    t = (now.hour * 60 + now.minute)
    return (9 * 60 + 15) <= t <= (15 * 60 + 35)


def _is_eod() -> bool:
    now = _ist_now()
    if now.weekday() >= 5:
        return False
    t = now.hour * 60 + now.minute
    return (15 * 60 + 35) < t < (23 * 60)


# ── State helpers ─────────────────────────────────────────────────────────────

def _log(msg: str):
    ts = datetime.now().strftime('%H:%M:%S')
    entry = f"[{ts}] {msg}"
    with _state_lock:
        _state['log'].append(entry)
        if len(_state['log']) > 150:
            _state['log'] = _state['log'][-150:]
    log.info('[ohlc_scheduler] %s', msg)


def _set(**kw):
    with _state_lock:
        _state.update(kw)


# ── Symbol collection ─────────────────────────────────────────────────────────

def _collect_symbols(for_date: str) -> list:
    """Unique symbols to download for for_date (trades + watchlist)."""
    symbols: set = set()

    # 1. From user trades
    try:
        from processors.data_processors import get_user_data_file
        data_file = get_user_data_file(1)
        with open(data_file, encoding='utf-8') as f:
            data = json.load(f)
        trades = data.get('trades', [])
        has_trades_today = False
        for t in trades:
            td = t.get('trade_date') or t.get('date', '')
            if td == for_date:
                has_trades_today = True
                inst = t.get('Instrument', '').strip().upper()
                if inst:
                    symbols.add(inst)
        # Add index context whenever user traded that day
        if has_trades_today:
            symbols.update(['NIFTY', 'BANKNIFTY'])
    except Exception as e:
        log.warning('[ohlc_scheduler] Could not read trades: %s', e)

    # 2. From watchlist
    for sym in ohlc.load_watchlist():
        s = sym.strip().upper()
        if s:
            symbols.add(s)

    return sorted(symbols)


# ── Download cycle ────────────────────────────────────────────────────────────

def _run_cycle(for_date: str, phase: str):
    symbols = _collect_symbols(for_date)
    _set(phase=phase, ok=0, skipped=0, failed=0)
    _log(f"{phase.upper()} cycle — {for_date} — {len(symbols)} symbols")

    ok = skipped = failed = 0
    for sym in symbols:
        _set(current=sym)
        try:
            if ohlc.is_complete(sym, for_date):
                skipped += 1
                continue
            df = ohlc.download(sym, for_date)
            if df is not None and not df.empty:
                ok += 1
                _log(f"  OK {sym}: {len(df)} candles")
            else:
                failed += 1
                _log(f"  FAIL {sym}: empty response")
        except Exception as exc:
            failed += 1
            _log(f"  FAIL {sym}: {exc}")
        time.sleep(INTER_CALL_DELAY)

    _set(current=None, ok=ok, skipped=skipped, failed=failed,
         last_run=datetime.now().isoformat())
    _log(f"{phase.upper()} done — ok={ok} skipped={skipped} failed={failed}")


# ── Main worker thread ────────────────────────────────────────────────────────

def _worker():
    _log("Scheduler thread started")
    _set(running=True)

    while True:
        today = _today_str()

        if _is_market_open():
            _run_cycle(today, 'live')
            _trigger.clear()
            _trigger.wait(timeout=LIVE_INTERVAL_SEC)

        elif _is_eod():
            _run_cycle(today, 'eod')
            _set(phase='idle')
            _trigger.clear()
            _trigger.wait(timeout=3600)   # wait 1 hr, then re-check

        else:
            _set(phase='idle', current=None)
            _trigger.clear()
            _trigger.wait(timeout=300)    # poll every 5 min outside market hours


# ── Public API ────────────────────────────────────────────────────────────────

def start_scheduler():
    """Start background scheduler. Idempotent — safe to call multiple times."""
    global _started
    with _started_lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_worker, name='ohlc-scheduler', daemon=True).start()
    log.info('[ohlc_scheduler] Started')


def trigger_now():
    """Kick off an immediate download cycle (manual trigger)."""
    _trigger.set()


def get_status() -> dict:
    with _state_lock:
        return dict(_state)
