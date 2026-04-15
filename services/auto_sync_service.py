
import os
import json
import time
import threading
import logging
import re
from datetime import datetime, timedelta
from services.dhan_service import get_config, fetch_and_cache_ohlc
from scratch.fix_missing_dates import fetch_and_stitch as deep_stitch

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auto_sync")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PENDING_SYNC_FILE = os.path.join(BASE_DIR, 'data', 'pending_syncs.json')
INDEX_PATH = os.path.join(BASE_DIR, "data", "Historical_OHLC", "nifty_1m_dhan.csv")

_is_syncing = False
_sync_event = threading.Event()
_current_task = None
_total_tasks = 0
_done_tasks = 0

def load_pending():
    if not os.path.exists(PENDING_SYNC_FILE):
        return {}
    try:
        with open(PENDING_SYNC_FILE, 'r') as f:
            return json.load(f)
    except:
        return {}

def save_pending(data):
    os.makedirs(os.path.dirname(PENDING_SYNC_FILE), exist_ok=True)
    with open(PENDING_SYNC_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def add_to_sync(instrument, date):
    """Adds an instrument to the pending sync list if data doesn't exist."""
    pending = load_pending()
    
    # Check if we already have this data in meta
    if instrument.upper() == 'INDEX' or instrument.upper().startswith('NIFTY 50'):
        # For index, we don't handle via pending list usually, but let's allow it
        pass
    else:
        meta_path = os.path.join(BASE_DIR, "data", "Historical_OHLC", "Options", f"{instrument}.meta")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r') as m:
                    meta = json.load(m)
                    if date in meta: return # Already synced
            except: pass
    
    if instrument not in pending: pending[instrument] = []
    if date not in pending[instrument]:
        pending[instrument].append(date)
        save_pending(pending)
        logger.info(f"Added {instrument} for {date} to pending sync.")

def start_background_sync():
    """Starts a thread that periodically checks if it's time to sync."""
    thread = threading.Thread(target=_sync_worker, daemon=True)
    thread.start()
    logger.info("Background sync worker started.")

def _sync_worker():
    global _is_syncing
    while True:
        try:
            now = datetime.now()
            is_market_closed = now.hour > 15 or (now.hour == 15 and now.minute >= 45)
            is_off_hours = is_market_closed or now.hour < 9
            
            # Special bypass: if token is present, we allow sync during market too? 
            # No, keep it off-hours to avoid 429 and impact on UI
            pending = load_pending()
            config = get_config()
            
            if config and config.get('access_token') and (pending or _check_index_needs_sync()):
                if is_off_hours and not _is_syncing:
                    _perform_actual_sync(pending)
            
        except Exception as e:
            logger.error(f"AUTO-SYNC WORKER ERROR: {e}")
        
        _sync_event.wait(300)
        _sync_event.clear()

def _check_index_needs_sync():
    if not os.path.exists(INDEX_PATH): return True
    try:
        import pandas as pd
        df = pd.read_csv(INDEX_PATH)
        if df.empty: return True
        last_dt = pd.to_datetime(df['datetime']).max()
        today = datetime.now().date()
        return last_dt.date() < today
    except: return True

def _sync_index_data(config):
    global _current_task, _done_tasks, _total_tasks
    _current_task = "Updating NIFTY Index..."
    try:
        import pandas as pd
        if os.path.exists(INDEX_PATH):
            df_main = pd.read_csv(INDEX_PATH)
            last_date = pd.to_datetime(df_main['datetime']).max().date()
        else:
            df_main = pd.DataFrame()
            last_date = datetime(2026, 1, 1).date()
        
        today = datetime.now().date()
        curr = last_date + timedelta(days=1)
        
        while curr <= today:
            if curr.weekday() < 5:
                date_str = curr.strftime('%Y-%m-%d')
                _current_task = f"NIFTY INDEX | {date_str}"
                logger.info(f"AUTO-SYNC: Index update for {date_str}")
                
                # Fetch via Dhan (ID 13, Segment NSE_EQ, Instrument INDEX)
                df_day = fetch_and_cache_ohlc('13', 'NSE_EQ', 'INDEX', date_str, config=config)
                if df_day is not None and not df_day.empty:
                    # Append to main file
                    if df_main.empty: df_main = df_day
                    else: df_main = pd.concat([df_main, df_day]).drop_duplicates('datetime').sort_values('datetime')
                    df_main.to_csv(INDEX_PATH, index=False)
            curr += timedelta(days=1)
    except Exception as e:
        logger.error(f"AUTO-SYNC Index Error: {e}")

def _perform_actual_sync(pending):
    global _is_syncing, _current_task, _total_tasks, _done_tasks
    _is_syncing = True
    _current_task = "Initializing..."
    
    config = get_config()
    if not config or not config.get('access_token'):
        _is_syncing = False
        return

    try:
        # STEP 1: PRIORITY - Sync Index Data first
        _sync_index_data(config)
        while True:
            # Re-load pending every time to catch new force-added tasks
            pending = load_pending()
            if not pending: break
            
            # Convert to flat list and sort by date DESC
            tasks = []
            for inst, dates in pending.items():
                for d in dates: tasks.append((inst, d))
            
            if not tasks: break
            tasks.sort(key=lambda x: x[1], reverse=True)
            
            _total_tasks = len(tasks)
            # Pick the TOP task (highest priority date)
            inst, date = tasks[0]
            
            _current_task = f"{inst} | {date}"
            logger.info(f"AUTO-SYNC: Syncing {inst} for {date} (Remaining: {_total_tasks})")
            
            try:
                m_weekly = re.match(r'^([A-Z]+?)(\d{2})([1-9OND])(\d{2})(\d+)([CP]E)$', inst)
                m_monthly = re.match(r'^([A-Z]+?)(\d{2})([A-Z]{3})(\d+)([CP]E)$', inst)
                
                strike, otype = None, None
                if m_weekly:
                    _, _, _, _, strike_val, otype_code = m_weekly.groups()
                    strike = int(strike_val)
                    otype = "CALL" if otype_code == "CE" else "PUT"
                elif m_monthly:
                    _, _, _, strike_val, otype_code = m_monthly.groups()
                    strike = int(strike_val)
                    otype = "CALL" if otype_code == "CE" else "PUT"

                if strike and otype:
                    deep_stitch(inst, strike, otype, dates=[date])
                    
                    # Remove from pending file immediately
                    p = load_pending()
                    if inst in p and date in p[inst]:
                        p[inst].remove(date)
                        if not p[inst]: del p[inst]
                        save_pending(p)
                else:
                    # Unrecognized - remove
                    p = load_pending()
                    if inst in p:
                        if date in p[inst]: p[inst].remove(date)
                        if not p[inst]: del p[inst]
                        save_pending(p)

            except Exception as e:
                logger.error(f"AUTO-SYNC: Failed for {inst} {date}: {e}")
            
            _done_tasks += 1
            
    except Exception as e:
        logger.error(f"AUTO-SYNC: Critical worker error: {e}")
    finally:
        _is_syncing = False
        _current_task = None

def get_sync_status():
    pending = load_pending()
    count = 0
    for dates in pending.values(): count += len(dates)
    
    config = get_config()
    token_missing = not config or not config.get('access_token')
    
    return {
        "pending_count": count,
        "token_missing": token_missing and count > 0,
        "is_syncing": _is_syncing,
        "current_task": _current_task,
        "progress": f"{_done_tasks}/{_total_tasks}" if _total_tasks > 0 else "0/0"
    }

def trigger_sync_now():
    logger.info("Manual sync trigger received.")
    _sync_event.set()
