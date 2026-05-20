"""
services/demo_service.py
------------------------
Generates randomised demo data for new users at registration time.

Reads trades_1.json (admin's data), shifts all dates so the newest
trade lands on today, randomises monetary values ±20%, and writes the
result to trades_{user_id}.json with a demo_mode:true flag.

Images are kept as-is — they reference /uploads/user_1/... URLs which
are served publicly and don't require any file copying.
"""
import copy
import json
import logging
import os
import random
from datetime import date

from config import BASE_DIR

logger = logging.getLogger(__name__)

SOURCE_FILE = os.path.join(BASE_DIR, 'data', 'trades_1.json')

_MONETARY = (
    'Rs', 'Gross P/L', 'Net P/L', 'Day P&L',
    'Brokerage', 'Other Charges', 'Total Fees',
)


def generate_demo_data_for_user(user_id: int) -> None:
    """
    Generate and write demo trades for *user_id*.

    No-op if:
    - The user's data file already exists (never overwrite real data).
    - SOURCE_FILE (trades_1.json) is missing.
    """
    dest = os.path.join(BASE_DIR, 'data', f'trades_{user_id}.json')
    if os.path.exists(dest):
        return
    if not os.path.exists(SOURCE_FILE):
        logger.warning('[demo] source file missing: %s', SOURCE_FILE)
        return

    try:
        with open(SOURCE_FILE, 'r', encoding='utf-8') as fh:
            src = json.load(fh)
    except Exception:
        logger.exception('[demo] failed to read source file')
        return

    data = copy.deepcopy(src)

    # ── 1. Date shift ──────────────────────────────────────────────────────
    all_dates = [
        t.get('trade_date') or t.get('date', '')
        for t in data.get('trades', [])
    ]
    valid = [d for d in all_dates if d and d > '2020-01-01']
    if not valid:
        logger.warning('[demo] no valid dates found in source — aborting')
        return

    delta = date.today() - date.fromisoformat(max(valid))

    def _shift(d_str: str) -> str:
        try:
            return (date.fromisoformat(d_str) + delta).isoformat()
        except (ValueError, TypeError):
            return d_str

    # ── 2. Randomise trades ────────────────────────────────────────────────
    for trade in data.get('trades', []):
        f = random.uniform(0.8, 1.2)          # per-trade scalar

        # Dates
        for key in ('trade_date', 'date'):
            if trade.get(key):
                trade[key] = _shift(trade[key])

        # Monetary fields
        for field in _MONETARY:
            if trade.get(field) is not None:
                try:
                    trade[field] = round(float(trade[field]) * f, 2)
                except (TypeError, ValueError):
                    pass

        # Pt + price consistency: Sell - Buy = Pt (always)
        try:
            pt_new = round(float(trade.get('Pt', 0) or 0) * f, 2)
            trade['Pt'] = pt_new
            if str(trade.get('TradeType', '')).lower() == 'sell':
                # Short trade: entry = Sell, exit = Buy
                sell = float(trade.get('Sell Price (Avg)', 0) or 0)
                trade['Buy Price (Avg)'] = round(sell - pt_new, 2)
            else:
                # Long trade: entry = Buy, exit = Sell
                buy = float(trade.get('Buy Price (Avg)', 0) or 0)
                trade['Sell Price (Avg)'] = round(buy + pt_new, 2)
        except (TypeError, ValueError):
            pass

        # Clear personal notes
        trade['Note'] = ''
        trade['observation'] = ''

    # ── 3. Shift dayData keys ──────────────────────────────────────────────
    old_dd = data.get('dayData', {})
    new_dd = {}
    for k, v in old_dd.items():
        new_key = _shift(k) if k else k
        if isinstance(v, dict):
            # Drop canvas/annotation data (contains absolute local URLs)
            new_dd[new_key] = {
                ek: ev for ek, ev in v.items()
                if ek not in ('fabricData', 'overlays', 'marqueeBoxes')
            }
        else:
            new_dd[new_key] = v
    data['dayData'] = new_dd

    # ── 4. Mark as demo ────────────────────────────────────────────────────
    data['demo_mode'] = True

    # ── 5. Write ───────────────────────────────────────────────────────────
    try:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
        logger.info('[demo] wrote demo data for user %s → %s', user_id, dest)
    except Exception:
        logger.exception('[demo] failed to write demo file for user %s', user_id)


def restore_demo_data_for_user(user_id: int) -> None:
    """
    Delete the user's current trades file and regenerate demo data.
    Used when a user wants to bring back the demo after clearing it.
    """
    dest = os.path.join(BASE_DIR, 'data', f'trades_{user_id}.json')
    try:
        if os.path.exists(dest):
            os.remove(dest)
    except Exception:
        logger.exception('[demo] failed to delete file before restore for user %s', user_id)
        return
    generate_demo_data_for_user(user_id)
