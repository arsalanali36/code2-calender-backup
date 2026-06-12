# Backend - Core Services
Consolidated code context for AI assistants.


## File: `services/trade_service.py`
```py
"""
trade_service.py
----------------
Thin wrapper around data_processors load/save functions.
All route handlers read/write trades exclusively through here.
"""

from processors.data_processors import load_trades as _load, save_trades_to_file as _save


def get_all_trades(user_id=None):
    """Return the full trades payload dict: {trades, columns, dayData, ...}"""
    return _load(user_id=user_id)


def get_date_image_map(user_id=None) -> dict:
    """Return {date: images_list} for all trades — lightweight read for import operations."""
    payload = _load(user_id=user_id)
    return {t.get('date', ''): t.get('images', []) for t in payload.get('trades', [])}


def save_trades(data: dict, user_id=None):
    """Persist the trades payload. Raises if data is missing 'trades' key."""
    if not isinstance(data, dict) or 'trades' not in data:
        raise ValueError("Payload must be a dict with a 'trades' key")
    _save(data, user_id=user_id)

```

## File: `services/import_service.py`
```py
"""
import_service.py
-----------------
All import/parse logic for Excel, raw CSV, historical CSV, Dhan CSV, and JSON/ZIP.
Routes in app.py delegate entirely to these functions.
"""

import io
import json
import os
import zipfile

import pandas as pd

from processors.data_processors import (
    HISTORICAL_STRUCTURED_COLUMNS,
    consolidate_raw_fills,
    consolidate_zerodha_historical_csv,
    consolidate_dhan_csv,
    save_trades_to_file,
)
from services.trade_service import get_date_image_map


# ── Excel ────────────────────────────────────────────────────────────────────

def import_excel(file_bytes: bytes, user_id=None) -> dict:
    """
    Parse an .xlsx file, normalize columns, preserve existing images.
    Returns {'trades': [...], 'columns': [...]}.
    Raises ValueError on parse failure.
    """
    try:
        df = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl')

        unnamed = sum(1 for c in df.columns if str(c).startswith('Unnamed:'))
        if unnamed > len(df.columns) / 2:
            df2 = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl', skiprows=1)
            unnamed2 = sum(1 for c in df2.columns if str(c).startswith('Unnamed:'))
            if unnamed2 < unnamed:
                df = df2

        df = df[[c for c in df.columns if not str(c).startswith('Unnamed:')]]
        df = df.dropna(how='all')
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as e:
        raise ValueError(f'Excel read error: {e}')

    existing_by_date = get_date_image_map(user_id=user_id)
    columns = list(df.columns)
    trades = []

    for _, row in df.iterrows():
        trade = {}
        for col in columns:
            val = row[col]
            if pd.isna(val):
                trade[col] = ''
            elif hasattr(val, 'strftime'):
                trade[col] = val.strftime('%Y-%m-%d')
            elif isinstance(val, float):
                trade[col] = int(val) if val == int(val) else round(val, 6)
            else:
                trade[col] = val

        date_key = ''
        for col in columns:
            if 'date' in col.lower():
                date_key = str(trade.get(col, ''))
                break
        trade['date'] = date_key
        trade['images'] = existing_by_date.get(date_key, [])
        trades.append(trade)

    return {'trades': trades, 'columns': columns}


# ── CSV variants ─────────────────────────────────────────────────────────────

def _csv_to_trades(structured_df: pd.DataFrame) -> dict:
    """Convert a structured DataFrame to the standard {trades, columns} response."""
    trades = []
    for row in structured_df.to_dict(orient='records'):
        trade = dict(row)
        trade['date'] = str(trade.get('trade_date', ''))
        trade['images'] = []
        trades.append(trade)
    return {'trades': trades, 'columns': HISTORICAL_STRUCTURED_COLUMNS}


def import_raw_csv(file_storage) -> dict:
    """Parse a raw fills CSV (today's trades). Raises ValueError on failure."""
    try:
        df = pd.read_csv(file_storage)
        structured_df = consolidate_raw_fills(df)
    except Exception as e:
        raise ValueError(f'CSV processing error: {e}')

    structured_df = structured_df.rename(columns={
        'Sell Price': 'Sell Price (Avg)',
        'Buy Price': 'Buy Price (Avg)',
        'Date': 'trade_date',
    })
    for col in HISTORICAL_STRUCTURED_COLUMNS:
        if col not in structured_df.columns:
            structured_df[col] = ''
    structured_df = structured_df[HISTORICAL_STRUCTURED_COLUMNS]
    return _csv_to_trades(structured_df)


def import_historical_csv(file_storage, output_csv_path: str | None = None) -> dict:
    """Parse a Zerodha historical CSV. Optionally saves a debug CSV."""
    try:
        df = pd.read_csv(file_storage)
        structured_df = consolidate_zerodha_historical_csv(df)
        if output_csv_path:
            structured_df.to_csv(output_csv_path, index=False)
    except Exception as e:
        raise ValueError(f'Historical CSV processing error: {e}')
    return _csv_to_trades(structured_df)


def import_dhan_csv(file_storage, output_csv_path: str | None = None) -> dict:
    """Parse a Dhan CSV. Optionally saves a debug CSV."""
    try:
        df = pd.read_csv(file_storage)
        structured_df = consolidate_dhan_csv(df)
        if output_csv_path:
            structured_df.to_csv(output_csv_path, index=False)
    except Exception as e:
        raise ValueError(f'Dhan CSV processing error: {e}')
    return _csv_to_trades(structured_df)


# ── JSON / ZIP restore ────────────────────────────────────────────────────────

def import_json_or_zip(file_storage, uploads_dir: str, user_id=None) -> dict:
    """
    Restore journal from a .json or .zip backup file.
    Memory-efficient version that handles large archives by streaming.
    """
    from services.debug_service import log_ai_event
    
    filename = (file_storage.filename or '').lower()
    data = None
    
    # Correctly target the 'data' folder next to the 'static' folder
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(uploads_dir)))
    data_dir = os.path.join(base_dir, 'data')

    try:
        # Seek to start in case of previous reads
        file_storage.seek(0)

        if filename.endswith('.zip'):
            print(f"[Import] Processing ZIP backup: {filename}")
            # ZipFile can read directly from the file stream if it supports seek/tell
            with zipfile.ZipFile(file_storage) as zf:
                raw_list = zf.namelist()
                valid_list = [n for n in raw_list if not n.startswith('__MACOSX/') and not n.endswith('/.DS_Store')]
                
                # 1. Find trades.json (Legacy root or new data/ folder)
                json_name = None
                for name in ['data/trades.json', 'trades.json']:
                    if name in valid_list:
                        json_name = name
                        break
                
                if not json_name:
                    raise ValueError('Backup ZIP missing trades.json (not found in root or data/ folder)')

                # Load trades data
                with zf.open(json_name) as jf:
                    # Handle BOM if present
                    content = jf.read().decode('utf-8-sig')
                    data = json.loads(content)
                
                if not isinstance(data, dict) or 'trades' not in data:
                    raise ValueError('Invalid backup: trades.json missing "trades" key')

                # Save main data file first
                save_trades_to_file(data, user_id)

                # 2. Extract media and supplemental files recursively
                for name in valid_list:
                    if name == json_name:
                        continue
                        
                    # Extract images/media
                    if name.startswith('uploads/') and not name.endswith('/'):
                        rel_path = name[len('uploads/'):]
                        target_path = os.path.join(uploads_dir, rel_path)
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with zf.open(name) as src:
                            with open(target_path, 'wb') as dst:
                                shutil.copyfileobj(src, dst)
                    
                    # Extract other data files from zip's 'data/' folder
                    elif name.startswith('data/') and not name.endswith('/') and name != 'data/trades.json':
                        rel_path = name[len('data/'):]
                        target_path = os.path.join(data_dir, rel_path)
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with zf.open(name) as src:
                            with open(target_path, 'wb') as dst:
                                shutil.copyfileobj(src, dst)

            print(f"[Import] ZIP backup restored successfully.")
        else:
            # Direct JSON upload
            print(f"[Import] Processing JSON backup: {filename}")
            # Handle BOM if present
            content = file_storage.read().decode('utf-8-sig')
            data = json.loads(content)
            
            if not isinstance(data, dict) or 'trades' not in data:
                raise ValueError('Invalid backup: JSON missing "trades" key')
            
            save_trades_to_file(data, user_id)
            print(f"[Import] JSON backup restored successfully.")

        if not data:
            raise ValueError("No data processed from the backup file.")

        return {
            'success': True,
            'trades': data.get('trades', []),
            'columns': data.get('columns', []),
            'allTags': data.get('allTags', []),
            'tagColumns': data.get('tagColumns', []),
            'userColumns': data.get('userColumns', []),
            'dayData': data.get('dayData', {}),
        }

    except Exception as e:
        from services.debug_service import log_ai_error
        # This will be caught by the route which also logs, but we log here for internal service granularity
        log_ai_error(f"import_json_or_zip critical failure: {str(e)}", e)
        raise ValueError(f"Restore failed: {str(e)}")

```

