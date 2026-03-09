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

def build_excel_bytes(data: dict) -> bytes:
    """Full journal Excel: all trade columns + Image URLs + Image Tags."""
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
    return out.getvalue()


def export_simple_excel(trades: list, columns: list) -> bytes:
    """Simple trades-only Excel (no image metadata)."""
    rows = []
    for trade in trades:
        row = {col: trade.get(col, '') for col in columns}
        rows.append(row)

    df = pd.DataFrame(rows, columns=columns if columns else None)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Trades')
        ws = writer.sheets['Trades']
        for col_cells in ws.columns:
            max_len = max((len(str(c.value)) if c.value else 0) for c in col_cells)
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 40)
    output.seek(0)
    return output.read()


# ── Structured CSV export ─────────────────────────────────────────────────────

def export_structured_csv(trades: list, req_cols: list) -> bytes:
    """Export trades as a structured CSV using the canonical column set."""
    export_cols = STRUCTURED_COLUMNS
    if isinstance(req_cols, list) and req_cols:
        if all(c in req_cols for c in HISTORICAL_STRUCTURED_COLUMNS):
            export_cols = HISTORICAL_STRUCTURED_COLUMNS

    rows = [{col: trade.get(col, '') for col in export_cols} for trade in trades]
    df = pd.DataFrame(rows, columns=export_cols)

    output = io.StringIO()
    df.to_csv(output, index=False)
    return output.getvalue().encode('utf-8')


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


def export_logger_excel(trades: list) -> bytes:
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
    return output.read()


# ── Backup ZIP ────────────────────────────────────────────────────────────────

def build_backup_zip(data_file: str, uploads_dir: str) -> tuple[bytes, str]:
    """
    Build a full backup ZIP: trades.json + all upload images + Excel + observations HTML.
    Returns (zip_bytes, timestamp_str).
    """
    with open(data_file, 'r', encoding='utf-8') as f:
        journal_data = json.load(f)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(data_file, 'trades.json')
        if os.path.isdir(uploads_dir):
            for fname in os.listdir(uploads_dir):
                fpath = os.path.join(uploads_dir, fname)
                if os.path.isfile(fpath):
                    zf.write(fpath, f'uploads/{fname}')
        zf.writestr('trades_export.xlsx', build_excel_bytes(journal_data))
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
