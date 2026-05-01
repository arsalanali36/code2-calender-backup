"""
routes/ohlc_routes.py
---------------------
HTTP endpoints for the unified OHLC service.

GET  /api/ohlc/status              -> scheduler status + last run info
POST /api/ohlc/trigger             -> kick off immediate download cycle
GET  /api/ohlc/data/<symbol>/<date> -> load cached OHLC CSV as JSON
GET  /api/ohlc/watchlist           -> get watchlist
POST /api/ohlc/watchlist           -> save watchlist
"""
from flask import Blueprint, jsonify, request
import services.ohlc_service as ohlc
from services.ohlc_scheduler import get_status, trigger_now

ohlc_bp = Blueprint('ohlc', __name__)


@ohlc_bp.get('/api/ohlc/status')
def ohlc_status():
    return jsonify(get_status())


@ohlc_bp.post('/api/ohlc/trigger')
def ohlc_trigger():
    trigger_now()
    return jsonify({'ok': True, 'message': 'Download cycle triggered'})


@ohlc_bp.get('/api/ohlc/data/<symbol>/<date>')
def ohlc_data(symbol, date):
    timeframe = int(request.args.get('tf', 1))
    df = ohlc.load(symbol.upper(), date)
    if df is None or df.empty:
        return jsonify({'error': 'No data', 'symbol': symbol, 'date': date}), 404
    if timeframe > 1:
        df = ohlc.resample(df, timeframe)
    return jsonify({
        'symbol': symbol.upper(),
        'date':   date,
        'tf':     timeframe,
        'status': ohlc.get_status(symbol, date),
        'candles': df.to_dict(orient='records'),
    })


@ohlc_bp.get('/api/ohlc/watchlist')
def ohlc_get_watchlist():
    return jsonify(ohlc.load_watchlist())


@ohlc_bp.post('/api/ohlc/watchlist')
def ohlc_save_watchlist():
    body = request.get_json(silent=True) or {}
    symbols = body.get('symbols', [])
    if not isinstance(symbols, list):
        return jsonify({'error': 'symbols must be a list'}), 400
    ohlc.save_watchlist(symbols)
    return jsonify({'ok': True, 'saved': sorted({s.strip().upper() for s in symbols if s.strip()})})