## File: `services/export_service.py`
```py
"""
export_service.py
-----------------
All export/backup logic: Excel, structured CSV, logger Excel, backup ZIP,
and the observations HTML builder.
"""

import io
import json
import os
import re
import zipfile
from collections import defaultdict
from datetime import datetime

import pandas as pd

from processors.data_processors import STRUCTURED_COLUMNS, HISTORICAL_STRUCTURED_COLUMNS


# ── Excel export ─────────────────────────────────────────────────────────────

def build_excel_bytes(data: dict) -> io.BytesIO:
    """Full journal Excel: all trade columns + Image URLs + Image Tags. Returns BytesIO at pos 0."""
    trades = data.get('trades', [])
    columns = data.get('columns', [])

    rows = []
    for trade in trades:
        row = {}
        for col in columns:
            val = trade.get(col, '')
            row[col] = ', '.join(str(v) for v in val) if isinstance(val, list) else val

        images = trade.get('images', [])
        row['Image URLs'] = ' | '.join(images) if images else ''

        image_tags = trade.get('imageTags', {})
        if image_tags:
            parts = [
                f"{url.split('/')[-1]}: {', '.join(tags)}"
                for url, tags in image_tags.items() if tags
            ]
            row['Image Tags'] = ' | '.join(parts)
        else:
            row['Image Tags'] = ''
        rows.append(row)

    all_cols = list(columns) + ['Image URLs', 'Image Tags']
    df = pd.DataFrame(rows, columns=all_cols)

    out = io.BytesIO()
    with pd.ExcelWriter(out, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Trades')
        ws = writer.sheets['Trades']
        for col_cells in ws.columns:
            max_len = max((len(str(c.value)) if c.value else 0) for c in col_cells)
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 60)
    out.seek(0)
    return out


def export_simple_excel(trades: list, columns: list) -> io.BytesIO:
    """Simple trades-only Excel (no image metadata). Returns BytesIO at pos 0."""
    rows = [{ col: trade.get(col, '') for col in columns } for trade in trades]
    df = pd.DataFrame(rows, columns=columns if columns else None)
    out = io.BytesIO()
    with pd.ExcelWriter(out, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Trades')
        ws = writer.sheets['Trades']
        for col_cells in ws.columns:
            max_len = max((len(str(c.value)) if c.value else 0) for c in col_cells)
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 40)
    out.seek(0)
    return out


# ── Structured CSV export ─────────────────────────────────────────────────────

def export_structured_csv(trades: list, req_cols: list) -> io.BytesIO:
    """Export trades as a structured CSV using the canonical column set."""
    export_cols = STRUCTURED_COLUMNS
    if isinstance(req_cols, list) and req_cols:
        if all(c in req_cols for c in HISTORICAL_STRUCTURED_COLUMNS):
            export_cols = HISTORICAL_STRUCTURED_COLUMNS

    rows = [{col: trade.get(col, '') for col in export_cols} for trade in trades]
    df = pd.DataFrame(rows, columns=export_cols)

    csv_str = df.to_csv(index=False)
    out = io.BytesIO(csv_str.encode('utf-8'))
    return out


# ── Logger Excel export ───────────────────────────────────────────────────────

_LOGGER_BASE_COLS = [
    'trade_date', 'date', 'Total Trades', 'Instrument', 'TradeType', 'Qty',
    'Buy Time', 'Sell Time', 'Buy Price (Avg)', 'Sell Price (Avg)', 'Pt', 'Rs', 'Net P/L',
]

_LOGGER_PREFERRED_ORDER = [
    'score', 'dur', 'tar', 'runn', 'sl', 'dd',
    'strat_rev', 'strat_cont',
    'entry_type', 'zone', 'zone_size', 'z_candle', 'bc_gt_20', 'placement', 'near',
    'breakout_c', 'dema', 'en_algo', 'en_sl10', 'en_sc10', 'dist_gt_20',
    'ex_nafs', 'sc_sl_moved', 'mgt_patience', 'mgt_conf',
    'sc_targ_move', 'sc_gt10', 'sc_ptrail', 'ex_sl', 'ex_targ', 'ex_kill',
    'en_nafs', 'en_patience', 'en_conf', 'en_impulsive', 'en_desperate',
    'en_distracted', 'en_panic',
    'ex_patience', 'ex_conf', 'ex_swing', 'ex_impulsive', 'ex_distracted',
    'ex_panic', 'ex_desperate', 'ex_sahi',
    '_schemaVersion', '_migrationLog',
]

_LOGGER_HEADER_MAP = {
    'score': 'Score', 'dur': 'DUR (min)', 'tar': 'TAR', 'runn': 'RUNN', 'sl': 'SL',
    'dd': 'DD', 'strat_rev': 'Strategy - Reversal', 'strat_cont': 'Strategy - Cont',
    'entry_type': 'Entry Type', 'zone': 'Zone (Y/N)', 'zone_size': 'Zone Size',
    'z_candle': 'Zone Candle', 'bc_gt_20': 'Break Candle > 20pt', 'placement': 'Placement',
    'near': 'Near', 'breakout_c': 'Breakout Candle', 'dema': 'DEMA',
    'en_algo': 'Algo Signal', 'en_sl10': 'SL Under 10', 'en_sc10': 'SL Under 10 (Legacy)',
    'dist_gt_20': 'Dist > 20', 'ex_nafs': 'Management - Nafs Pe Kabu',
    'sc_sl_moved': 'Management - SL moved', 'mgt_patience': 'Management - Patience',
    'mgt_conf': 'Management - Confirmation', 'sc_targ_move': 'Exit - Target move',
    'sc_gt10': 'Exit - >10 pt', 'sc_ptrail': 'Exit - Profit trail',
    'ex_sl': 'Exit - SL', 'ex_targ': 'Exit - Target', 'ex_kill': 'Exit - Kill Switch',
    'en_nafs': 'Entry Emotion + Nafs Pe Kabu', 'en_patience': 'Entry Emotion + Patience',
    'en_conf': 'Entry Emotion + Confirmation', 'en_impulsive': 'Entry Emotion - Impulsive',
    'en_desperate': 'Entry Emotion - Desperate', 'en_distracted': 'Entry Emotion - Distracted',
    'en_panic': 'Entry Emotion - Panic', 'ex_patience': 'Exit Emotion + Patience',
    'ex_conf': 'Exit Emotion + Confirmation', 'ex_swing': 'Exit Emotion + Swing Creation',
    'ex_impulsive': 'Exit Emotion - Impulsive', 'ex_distracted': 'Exit Emotion - Distracted',
    'ex_panic': 'Exit Emotion - Panic', 'ex_desperate': 'Exit Emotion - Desperate',
    'ex_sahi': 'Exit Emotion - Sahi Nahi Lag Raha',
    '_schemaVersion': 'Logger Schema Version', '_migrationLog': 'Logger Migration Log',
}


def export_logger_excel(trades: list) -> io.BytesIO:
    """Logger-specific Excel with two sheets: full export + logger-only rows."""
    logger_keys = set()
    for t in trades:
        tl = t.get('tradeLogger') if isinstance(t, dict) else None
        if isinstance(tl, dict):
            logger_keys.update(tl.keys())

    ordered_keys = [k for k in _LOGGER_PREFERRED_ORDER if k in logger_keys]
    ordered_keys += sorted([k for k in logger_keys if k not in ordered_keys])
    logger_cols = [_LOGGER_HEADER_MAP.get(k, k) for k in ordered_keys]
    cols = ['row_index'] + _LOGGER_BASE_COLS + logger_cols

    rows = []
    for i, t in enumerate(trades, 1):
        row = {'row_index': i}
        for c in _LOGGER_BASE_COLS:
            row[c] = t.get(c, '')
        tl = t.get('tradeLogger') if isinstance(t, dict) else {}
        for k in ordered_keys:
            out_col = _LOGGER_HEADER_MAP.get(k, k)
            v = tl.get(k, '') if isinstance(tl, dict) else ''
            row[out_col] = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
        rows.append(row)

    df_all = pd.DataFrame(rows, columns=cols)
    if logger_cols:
        has_logger = df_all[logger_cols].apply(
            lambda r: any(str(v).strip() not in ('', '[]', '{}') for v in r), axis=1
        )
        df_logger = df_all[has_logger]
    else:
        df_logger = df_all.iloc[0:0]

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_all.to_excel(writer, index=False, sheet_name='LoggerExport')
        df_logger.to_excel(writer, index=False, sheet_name='LoggerOnly')
        for ws_name in ('LoggerExport', 'LoggerOnly'):
            ws = writer.sheets[ws_name]
            for col_cells in ws.columns:
                max_len = max((len(str(c.value)) if c.value else 0) for c in col_cells)
                ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 3, 44)

    output.seek(0)
    return output


# ── Backup ZIP ────────────────────────────────────────────────────────────────

def build_backup_zip(data_file: str, uploads_dir: str) -> tuple[bytes, str]:
    """
    Build a TRULY full backup ZIP: 
    1. Entire data/ directory (JSONs, logs, schemas)
    2. Entire static/uploads/ directory (recursively: images, audio, video)
    3. Excel export
    4. Observations HTML builder
    Returns (zip_bytes, timestamp_str).
    """
    data_dir = os.path.dirname(data_file)
    with open(data_file, 'r', encoding='utf-8') as f:
        journal_data = json.load(f)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 1. Back up EVERYTHING in the data directory (recursively — includes Historical_OHLC/)
        # Skip backups/ and local_backups/ subdirs to avoid recursive bloat
        _skip_subdirs = {'backups', 'local_backups'}
        if os.path.isdir(data_dir):
            for root, dirs, files in os.walk(data_dir):
                dirs[:] = [d for d in dirs if d not in _skip_subdirs]
                for fname in files:
                    fpath = os.path.join(root, fname)
                    rel_path = os.path.relpath(fpath, data_dir)
                    zf.write(fpath, f'data/{rel_path}')
        
        # 2. Back up EVERYTHING in static/uploads recursively (images, audio, video, etc)
        if os.path.isdir(uploads_dir):
            for root, dirs, files in os.walk(uploads_dir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    # Get relative path from uploads_dir to maintain structure
                    rel_path = os.path.relpath(fpath, uploads_dir)
                    # We store it in an 'uploads/' folder inside the ZIP
                    zf.write(fpath, f'uploads/{rel_path}')

        # 3. Add the generated Excel and HTML reports
        zf.writestr('trades_export.xlsx', build_excel_bytes(journal_data).getvalue())
        zf.writestr('observations.html', build_observations_html(journal_data, timestamp))
        
    buf.seek(0)
    return buf.read(), timestamp


# ── Observations HTML ─────────────────────────────────────────────────────────

_IMG_COUNTER = [0]


def _img_block_html(url: str, boxes=None, overlay_url=None) -> str:
    fname = url.split('/')[-1]
    ovl_fname = overlay_url.split('/')[-1] if overlay_url else None
    style = (
        'max-width:100%;max-height:420px;border-radius:6px;'
        'border:1px solid #ccc;margin:4px;cursor:pointer;display:block;'
    )
    if not boxes and not ovl_fname:
        return (
            f'<a href="uploads/{fname}" target="_blank">'
            f'<img src="uploads/{fname}" style="{style}" loading="lazy" title="{fname}"></a>'
        )

    _IMG_COUNTER[0] += 1
    cid = f'mc_{_IMG_COUNTER[0]}'
    boxes_json = json.dumps(boxes or [])
    ovl_js = f"'uploads/{ovl_fname}'" if ovl_fname else 'null'

    js = f'''<script>
(function(){{
  var c=document.getElementById('{cid}');
  var boxes={boxes_json};
  var overlayUrl={ovl_js};
  function drawBoxes(ctx,w,h){{
    var lw=Math.max(2,Math.round(w/400));
    var fs=Math.max(13,Math.round(w/80));
    boxes.forEach(function(b){{
      var col=b.color||'#2ea043';
      ctx.strokeStyle=col; ctx.lineWidth=lw;
      ctx.strokeRect(b.x,b.y,b.w,b.h);
      var tags=Array.isArray(b.tags)?b.tags:[];
      if(tags.length){{
        ctx.font='bold '+fs+'px Arial';
        var label=tags.join(', ');
        var tw=ctx.measureText(label).width;
        ctx.fillStyle='rgba(0,0,0,0.65)';
        ctx.fillRect(b.x,b.y-fs-6,tw+10,fs+8);
        ctx.fillStyle='#fff';
        ctx.fillText(label,b.x+5,b.y-4);
      }}
    }});
  }}
  var img=new Image();
  img.onload=function(){{
    c.width=img.naturalWidth; c.height=img.naturalHeight;
    var ctx=c.getContext('2d');
    ctx.drawImage(img,0,0);
    if(overlayUrl){{
      var ovl=new Image();
      ovl.onload=function(){{
        ctx.drawImage(ovl,0,0,c.width,c.height);
        drawBoxes(ctx,c.width,c.height);
      }};
      ovl.onerror=function(){{drawBoxes(ctx,c.width,c.height);}};
      ovl.src=overlayUrl;
    }}else{{
      drawBoxes(ctx,c.width,c.height);
    }}
  }};
  img.src='uploads/{fname}';
  c.onclick=function(){{window.open('uploads/{fname}','_blank');}};
}})();
</script>'''

    return f'<canvas id="{cid}" style="{style}" title="{fname}"></canvas>' + js


def build_observations_html(data: dict, timestamp: str) -> bytes:
    trades = data.get('trades', [])
    day_data = data.get('dayData', {})

    trades_by_date = defaultdict(list)
    for trade in trades:
        trades_by_date[trade.get('date', 'Unknown')].append(trade)

    all_dates = sorted(set(list(trades_by_date.keys()) + list(day_data.keys())))
    ts_display = timestamp.replace('_', ' ')

    parts = [f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<title>Trading Journal — Observations</title>
<style>
  body{{font-family:Arial,sans-serif;max-width:960px;margin:40px auto;padding:20px;color:#222;}}
  h1{{border-bottom:2px solid #333;padding-bottom:10px;}}
  .notice{{background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 16px;margin-bottom:20px;font-size:.9em;}}
  .generated{{color:#888;font-size:.85em;margin-top:4px;}}
  .date-section{{margin:28px 0;border:1px solid #ddd;border-radius:8px;padding:20px;}}
  .date-header{{font-size:1.35em;font-weight:bold;color:#1a3a8c;margin-bottom:14px;}}
  .day-meta{{font-size:.85em;color:#555;margin-bottom:8px;}}
  .img-row{{margin:8px 0;display:flex;flex-wrap:wrap;gap:6px;}}
  .img-caption{{font-size:.75em;color:#777;margin-top:2px;}}
  .trade-block{{background:#f7f9ff;border-left:4px solid #4a7fd9;padding:12px 16px;margin:12px 0;border-radius:4px;}}
  .trade-meta{{font-size:.9em;color:#444;margin-bottom:8px;}}
  .observation{{margin-top:8px;line-height:1.6;}}
  .note-box{{background:#fffbe6;border-left:3px solid #f0a500;padding:8px 12px;margin-top:8px;font-size:.9em;}}
  .tags{{margin-top:6px;}}
  .tag{{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:4px;padding:2px 8px;font-size:.78em;margin:2px;}}
  .no-content{{color:#aaa;font-style:italic;font-size:.9em;}}
  .section-label{{font-weight:bold;font-size:.85em;color:#555;margin:10px 0 4px;}}
</style></head>
<body>
<h1>Trading Journal — Observations & Notes</h1>
<div class="notice">&#9432; <strong>Images dikhane ke liye:</strong> Pehle ZIP extract karo, phir yeh file kholo.</div>
<p class="generated">Generated: {ts_display}</p>''']

    for date in all_dates:
        day = day_data.get(date, {})
        day_trades = trades_by_date.get(date, [])

        parts.append('<div class="date-section">')
        parts.append(f'<div class="date-header">{date}</div>')

        if day.get('video'):
            v = day['video']
            parts.append(f'<p class="day-meta"><strong>Video:</strong> <a href="{v}" target="_blank">{v}</a></p>')

        if day.get('images'):
            day_mboxes = day.get('marqueeBoxes', {})
            day_overlays = day.get('overlays', {})
            parts.append('<div class="section-label">Day Images:</div><div class="img-row">')
            for url in day['images']:
                parts.append(_img_block_html(url, boxes=day_mboxes.get(url) or None, overlay_url=day_overlays.get(url) or None))
            parts.append('</div>')

        if not day_trades:
            parts.append('<p class="no-content">No trades recorded.</p>')

        for trade in day_trades:
            instrument = trade.get('Instrument', '')
            trade_type = str(trade.get('TradeType', '')).upper()
            qty = trade.get('Qty', '')
            rs = trade.get('Rs', '')
            observation = trade.get('observation', '')
            note = trade.get('Note') or trade.get('note', '')
            images = trade.get('images', [])
            image_tags = trade.get('imageTags', {})

            tag_vals = []
            for col, val in trade.items():
                if isinstance(val, list) and val and col not in ('images',):
                    tag_vals.extend(str(v) for v in val)

            parts.append('<div class="trade-block">')
            meta = ' &middot; '.join(filter(None, [
                f'<strong>{instrument}</strong>' if instrument else '',
                trade_type,
                f'Qty: {qty}' if qty != '' else '',
                f'P&L: <strong>{rs}</strong>' if rs != '' else '',
            ]))
            parts.append(f'<div class="trade-meta">{meta}</div>')

            if observation:
                parts.append(f'<div class="observation">{observation}</div>')
            if note:
                parts.append(f'<div class="note-box"><strong>Note:</strong> {note}</div>')
            if tag_vals:
                tags_html = ''.join(f'<span class="tag">{t}</span>' for t in tag_vals)
                parts.append(f'<div class="tags">{tags_html}</div>')

            if images:
                trade_mboxes = trade.get('marqueeBoxes', {})
                trade_overlays = trade.get('overlays', {})
                parts.append('<div class="section-label">Trade Images:</div><div class="img-row">')
                for url in images:
                    parts.append(_img_block_html(url, boxes=trade_mboxes.get(url) or None, overlay_url=trade_overlays.get(url) or None))
                parts.append('</div>')
                if image_tags:
                    for url, itags in image_tags.items():
                        if itags:
                            fname = url.split('/')[-1]
                            parts.append(f'<div class="img-caption">{fname}: {", ".join(itags)}</div>')

            if not observation and not note and not tag_vals and not images:
                parts.append('<p class="no-content">No observation, note, or images.</p>')
            parts.append('</div>')

        parts.append('</div>')

    parts.append('</body></html>')
    return '\n'.join(parts).encode('utf-8')

```

