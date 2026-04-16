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
