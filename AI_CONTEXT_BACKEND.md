# Backend Context
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `app.py`
```py
﻿from flask import Flask, request, jsonify, render_template, send_file, send_from_directory
import pandas as pd
import json
import os
import io
import uuid
import time
import shutil
from datetime import datetime
import re
import zipfile
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.getenv('DATA_FILE', os.path.join(BASE_DIR, 'data', 'trades.json'))
UPLOADS_DIR = os.getenv('UPLOADS_DIR', os.path.join(BASE_DIR, 'static', 'uploads'))

os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

from data_processors import STRUCTURED_COLUMNS, HISTORICAL_STRUCTURED_COLUMNS, consolidate_raw_fills, consolidate_zerodha_historical_csv, consolidate_dhan_csv

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/trades', methods=['GET'])
def get_trades():
    return jsonify(load_trades())


@app.route('/api/trades', methods=['POST'])
def post_trades():
    data = request.json
    if not data:
        return jsonify({'error': 'No data'}), 400
    save_trades_to_file(data)
    return jsonify({'success': True})


@app.route('/api/import-excel', methods=['POST'])
def import_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        file_bytes = file.read()

        # Try default read first
        df = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl')

        # Count unnamed columns
        unnamed = sum(1 for c in df.columns if str(c).startswith('Unnamed:'))

        # If most columns are unnamed, try skiprows=1
        if unnamed > len(df.columns) / 2:
            df2 = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl', skiprows=1)
            unnamed2 = sum(1 for c in df2.columns if str(c).startswith('Unnamed:'))
            if unnamed2 < unnamed:
                df = df2

        # Drop fully-unnamed columns (blank headers)
        named_cols = [c for c in df.columns if not str(c).startswith('Unnamed:')]
        df = df[named_cols]

        # Drop completely empty rows
        df = df.dropna(how='all')

        # Clean column names
        df.columns = [str(c).strip() for c in df.columns]

    except Exception as e:
        return jsonify({'error': f'Excel read error: {str(e)}'}), 400

    # Preserve existing images
    existing = load_trades()
    existing_by_date = {t.get('date', ''): t for t in existing.get('trades', [])}

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

        # Find date key
        date_key = ''
        for col in columns:
            if 'date' in col.lower():
                date_key = str(trade.get(col, ''))
                break

        trade['date'] = date_key

        if date_key in existing_by_date:
            trade['images'] = existing_by_date[date_key].get('images', [])
        else:
            trade['images'] = []

        trades.append(trade)

    return jsonify({'trades': trades, 'columns': columns})


@app.route('/api/import-json', methods=['POST'])
def import_json():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    filename = (file.filename or '').lower()
    try:
        if filename.endswith('.zip'):
            file_bytes = file.read()
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                with zf.open('trades.json') as jf:
                    data = json.load(jf)
                if 'trades' not in data:
                    return jsonify({'error': 'Invalid backup file'}), 400
                save_trades_to_file(data)
                os.makedirs(UPLOADS_DIR, exist_ok=True)
                for name in zf.namelist():
                    if name.startswith('uploads/') and not name.endswith('/'):
                        img_fname = os.path.basename(name)
                        if img_fname:
                            img_path = os.path.join(UPLOADS_DIR, img_fname)
                            with zf.open(name) as img_src:
                                with open(img_path, 'wb') as img_dst:
                                    img_dst.write(img_src.read())
        else:
            data = json.load(file)
            if 'trades' not in data:
                return jsonify({'error': 'Invalid backup file'}), 400
            save_trades_to_file(data)
        return jsonify({'success': True, 'trades': data.get('trades', []), 'columns': data.get('columns', [])})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/import-raw-csv', methods=['POST'])
def import_raw_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        df = pd.read_csv(file)
        structured_df = consolidate_raw_fills(df)
    except Exception as e:
        return jsonify({'error': f'CSV processing error: {str(e)}'}), 400

    # Normalize "today" CSV output to same column format as historical output
    structured_df = structured_df.rename(columns={
        'Sell Price': 'Sell Price (Avg)',
        'Buy Price': 'Buy Price (Avg)',
        'Date': 'trade_date'
    })
    for col in HISTORICAL_STRUCTURED_COLUMNS:
        if col not in structured_df.columns:
            structured_df[col] = ''
    structured_df = structured_df[HISTORICAL_STRUCTURED_COLUMNS]

    trades = []
    for row in structured_df.to_dict(orient='records'):
        trade = dict(row)
        trade['date'] = str(trade.get('trade_date', ''))
        trade['images'] = []
        trades.append(trade)

    return jsonify({
        'trades': trades,
        'columns': HISTORICAL_STRUCTURED_COLUMNS
    })


@app.route('/api/import-historical-csv', methods=['POST'])
def import_historical_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        df = pd.read_csv(file)
        structured_df = consolidate_zerodha_historical_csv(df)
        # Also export on server as requested
        structured_df.to_csv(os.path.join(BASE_DIR, 'structured_trades.csv'), index=False)
    except Exception as e:
        return jsonify({'error': f'Historical CSV processing error: {str(e)}'}), 400

    trades = []
    for row in structured_df.to_dict(orient='records'):
        trade = dict(row)
        trade['date'] = str(trade.get('trade_date', ''))
        trade['images'] = []
        trades.append(trade)

    return jsonify({
        'trades': trades,
        'columns': HISTORICAL_STRUCTURED_COLUMNS
    })


@app.route('/api/import-dhan-csv', methods=['POST'])
def import_dhan_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        df = pd.read_csv(file)
        structured_df = consolidate_dhan_csv(df)
        structured_df.to_csv(os.path.join(BASE_DIR, 'structured_trades.csv'), index=False)
    except Exception as e:
        return jsonify({'error': f'Dhan CSV processing error: {str(e)}'}), 400

    trades = []
    for row in structured_df.to_dict(orient='records'):
        trade = dict(row)
        trade['date'] = str(trade.get('trade_date', ''))
        trade['images'] = []
        trades.append(trade)

    return jsonify({
        'trades': trades,
        'columns': HISTORICAL_STRUCTURED_COLUMNS
    })


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image'}), 400

    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    allowed = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        return jsonify({'error': f'Invalid file type: {ext}'}), 400

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    file.save(filepath)

    return jsonify({
        'url': f'/uploads/{filename}',
        'filename': filename
    })


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOADS_DIR, filename)


@app.route('/api/delete-image', methods=['POST'])
def delete_image():
    data = request.json or {}
    filename = os.path.basename(data.get('filename', ''))
    if filename:
        filepath = os.path.join(UPLOADS_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    return jsonify({'success': True})


def _build_excel_bytes(data):
    """Generate Excel with all trade columns + tags + image URLs."""
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
            parts = [f"{url.split('/')[-1]}: {', '.join(tags)}"
                     for url, tags in image_tags.items() if tags]
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


_img_counter = [0]


def _img_block_html(url, boxes=None, overlay_url=None):
    """Canvas block: original image → overlay (pen drawings) → marquee boxes."""
    import json as _json
    fname = url.split('/')[-1]
    ovl_fname = overlay_url.split('/')[-1] if overlay_url else None
    style = ('max-width:100%;max-height:420px;border-radius:6px;'
             'border:1px solid #ccc;margin:4px;cursor:pointer;display:block;')

    # Plain img when nothing to composite
    if not boxes and not ovl_fname:
        return (f'<a href="uploads/{fname}" target="_blank">'
                f'<img src="uploads/{fname}" style="{style}" loading="lazy" title="{fname}"></a>')

    _img_counter[0] += 1
    cid = f'mc_{_img_counter[0]}'
    boxes_json = _json.dumps(boxes or [])
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


def _build_observations_html(data, timestamp):
    """Generate a human-readable HTML file of observations, notes, and images."""
    from collections import defaultdict
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
<div class="notice">&#9432; <strong>Images dikhane ke liye:</strong> Pehle ZIP extract karo, phir yeh file kholo. Directly ZIP ke andar se open karne par images nahi dikhenge.</div>
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
                parts.append(_img_block_html(
                    url,
                    boxes=day_mboxes.get(url) or None,
                    overlay_url=day_overlays.get(url) or None
                ))
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
                f'P&L: <strong>{rs}</strong>' if rs != '' else ''
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
                    parts.append(_img_block_html(
                        url,
                        boxes=trade_mboxes.get(url) or None,
                        overlay_url=trade_overlays.get(url) or None
                    ))
                parts.append('</div>')
                if image_tags:
                    for url, itags in image_tags.items():
                        if itags:
                            fname = url.split('/')[-1]
                            caption = ', '.join(itags)
                            parts.append(f'<div class="img-caption">{fname}: {caption}</div>')

            if not observation and not note and not tag_vals and not images:
                parts.append('<p class="no-content">No observation, note, or images.</p>')

            parts.append('</div>')

        parts.append('</div>')

    parts.append('</body></html>')
    return '\n'.join(parts).encode('utf-8')


@app.route('/api/backup', methods=['GET'])
def backup():
    if not os.path.exists(DATA_FILE):
        return jsonify({'error': 'No data to backup'}), 404

    requested_name = str(request.args.get('name', '')).strip()
    safe_name = re.sub(r'[^A-Za-z0-9_\- ]+', '', requested_name).strip()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = safe_name if safe_name else f'trading_journal_{timestamp}'

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        journal_data = json.load(f)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(DATA_FILE, 'trades.json')
        if os.path.isdir(UPLOADS_DIR):
            for fname in os.listdir(UPLOADS_DIR):
                fpath = os.path.join(UPLOADS_DIR, fname)
                if os.path.isfile(fpath):
                    zf.write(fpath, f'uploads/{fname}')
        zf.writestr('trades_export.xlsx', _build_excel_bytes(journal_data))
        zf.writestr('observations.html', _build_observations_html(journal_data, timestamp))
    buf.seek(0)

    return send_file(buf, as_attachment=True,
                     download_name=f'{base_name}.zip',
                     mimetype='application/zip')


@app.route('/api/export-excel', methods=['POST'])
def export_excel():
    data = request.json or {}
    trades  = data.get('trades', [])
    columns = data.get('columns', [])

    if not trades:
        return jsonify({'error': 'No data to export'}), 400

    rows = []
    for trade in trades:
        row = {}
        for col in columns:
            row[col] = trade.get(col, '')
        rows.append(row)

    df = pd.DataFrame(rows, columns=columns if columns else None)

    # Style the Excel output
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Trades')
        ws = writer.sheets['Trades']

        # Auto-fit column widths
        for col_cells in ws.columns:
            max_len = max((len(str(c.value)) if c.value else 0) for c in col_cells)
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 40)

    output.seek(0)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return send_file(
        output,
        as_attachment=True,
        download_name=f'trading_journal_{timestamp}.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@app.route('/api/export-structured-csv', methods=['POST'])
def export_structured_csv():
    data = request.json or {}
    trades = data.get('trades', [])
    req_cols = data.get('columns', [])

    if not trades:
        return jsonify({'error': 'No data to export'}), 400

    export_cols = STRUCTURED_COLUMNS
    if isinstance(req_cols, list) and req_cols:
        if all(c in req_cols for c in HISTORICAL_STRUCTURED_COLUMNS):
            export_cols = HISTORICAL_STRUCTURED_COLUMNS

    rows = []
    for trade in trades:
        row = {}
        for col in export_cols:
            row[col] = trade.get(col, '')
        rows.append(row)

    df = pd.DataFrame(rows, columns=export_cols)
    output = io.StringIO()
    df.to_csv(output, index=False)
    mem = io.BytesIO(output.getvalue().encode('utf-8'))
    mem.seek(0)

    return send_file(
        mem,
        as_attachment=True,
        download_name='structured_trades.csv',
        mimetype='text/csv'
    )


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5000'))
    debug = str(os.getenv('FLASK_DEBUG', 'true')).strip().lower() in ('1', 'true', 'yes')
    print("=" * 50)
    print("  Trading Journal - Starting Server")
    print(f"  Open: http://localhost:{port}")
    print("=" * 50)
    app.run(debug=debug, host=host, port=port)

```