## File: `services/backup_service.py`
```py
"""
services/backup_service.py
--------------------------
Auto-backup logic: copy the trades data file to a timestamped backup,
keep only the last 30 per user. Called after every successful save.
"""
import logging
import os
import shutil
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_last_backup_time: float = 0
_INTERVAL = 300  # seconds between auto-backups (5 minutes)
_MAX_BACKUPS = 30


def auto_backup(data_file: str, user_id=None, force: bool = False) -> str | None:
    """
    Copy data_file to a timestamped backup in the backups/ subdirectory.
    Returns the backup file path on success, None on skip or error.

    force=True bypasses the 5-minute interval check (use for pre-destructive operations).
    """
    global _last_backup_time
    now = time.time()

    with _lock:
        if not force and now - _last_backup_time < _INTERVAL:
            return None
        _last_backup_time = now

    try:
        backup_dir = os.path.join(os.path.dirname(data_file), 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        user_prefix = f'user_{user_id}_' if user_id is not None else ''
        backup_file = os.path.join(backup_dir, f'trades_backup_{user_prefix}{timestamp}.json')
        shutil.copy2(data_file, backup_file)

        # Prune old backups — keep only the most recent _MAX_BACKUPS
        prefix = f'trades_backup_{user_prefix}'
        all_backups = sorted(
            os.path.join(backup_dir, f)
            for f in os.listdir(backup_dir)
            if f.startswith(prefix)
        )
        for old in all_backups[:-_MAX_BACKUPS]:
            os.remove(old)

        return backup_file

    except Exception:
        logger.exception('Auto-backup failed for %s', data_file)
        return None

```

