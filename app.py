from flask import Flask, request, jsonify, render_template, send_file, send_from_directory
import pandas as pd
import json
import os
import io
import uuid
from datetime import datetime
import re
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.getenv('DATA_FILE', os.path.join(BASE_DIR, 'data', 'trades.json'))
UPLOADS_DIR = os.getenv('UPLOADS_DIR', os.path.join(BASE_DIR, 'static', 'uploads'))

os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

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


def save_trades_to_file(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


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
    try:
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


@app.route('/api/backup', methods=['GET'])
def backup():
    if os.path.exists(DATA_FILE):
        requested_name = str(request.args.get('name', '')).strip()
        safe_name = re.sub(r'[^A-Za-z0-9_\- ]+', '', requested_name).strip()
        if safe_name:
            filename = safe_name if safe_name.lower().endswith('.json') else f'{safe_name}.json'
        else:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'trading_journal_{timestamp}.json'
        return send_file(
            DATA_FILE,
            as_attachment=True,
            download_name=filename,
            mimetype='application/json'
        )
    return jsonify({'error': 'No data to backup'}), 404


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