## File: `data_processors.py`
```py
import pandas as pd
STRUCTURED_COLUMNS = [
    'Instrument',
    'TradeType',
    'Date',
    'Qty',
    'Sell Time',
    'Sell Price',
    'Buy Time',
    'Buy Price',
    'Pt',
    'Rs'
]

HISTORICAL_STRUCTURED_COLUMNS = [
    'Instrument',
    'TradeType',
    'Qty',
    'Sell Time',
    'Sell Price (Avg)',
    'Buy Time',
    'Buy Price (Avg)',
    'Pt',
    'Rs',
    'trade_date'
]


def load_trades():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'trades': [],
        'columns': ['Date', 'Profit', 'Trade'],
        'allTags': [],
        'tagColumns': [],
        'userColumns': [],
        'dayData': {},
        'tagGroups': {}
    }


LAST_BACKUP_TIME = 0

def save_trades_to_file(data):
    global LAST_BACKUP_TIME
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    current_time = time.time()
    if current_time - LAST_BACKUP_TIME > 300:  # Backup every 5 minutes if there are changes
        LAST_BACKUP_TIME = current_time
        try:
            backup_dir = os.path.join(BASE_DIR, 'data', 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_file = os.path.join(backup_dir, f'trades_backup_{timestamp}.json')
            shutil.copy2(DATA_FILE, backup_file)
            
            # Keep only the last 30 backups to avoid filling up disk
            backups = sorted([os.path.join(backup_dir, f) for f in os.listdir(backup_dir) if f.startswith('trades_backup_')])
            if len(backups) > 30:
                for b in backups[:-30]:
                    os.remove(b)
        except Exception as e:
            print(f"Auto backup failed: {e}")


def _format_float(value, digits=6):
    """Convert numeric values to clean JSON-friendly floats/ints."""
    v = float(value)
    return int(v) if v.is_integer() else round(v, digits)


def _dt_to_str(dt_value):
    return dt_value.strftime('%Y-%m-%d %H:%M:%S')


def _date_to_str(dt_value):
    return dt_value.strftime('%Y-%m-%d')


def _time_to_str(dt_value):
    return dt_value.strftime('%H:%M:%S')


def consolidate_raw_fills(raw_df):
    """
    Consolidate split order fills into completed trades.

    Rules implemented:
    - Group by Instrument
    - Sort by Fill time ascending
    - Detect entry side from first fill in cycle (SELL short / BUY long)
    - Use quantity matching to close only completed cycles
    - Entry avg / Exit avg use weighted average by quantity
    """
    required = ['Trade ID', 'Fill time', 'Type', 'Instrument', 'Product', 'Qty.', 'Avg. Price']
    missing = [c for c in required if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df = raw_df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    df['Type'] = df['Type'].astype(str).str.strip().str.upper()
    df = df[df['Type'].isin(['BUY', 'SELL'])].copy()
    df['Qty.'] = pd.to_numeric(df['Qty.'], errors='coerce')
    df['Avg. Price'] = pd.to_numeric(df['Avg. Price'], errors='coerce')
    df['Fill time'] = pd.to_datetime(df['Fill time'], errors='coerce')
    df['Instrument'] = df['Instrument'].astype(str).str.strip()
    df = df.dropna(subset=['Fill time', 'Qty.', 'Avg. Price', 'Instrument'])
    df = df[df['Qty.'] > 0].copy()

    sort_cols = ['Instrument', 'Fill time']
    if 'Trade ID' in df.columns:
        sort_cols.append('Trade ID')
    df = df.sort_values(sort_cols, ascending=True)

    consolidated_rows = []

    for instrument, g in df.groupby('Instrument', sort=True):
        cycle = None

        for _, row in g.iterrows():
            side = row['Type']
            price = float(row['Avg. Price'])
            fill_time = row['Fill time']
            remaining_qty = float(row['Qty.'])

            _exit_fill_counted = False
            while remaining_qty > 1e-12:
                if cycle is None:
                    cycle = {
                        'instrument': instrument,
                        'entry_side': side,
                        'entry_qty': remaining_qty,
                        'entry_notional': remaining_qty * price,
                        'entry_time': fill_time,
                        'fill_count': 1,
                        'exit_qty': 0.0,
                        'exit_notional': 0.0,
                        'exit_time': None
                    }
                    remaining_qty = 0.0
                    continue

                # Same side as entry -> scale into entry leg
                if side == cycle['entry_side']:
                    cycle['fill_count'] += 1
                    cycle['entry_qty'] += remaining_qty
                    cycle['entry_notional'] += remaining_qty * price
                    remaining_qty = 0.0
                    continue

                # Opposite side -> close existing position
                if not _exit_fill_counted:
                    cycle['fill_count'] += 1
                    _exit_fill_counted = True
                open_qty = cycle['entry_qty'] - cycle['exit_qty']
                close_qty = min(open_qty, remaining_qty)
                cycle['exit_qty'] += close_qty
                cycle['exit_notional'] += close_qty * price
                cycle['exit_time'] = fill_time
                remaining_qty -= close_qty

                # Completed cycle only when fully quantity-matched
                if abs(cycle['entry_qty'] - cycle['exit_qty']) <= 1e-9:
                    qty = cycle['entry_qty']
                    entry_avg = cycle['entry_notional'] / qty
                    exit_avg = cycle['exit_notional'] / qty

                    if cycle['entry_side'] == 'SELL':
                        sell_time = cycle['entry_time']
                        sell_price = entry_avg
                        buy_time = cycle['exit_time']
                        buy_price = exit_avg
                    else:
                        buy_time = cycle['entry_time']
                        buy_price = entry_avg
                        sell_time = cycle['exit_time']
                        sell_price = exit_avg

                    pt = sell_price - buy_price
                    rs = pt * qty

                    consolidated_rows.append({
                        'Instrument': cycle['instrument'],
                        'TradeType': cycle['entry_side'],
                        'Date': _date_to_str(sell_time),
                        'Qty': _format_float(qty, 6),
                        'Sell Time': _time_to_str(sell_time),
                        'Sell Price': _format_float(sell_price, 6),
                        'Buy Time': _time_to_str(buy_time),
                        'Buy Price': _format_float(buy_price, 6),
                        'Pt': _format_float(pt, 6),
                        'Rs': _format_float(rs, 6),
                        'fill_count': cycle['fill_count']
                    })
                    cycle = None

    result = pd.DataFrame(consolidated_rows, columns=STRUCTURED_COLUMNS)
    if consolidated_rows:
        result['fill_count'] = [r.get('fill_count', 2) for r in consolidated_rows]
    if not result.empty:
        result['_sell_dt'] = pd.to_datetime(
            result['Date'].astype(str) + ' ' + result['Sell Time'].astype(str),
            errors='coerce'
        )
        result = result.sort_values('_sell_dt').drop(columns=['_sell_dt'])
    return result


def consolidate_zerodha_historical_csv(raw_df):
    """
    Consolidate raw Zerodha historical order fills into completed trade cycles.

    Expected input columns:
      symbol, trade_type, quantity, price, order_execution_time, trade_date, ...

    Output columns (exact order):
      Instrument, TradeType, Qty, Sell Time, Sell Price (Avg), Buy Time,
      Buy Price (Avg), Pt, Rs, trade_date
    """
    required = [
        'symbol', 'trade_type', 'quantity', 'price',
        'order_execution_time', 'trade_date'
    ]
    missing = [c for c in required if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df = raw_df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    df['symbol'] = df['symbol'].astype(str).str.strip()
    df['trade_type'] = df['trade_type'].astype(str).str.strip().str.lower()
    df = df[df['trade_type'].isin(['buy', 'sell'])].copy()
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    df['order_execution_time'] = pd.to_datetime(df['order_execution_time'], errors='coerce')
    df['trade_date'] = pd.to_datetime(df['trade_date'], errors='coerce').dt.strftime('%Y-%m-%d')
    df = df.dropna(subset=['symbol', 'trade_type', 'quantity', 'price', 'order_execution_time'])
    df = df[df['quantity'] > 0].copy()

    # Sort as requested: symbol, then execution time ascending
    sort_cols = ['symbol', 'order_execution_time']
    if 'trade_id' in df.columns:
        sort_cols.append('trade_id')
    if 'order_id' in df.columns:
        sort_cols.append('order_id')
    df = df.sort_values(sort_cols, ascending=True)

    consolidated_rows = []

    for symbol, g in df.groupby('symbol', sort=True):
        cycle = None

        for _, row in g.iterrows():
            side = row['trade_type']            # buy/sell
            qty_left = float(row['quantity'])
            price = float(row['price'])
            exec_time = row['order_execution_time']
            row_trade_date = row.get('trade_date', '')

            _exit_fill_counted = False
            while qty_left > 1e-12:
                # Start new cycle with current fill
                if cycle is None:
                    cycle = {
                        'symbol': symbol,
                        'entry_side': side,
                        'entry_qty': qty_left,
                        'entry_notional': qty_left * price,
                        'entry_time_first': exec_time,
                        'entry_trade_date': row_trade_date if isinstance(row_trade_date, str) else exec_time.strftime('%Y-%m-%d'),
                        'fill_count': 1,
                        'exit_qty': 0.0,
                        'exit_notional': 0.0,
                        'exit_time_last': None
                    }
                    qty_left = 0.0
                    continue

                # Same side as entry => scale into entry leg
                if side == cycle['entry_side']:
                    cycle['fill_count'] += 1
                    cycle['entry_qty'] += qty_left
                    cycle['entry_notional'] += qty_left * price
                    qty_left = 0.0
                    continue

                # Opposite side => close open quantity
                if not _exit_fill_counted:
                    cycle['fill_count'] += 1
                    _exit_fill_counted = True
                open_qty = cycle['entry_qty'] - cycle['exit_qty']
                close_qty = min(open_qty, qty_left)
                cycle['exit_qty'] += close_qty
                cycle['exit_notional'] += close_qty * price
                cycle['exit_time_last'] = exec_time
                qty_left -= close_qty

                # Close cycle only when fully matched
                if abs(cycle['entry_qty'] - cycle['exit_qty']) <= 1e-9:
                    qty = cycle['entry_qty']
                    entry_avg = cycle['entry_notional'] / qty
                    exit_avg = cycle['exit_notional'] / qty

                    # Map entry/exit legs to sell-buy columns
                    if cycle['entry_side'] == 'sell':  # short
                        sell_time = cycle['entry_time_first']
                        sell_price = entry_avg
                        buy_time = cycle['exit_time_last']
                        buy_price = exit_avg
                        pt = sell_price - buy_price
                    else:                              # long
                        buy_time = cycle['entry_time_first']
                        buy_price = entry_avg
                        sell_time = cycle['exit_time_last']
                        sell_price = exit_avg
                        # As requested in prompt
                        pt = buy_price - sell_price

                    rs = pt * qty

                    consolidated_rows.append({
                        'Instrument': cycle['symbol'],
                        'TradeType': cycle['entry_side'],
                        'Qty': _format_float(qty, 6),
                        'Sell Time': _time_to_str(sell_time),            # HH:MM:SS only
                        'Sell Price (Avg)': _format_float(sell_price, 6),
                        'Buy Time': _time_to_str(buy_time),              # HH:MM:SS only
                        'Buy Price (Avg)': _format_float(buy_price, 6),
                        'Pt': _format_float(pt, 6),
                        'Rs': _format_float(rs, 6),
                        'trade_date': cycle['entry_trade_date'],
                        'fill_count': cycle['fill_count']
                    })
                    cycle = None

    out = pd.DataFrame(consolidated_rows, columns=HISTORICAL_STRUCTURED_COLUMNS)
    if consolidated_rows:
        out['fill_count'] = [r.get('fill_count', 2) for r in consolidated_rows]
    if not out.empty:
        out['_sell_time_sort'] = pd.to_datetime(out['Sell Time'], format='%H:%M:%S', errors='coerce')
        out = out.sort_values('_sell_time_sort', ascending=True).drop(columns=['_sell_time_sort'])
    return out


def consolidate_dhan_csv(raw_df):
    """
    Consolidate Dhan executed order-level CSV into completed position-level trades.

    Expected columns:
      Date, Time, Name, Buy/Sell, Quantity/Lot, Trade Price, Status, ...

    Output columns (exact order):
      Instrument, TradeType, Qty, Sell Time, Sell Price (Avg), Buy Time,
      Buy Price (Avg), Pt, Rs, trade_date
    """
    required = [
        'Date', 'Time', 'Name', 'Buy/Sell', 'Quantity/Lot', 'Trade Price'
    ]
    missing = [c for c in required if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df = raw_df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    # Keep only executed rows when Status exists
    if 'Status' in df.columns:
        status = df['Status'].astype(str).str.strip().str.lower()
        executed_mask = status.str.contains('execut', na=False)
        # If no explicit executed rows found, keep all to avoid dropping valid exports
        if executed_mask.any():
            df = df[executed_mask].copy()

    df['Name'] = df['Name'].astype(str).str.strip()
    df['Buy/Sell'] = df['Buy/Sell'].astype(str).str.strip().str.lower()
    df = df[df['Buy/Sell'].isin(['buy', 'sell'])].copy()

    df['Quantity/Lot'] = pd.to_numeric(df['Quantity/Lot'], errors='coerce')
    df['Trade Price'] = pd.to_numeric(df['Trade Price'], errors='coerce')
    dt_str = df['Date'].astype(str).str.strip() + ' ' + df['Time'].astype(str).str.strip()
    df['_dt'] = pd.to_datetime(dt_str, errors='coerce', dayfirst=True)
    df['_date_only'] = pd.to_datetime(df['Date'], errors='coerce', dayfirst=True).dt.strftime('%Y-%m-%d')

    df = df.dropna(subset=['Name', 'Buy/Sell', 'Quantity/Lot', 'Trade Price', '_dt'])
    df = df[df['Quantity/Lot'] > 0].copy()

    # Required sort: Name + datetime ascending
    df = df.sort_values(['Name', '_dt'], ascending=True)

    consolidated_rows = []

    for name, g in df.groupby('Name', sort=True):
        cycle = None

        for _, row in g.iterrows():
            side = row['Buy/Sell']       # buy/sell
            qty_left = float(row['Quantity/Lot'])
            price = float(row['Trade Price'])
            exec_time = row['_dt']
            trade_date = row['_date_only'] if isinstance(row['_date_only'], str) else exec_time.strftime('%Y-%m-%d')

            _exit_fill_counted = False  # count each row's exit contribution once
            while qty_left > 1e-12:
                if cycle is None:
                    cycle = {
                        'instrument': name,
                        'entry_side': side,
                        'entry_qty': qty_left,
                        'entry_notional': qty_left * price,
                        'entry_time_first': exec_time,
                        'entry_trade_date': trade_date,
                        'fill_count': 1,
                        'exit_qty': 0.0,
                        'exit_notional': 0.0,
                        'exit_time_last': None
                    }
                    qty_left = 0.0
                    continue

                # Same side as entry => scale-in entry
                if side == cycle['entry_side']:
                    cycle['fill_count'] += 1
                    cycle['entry_qty'] += qty_left
                    cycle['entry_notional'] += qty_left * price
                    qty_left = 0.0
                    continue

                # Opposite side => close open qty (count this row once as an exit fill)
                if not _exit_fill_counted:
                    cycle['fill_count'] += 1
                    _exit_fill_counted = True
                open_qty = cycle['entry_qty'] - cycle['exit_qty']
                close_qty = min(open_qty, qty_left)
                cycle['exit_qty'] += close_qty
                cycle['exit_notional'] += close_qty * price
                cycle['exit_time_last'] = exec_time
                qty_left -= close_qty

                if abs(cycle['entry_qty'] - cycle['exit_qty']) <= 1e-9:
                    qty = cycle['entry_qty']
                    entry_avg = cycle['entry_notional'] / qty
                    exit_avg = cycle['exit_notional'] / qty

                    if cycle['entry_side'] == 'buy':   # long
                        buy_time = cycle['entry_time_first']
                        buy_price = entry_avg
                        sell_time = cycle['exit_time_last']
                        sell_price = exit_avg
                    else:                               # short
                        sell_time = cycle['entry_time_first']
                        sell_price = entry_avg
                        buy_time = cycle['exit_time_last']
                        buy_price = exit_avg

                    # As requested, both long/short Pt = Sell - Buy
                    pt = sell_price - buy_price
                    rs = pt * qty

                    consolidated_rows.append({
                        'Instrument': cycle['instrument'],
                        'TradeType': cycle['entry_side'],
                        'Qty': _format_float(qty, 6),
                        'Sell Time': _time_to_str(sell_time),
                        'Sell Price (Avg)': _format_float(sell_price, 6),
                        'Buy Time': _time_to_str(buy_time),
                        'Buy Price (Avg)': _format_float(buy_price, 6),
                        'Pt': _format_float(pt, 6),
                        'Rs': _format_float(rs, 6),
                        'trade_date': cycle['entry_trade_date'],
                        'fill_count': cycle['fill_count']
                    })
                    cycle = None

    out = pd.DataFrame(consolidated_rows, columns=HISTORICAL_STRUCTURED_COLUMNS)
    if consolidated_rows:
        out['fill_count'] = [r.get('fill_count', 2) for r in consolidated_rows]
    if not out.empty:
        out['_sell_time_sort'] = pd.to_datetime(out['Sell Time'], format='%H:%M:%S', errors='coerce')
        out = out.sort_values('_sell_time_sort', ascending=True).drop(columns=['_sell_time_sort'])
    return out


```

## File: `requirements.txt`
```txt
Flask>=3.0.0
pandas>=2.0.0
openpyxl>=3.1.0
gunicorn>=21.2.0

```

## File: `Dockerfile`
```
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT:-10000} --workers 2 --threads 4 --timeout 120"]

```

## File: `Procfile`
```
web: gunicorn app:app --workers 2 --threads 4 --timeout 120

```

## File: `render.yaml`
```yaml
services:
  - type: web
    name: code2-calender
    env: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --workers 2 --threads 4 --timeout 120
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.9"

```