## File: `services/image_service.py`
```py
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
    file_bytes = file_storage.read()
    fname = original_filename or file_storage.filename or f'{uuid.uuid4()}.jpg'
    safe_name = re.sub(r'[^\w.\-]', '_', os.path.basename(fname))

    from config import IMAGEKIT_URL_ENDPOINT
    ik = _get_imagekit()
    result = ik.files.upload(
        file=io.BytesIO(file_bytes),
        file_name=safe_name,
        folder='/trading_journal/',
        use_unique_file_name=True,
    )
    # result.url is Optional in v5 SDK — fall back to constructing from file_path
    url = result.url or f"{IMAGEKIT_URL_ENDPOINT}{result.file_path}"
    return {
        'url': url,
        'filename': result.file_id,
        'imagekit': True,
    }


def _upload_to_imagekit_from_path(filepath: str, original_filename: str = '') -> dict:
    """Upload an already-saved local file to ImageKit (secondary CDN step)."""
    import io
    safe_name = re.sub(r'[^\w.\-]', '_', os.path.basename(original_filename or filepath))
    with open(filepath, 'rb') as fh:
        file_bytes = fh.read()

    from config import IMAGEKIT_URL_ENDPOINT
    ik = _get_imagekit()
    result = ik.files.upload(
        file=io.BytesIO(file_bytes),
        file_name=safe_name,
        folder='/trading_journal/',
        use_unique_file_name=True,
    )
    url = result.url or f"{IMAGEKIT_URL_ENDPOINT}{result.file_path}"
    return {'url': url, 'filename': result.file_id, 'imagekit': True}


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

    # ── ALWAYS save locally first (platform-independent safety) ───────────────
    filename = f'{uuid.uuid4()}{ext}'
    filepath = os.path.join(uploads_dir, filename)
    file_storage.save(filepath)

    original_t = _parse_time_from_filename(orig_name) or last_modified_s or os.path.getmtime(filepath)
    try:
        with open(filepath + '.meta', 'w') as f:
            json.dump({'t': original_t}, f)
    except OSError:
        pass

    _copy_to_backup(filepath, filename)

    # ── ImageKit upload (optional, after local save) ───────────────────────────
    # Local file is the source of truth; ImageKit is secondary CDN only.
    if USE_IMAGEKIT:
        try:
            result = _upload_to_imagekit_from_path(filepath, orig_name or filename)
            # Return CDN URL but local file stays as fallback
            return result
        except Exception:
            pass  # CDN failed — local file is already saved, return local URL

    from config import UPLOADS_DIR as _UPLOADS_DIR
    rel = os.path.relpath(filepath, _UPLOADS_DIR).replace(os.sep, '/')
    return {'url': f'/uploads/{rel}', 'filename': filename}


def _copy_to_backup(src_path: str, filename: str):
    """Copy a freshly-saved image to the user-configured backup folder (month/date sub-folder)."""
    import shutil
    from datetime import date
    _MONTH_NAMES = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
        '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
        '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
    }
    try:
        from config import BACKUP_CONFIG_FILE
        if not os.path.exists(BACKUP_CONFIG_FILE):
            return
        with open(BACKUP_CONFIG_FILE) as f:
            cfg = json.load(f)
        folder = cfg.get('folder', '').strip()
        if not folder:
            return
        date_str = str(date.today())           # e.g. 2026-05-01
        mm = date_str[5:7]                     # '05'
        month_folder = f"{mm} - {_MONTH_NAMES.get(mm, mm)}"  # '05 - May'
        day_dir = os.path.join(folder, 'uploaded_imgs', month_folder, date_str)
        os.makedirs(day_dir, exist_ok=True)
        shutil.copy2(src_path, os.path.join(day_dir, filename))
    except Exception:
        pass  # backup is best-effort; never break the upload flow


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

```

