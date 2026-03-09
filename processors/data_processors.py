import pandas as pd
import json
import os
import time
import shutil
from datetime import datetime
from urllib.parse import urlparse, unquote

# File lives at processors/data_processors.py → go up one level to reach project root
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.getenv('DATA_FILE', os.path.join(BASE_DIR, 'data', 'trades.json'))
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
            return _normalize_trade_payload(json.load(f))
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
    data = _normalize_trade_payload(data)
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    current_time = time.time()
    if current_time - LAST_BACKUP_TIME > 300:  # Backup every 5 minutes if there are changes
        LAST_BACKUP_TIME = current_time
        try:
            backup_dir = os.path.join(os.path.dirname(DATA_FILE), 'backups')
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


def _normalize_upload_url(value):
    if not isinstance(value, str):
        return value
    raw = value.strip()
    if not raw:
        return raw

    # Normalize Windows-style separators first.
    raw = raw.replace('\\', '/')
    parsed = urlparse(raw)
    path = parsed.path.replace('\\', '/')
    if not path:
        path = raw

    lowered = path.lower()
    if '/uploads/' in lowered:
        path = path[lowered.rfind('/uploads/'):]
    elif lowered.startswith('uploads/'):
        path = '/' + path
    else:
        return value

    filename = os.path.basename(unquote(path))
    if not filename:
        return value
    return f'/uploads/{filename}'


def _normalize_trade_payload(data):
    if not isinstance(data, dict):
        return data

    def _norm_image_list(items):
        if not isinstance(items, list):
            return []
        out = []
        for it in items:
            if isinstance(it, str):
                out.append(_normalize_upload_url(it))
            else:
                out.append(it)
        return out

    def _norm_url_keyed_dict(d, value_mode='raw'):
        if not isinstance(d, dict):
            return {}
        out = {}
        for k, v in d.items():
            nk = _normalize_upload_url(k) if isinstance(k, str) else k
            if value_mode == 'url':
                nv = _normalize_upload_url(v) if isinstance(v, str) else v
            elif value_mode == 'url_list':
                nv = _norm_image_list(v)
            else:
                nv = v
            out[nk] = nv
        return out

    trades = data.get('trades', [])
    if isinstance(trades, list):
        for t in trades:
            if not isinstance(t, dict):
                continue
            if 'images' in t:
                t['images'] = _norm_image_list(t.get('images', []))
            if isinstance(t.get('heroImage'), str):
                t['heroImage'] = _normalize_upload_url(t['heroImage'])
            if isinstance(t.get('thumbnail'), str):
                t['thumbnail'] = _normalize_upload_url(t['thumbnail'])
            if 'imageTags' in t:
                t['imageTags'] = _norm_url_keyed_dict(t.get('imageTags', {}), 'raw')
            if '_overlayMap' in t:
                t['_overlayMap'] = _norm_url_keyed_dict(t.get('_overlayMap', {}), 'url')
            if 'subImages' in t:
                t['subImages'] = _norm_url_keyed_dict(t.get('subImages', {}), 'url_list')

    day_data = data.get('dayData', {})
    if isinstance(day_data, dict):
        for d in day_data.values():
            if not isinstance(d, dict):
                continue
            if 'images' in d:
                d['images'] = _norm_image_list(d.get('images', []))
            if 'closeImages' in d:
                d['closeImages'] = _norm_image_list(d.get('closeImages', []))
            if 'imageTags' in d:
                d['imageTags'] = _norm_url_keyed_dict(d.get('imageTags', {}), 'raw')

    return data


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
