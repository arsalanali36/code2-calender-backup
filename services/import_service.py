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
    Restore from a .json or .zip backup file.
    Returns {'success': True, 'trades': [...], 'columns': [...]}.
    Raises ValueError on invalid file.
    """
    filename = (file_storage.filename or '').lower()

    if filename.endswith('.zip'):
        file_bytes = file_storage.read()
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            with zf.open('trades.json') as jf:
                data = json.load(jf)
            if 'trades' not in data:
                raise ValueError('Invalid backup file')
            save_trades_to_file(data, user_id)
            os.makedirs(uploads_dir, exist_ok=True)
            for name in zf.namelist():
                if name.startswith('uploads/') and not name.endswith('/'):
                    img_fname = os.path.basename(name)
                    if img_fname:
                        img_path = os.path.join(uploads_dir, img_fname)
                        with zf.open(name) as src:
                            with open(img_path, 'wb') as dst:
                                dst.write(src.read())
    else:
        data = json.load(file_storage)
        if 'trades' not in data:
            raise ValueError('Invalid backup file')
        save_trades_to_file(data, user_id)

    return {
        'success': True,
        'trades': data.get('trades', []),
        'columns': data.get('columns', []),
    }