## File: `services/page_service.py`
```py
"""
services/page_service.py
------------------------
Business logic for page routes: blog entry loading and formatting.
"""
import json
import os
from datetime import datetime


def load_blog_entries(blog_path: str) -> list:
    """Load and return raw blog entries from the JSON file. Returns [] if missing."""
    if not os.path.exists(blog_path):
        return []
    with open(blog_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        if not content:
            return []
        return json.loads(content)


def get_blog_entries_for_template(blog_path: str) -> list:
    """Return blog entries formatted for the /updates HTML template (long date format)."""
    entries = load_blog_entries(blog_path)
    for i, entry in enumerate(entries):
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        entry['display_date'] = dt.strftime('%B %d, %Y')
        entry['display_day'] = dt.strftime('%A')
        entry['_idx'] = i
    entries.sort(key=lambda x: (x['date'], x['_idx']), reverse=True)
    return entries


def get_blog_entries_for_api(blog_path: str) -> list:
    """Return blog entries formatted for the /api/blog-posts JSON response (short date)."""
    entries = load_blog_entries(blog_path)
    for entry in entries:
        dt = datetime.strptime(entry['date'], '%Y-%m-%d')
        entry['display_date'] = f"{dt.strftime('%B')} {dt.day}"
        entry['display_day'] = dt.strftime('%A')
    entries.sort(key=lambda x: x['date'], reverse=True)
    return entries

```

