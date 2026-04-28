"""
services/log_service.py
-----------------------
Business logic for Trade Log+ feature.
Manages per-trade manual annotations and column schema.
"""
import csv
import io
import json
import os

from config import LOG_DATA_FILE, LOG_SCHEMA_FILE
from processors.data_processors import find_best_trades_file

DEFAULT_SCHEMA = [
    {"key": "Zone",      "label": "Zone",       "type": "dropdown",
     "options": ["@Level", "@Hawa Me", "NoZone"], "group": "Zone"},
    {"key": "LevelName", "label": "Level Name",  "type": "text",
     "options": [],                                "group": "Zone"},
    {"key": "ZoneCLr",   "label": "Zone Clr",    "type": "dropdown",
     "options": ["Green", "Red"],                  "group": "Zone"},
    {"key": "Location",  "label": "Location",    "type": "text",
     "options": [],                                "group": "Zone"},
    {"key": "Breakout",  "label": "Breakout",    "type": "text",
     "options": [],                                "group": "Zone"},
    {"key": "Dhoka",     "label": "Dhoka",       "type": "text",
     "options": [],                                "group": "Zone"},
]

AUTO_COLS = [
    {"key": "seq",        "label": "T#"},
    {"key": "type",       "label": "Type"},
    {"key": "instrument", "label": "Instrument"},
    {"key": "tradetype",  "label": "Trade"},
    {"key": "time",       "label": "Time"},
    {"key": "qty",        "label": "Qty"},
    {"key": "pt",         "label": "Pt"},
    {"key": "rs",         "label": "Rs"},
]


# ── JSON helpers ──────────────────────────────────────────────────────────────

def _load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return default


def _save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ── Schema ────────────────────────────────────────────────────────────────────

def get_schema():
    return _load_json(LOG_SCHEMA_FILE, list(DEFAULT_SCHEMA))


def save_schema(schema):
    _save_json(LOG_SCHEMA_FILE, schema)


def schema_to_csv():
    schema = get_schema()
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=['key', 'label', 'type', 'options', 'group'])
    writer.writeheader()
    for col in schema:
        writer.writerow({
            'key':     col.get('key', ''),
            'label':   col.get('label', ''),
            'type':    col.get('type', 'text'),
            'options': '|'.join(col.get('options', [])),
            'group':   col.get('group', ''),
        })
    return out.getvalue()


def csv_to_schema(csv_text):
    schema = []
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        opts = [o.strip() for o in row.get('options', '').split('|') if o.strip()]
        entry = {
            'key':     row.get('key', '').strip(),
            'label':   row.get('label', '').strip(),
            'type':    row.get('type', 'text').strip(),
            'options': opts,
            'group':   row.get('group', '').strip(),
        }
        if entry['key']:
            schema.append(entry)
    return schema


# ── Annotations ───────────────────────────────────────────────────────────────

def get_annotations():
    return _load_json(LOG_DATA_FILE, {})


def save_annotation(date, seq, field, value):
    data = get_annotations()
    data.setdefault(date, {}).setdefault(seq, {})[field] = value
    _save_json(LOG_DATA_FILE, data)


# ── Trade data ────────────────────────────────────────────────────────────────

def _derive_type(instrument, trade_type):
    inst = str(instrument).upper()
    tt   = str(trade_type).lower()
    is_ce   = 'CE' in inst
    is_pe   = 'PE' in inst
    is_sell = 'sell' in tt
    is_buy  = 'buy'  in tt
    if is_ce and is_sell: return 'S'
    if is_pe and is_sell: return 'L'
    if is_ce and is_buy:  return 'L'
    if is_pe and is_buy:  return 'S'
    return '-'


def _load_all_trades():
    trades_file = find_best_trades_file()
    with open(trades_file, 'r', encoding='utf-8') as f:
        raw = json.load(f)
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        # Standard app format: {trades: [...], dayData: {...}, ...}
        if 'trades' in raw and isinstance(raw['trades'], list):
            return raw['trades']
        # Fallback: collect any list whose items look like trades
        result = []
        for v in raw.values():
            if isinstance(v, list) and v and isinstance(v[0], dict) and 'Instrument' in v[0]:
                result.extend(v)
        return result
    return []