## File: `services/auth_service.py`
```py
"""
services/auth_service.py
------------------------
Business logic for authentication: user data migration on first registration.
"""
import logging
import os
import shutil

from config import BASE_DIR, DATA_FILE

logger = logging.getLogger(__name__)


def migrate_default_data_for_first_user(user_id: int) -> None:
    """
    If user_id == 1, copy the shared trades.json into trades_1.json
    so the first registered user inherits any pre-existing trade data.
    No-op if trades_1.json already exists or trades.json is missing.
    """
    if user_id != 1:
        # New users get randomised demo data so they can explore the app
        # without starting from a blank slate.
        try:
            from services.demo_service import generate_demo_data_for_user
            generate_demo_data_for_user(user_id)
        except Exception:
            logger.exception('Failed to generate demo data for user %s', user_id)
        return
    user_trades = os.path.join(BASE_DIR, 'data', f'trades_{user_id}.json')
    if os.path.exists(DATA_FILE) and not os.path.exists(user_trades):
        try:
            shutil.copy2(DATA_FILE, user_trades)
            logger.info('Migrated default trades.json → trades_%s.json', user_id)
        except Exception:
            logger.exception('Failed to migrate default trades data for user %s', user_id)

```

## File: `services/token_service.py`
```py
"""
token_service.py
----------------
Signed API tokens for cross-origin auth (used by tradefeed static frontend).
Uses itsdangerous (bundled with Flask) — no extra dependencies.
"""
from itsdangerous import URLSafeTimedSerializer
from config import SECRET_KEY

_serializer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE = 86400 * 30  # 30 days


def create_token(user_id: int) -> str:
    return _serializer.dumps({'user_id': user_id}, salt='api-token')


def verify_token(token: str):
    """Returns user_id int if valid, None otherwise."""
    try:
        data = _serializer.loads(token, salt='api-token', max_age=TOKEN_MAX_AGE)
        return data.get('user_id')
    except Exception:
        return None

```