def get_log_data(start_date=None, end_date=None):
    """Return merged auto + annotation rows for the given date range."""
    all_trades  = _load_all_trades()
    annotations = get_annotations()
    rows = []

    for trade in all_trades:
        d = trade.get('trade_date') or trade.get('date', '')
        if not d:
            continue
        if start_date and d < start_date:
            continue
        if end_date and d > end_date:
            continue

        seq_raw = trade.get('Sequence', '')
        if not seq_raw:
            continue
        seq = seq_raw.upper()   # "t1" → "T1"

        ann = annotations.get(d, {}).get(seq, {})

        sell_time = trade.get('Sell Time', '') or ''
        buy_time  = trade.get('Buy Time',  '') or ''
        times     = [t for t in [sell_time, buy_time] if t]
        entry_time = min(times)[:5] if times else ''   # HH:MM only

        rows.append({
            'date':        d,
            'seq':         seq,
            'type':        _derive_type(trade.get('Instrument', ''), trade.get('TradeType', '')),
            'instrument':  trade.get('Instrument', ''),
            'tradetype':   trade.get('TradeType', ''),
            'time':        entry_time,
            'qty':         trade.get('Qty', 0),
            'pt':          trade.get('Pt', 0),
            'rs':          trade.get('Rs', 0),
            'img_count':   len(trade.get('images') or []),
            'annotations': ann,
        })

    def _sort_key(r):
        num = int(''.join(filter(str.isdigit, r['seq'])) or 0)
        return (r['date'], num)

    rows.sort(key=_sort_key)
    return rows


# ── Export ────────────────────────────────────────────────────────────────────

def get_images_for_date(date):
    """Return all image URLs for a given date (from trades + dayData)."""
    trades_file = find_best_trades_file()
    with open(trades_file, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    seen, images = set(), []

    def add(src):
        if src and isinstance(src, str) and src not in seen:
            seen.add(src); images.append(src)

    # dayData level images
    if isinstance(raw, dict):
        day = raw.get('dayData', {}).get(date, {})
        for src in (day.get('images') or []):       add(src)
        for src in (day.get('closeImages') or []):  add(src)

    # Per-trade images
    trades = raw.get('trades', []) if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
    for t in trades:
        d = t.get('trade_date') or t.get('date', '')
        if d != date:
            continue
        for src in (t.get('images') or []):
            add(src)

    return images


def import_annotations_csv(csv_text):
    """Merge annotations from CSV (export format) into trade_log.json."""
    auto_keys = {'date', 'seq', 'type', 'instrument', 'tradetype', 'time', 'qty', 'pt', 'rs'}
    data    = get_annotations()
    merged  = 0

    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        date = row.get('date', '').strip()
        seq  = row.get('seq',  '').strip().upper()
        if not date or not seq:
            continue
        ann = {k: v for k, v in row.items() if k not in auto_keys and v not in (None, '')}
        if ann:
            data.setdefault(date, {}).setdefault(seq, {}).update(ann)
            merged += 1

    _save_json(LOG_DATA_FILE, data)
    return merged


def export_annotations_csv(start_date=None, end_date=None):
    rows   = get_log_data(start_date, end_date)
    schema = get_schema()
    out    = io.StringIO()
    auto_keys = ['date', 'seq', 'type', 'instrument', 'tradetype', 'time', 'qty', 'pt', 'rs']
    fieldnames = auto_keys + [c['key'] for c in schema]
    writer = csv.DictWriter(out, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    for r in rows:
        row_dict = {k: r.get(k, '') for k in auto_keys}
        for c in schema:
            row_dict[c['key']] = r['annotations'].get(c['key'], '')
        writer.writerow(row_dict)
    return out.getvalue()
