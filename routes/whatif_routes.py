"""
routes/whatif_routes.py
-----------------------
What-If analysis page.

GET  /whatif                      → render UI
GET  /api/whatif/config           → get Dhan credentials (token masked)
POST /api/whatif/config           → save Dhan credentials
POST /api/whatif/scrip/download   → download Dhan scrip master CSV
GET  /api/whatif/scrip/search     → search scrip master ?q=...
GET  /api/whatif/symbol-map       → symbol → securityId mapping
POST /api/whatif/symbol-map       → save one mapping entry
DELETE /api/whatif/symbol-map     → remove one mapping entry
GET  /api/whatif/ohlc-status      → cache status per (symbol, date) in user trades
POST /api/whatif/fetch-ohlc       → fetch/complete OHLC for given [{symbol,date}]
POST /api/whatif/run              → run simulation, return results + summary
"""
import json
import math
import time
from flask import Blueprint, render_template, request, jsonify, Response, stream_with_context
from flask_login import login_required

from config import CACHE_BUST
from services import dhan_service, whatif_service
from processors.data_processors import get_user_data_file

whatif_bp = Blueprint('whatif', __name__)


def _net_pnl(buy_price, sell_price, qty, broker='', fill_count=2):
    """Mirror of JS computeTradeCharges — returns (gross, charges, net)."""
    if not buy_price or not sell_price or not qty:
        return None, None, None
    buy_price  = float(buy_price)
    sell_price = float(sell_price)
    qty        = float(qty)
    fill_count = max(int(fill_count or 0), 2)
    broker     = str(broker).lower().strip()

    buy_turn  = buy_price  * qty
    sell_turn = sell_price * qty
    total     = buy_turn + sell_turn

    stt   = sell_turn * 0.001
    exch  = total * 0.0003503
    sebi  = total * 0.000001
    stamp = buy_turn * 0.00003

    brokerage = fill_count * 20
    if broker == 'dhan':
        ipft          = total * 0.000001
        gst           = (brokerage + exch + sebi + ipft) * 0.18
        other_charges = stt + exch + sebi + ipft + stamp + gst
    else:
        gst           = (brokerage + exch + sebi) * 0.18
        other_charges = stt + exch + sebi + stamp + gst

    gross = round((sell_price - buy_price) * qty, 2)
    net   = round(gross - (brokerage + other_charges), 2)
    fees  = round(brokerage + other_charges, 2)
    return gross, fees, net


# ── Page ─────────────────────────────────────────────────────────────────────

@whatif_bp.route('/whatif')
@login_required
def whatif_page():
    return render_template('whatif.html', cache_bust=CACHE_BUST)


# ── Dhan Config ───────────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/config', methods=['GET'])
@login_required
def get_dhan_config():
    from datetime import datetime as _dt
    cfg = dhan_service.get_config()
    if not cfg:
        return jsonify({'configured': False})
    token  = cfg.get('access_token', '')
    masked = (token[:6] + '••••' + token[-4:]) if len(token) > 10 else '••••'
    hours_ago = None
    saved_at  = cfg.get('saved_at', '')
    if saved_at:
        try:
            diff = _dt.now() - _dt.strptime(saved_at, '%Y-%m-%d %H:%M:%S')
            hours_ago = round(diff.total_seconds() / 3600, 1)
        except Exception:
            pass
    return jsonify({
        'configured':          True,
        'client_id':           cfg.get('client_id', ''),
        'access_token_masked': masked,
        'hours_ago':           hours_ago,
        'saved_at':            saved_at,
    })


@whatif_bp.route('/api/whatif/config', methods=['POST'])
@login_required
def save_dhan_config():
    body         = request.json or {}
    client_id    = body.get('client_id', '').strip()
    access_token = body.get('access_token', '').strip()
    if not client_id or not access_token:
        return jsonify({'error': 'client_id and access_token are required'}), 400
    dhan_service.save_config(client_id, access_token)
    return jsonify({'ok': True})


# ── Scrip Master ──────────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/scrip/download', methods=['POST'])
@login_required
def download_scrip():
    try:
        dhan_service.download_scrip_master()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@whatif_bp.route('/api/whatif/scrip/search')
@login_required
def scrip_search():
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify({'results': []})
    try:
        results = dhan_service.search_scrip(q, limit=30)
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Symbol Map ────────────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/symbol-map', methods=['GET'])
@login_required
def get_symbol_map():
    return jsonify(dhan_service.load_symbol_map())


@whatif_bp.route('/api/whatif/auto-map', methods=['POST'])
@login_required
def auto_map():
    """
    Auto-map all unmapped instruments from user's trades.
    Downloads scrip master if needed, runs matching, saves high-confidence hits.
    Body (optional): { symbols: [...] }  — if omitted, uses all trade instruments.
    """
    body       = request.json or {}
    symbols_in = body.get('symbols', [])
    date_from  = body.get('date_from', '')
    date_to    = body.get('date_to',   '')

    # If not provided, collect from trades with earliest trade_date per symbol
    if not symbols_in:
        data_file = get_user_data_file()
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        trades = data.get('trades', [])

        # Apply date range filter if given
        if date_from:
            trades = [t for t in trades if t.get('date', t.get('trade_date', '')) >= date_from]
        if date_to:
            trades = [t for t in trades if t.get('date', t.get('trade_date', '')) <= date_to]

        # Build { symbol: earliest_trade_date } — date helps determine expiry year
        sym_date_map = {}
        for t in trades:
            sym  = t.get('Instrument', '')
            date = t.get('date', t.get('trade_date', ''))
            if not sym:
                continue
            if sym not in sym_date_map or date < sym_date_map[sym]:
                sym_date_map[sym] = date
        symbols_in = sym_date_map  # pass the dict directly

    if not symbols_in:
        return jsonify({'results': {}, 'saved': 0})

    # Normalise: list → dict with None dates
    if isinstance(symbols_in, list):
        symbols_in = {s: None for s in symbols_in}

    try:
        results = dhan_service.auto_map_instruments(symbols_in)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # Enrich each result with the trade date used for matching
    for sym, res in results.items():
        if isinstance(symbols_in, dict):
            res['trade_date'] = symbols_in.get(sym, '')

    # Auto-save entries with confidence >= 70
    # Also remove any previously saved entry for expired options (wrong security_id)
    mapping = dhan_service.load_symbol_map()
    saved   = 0
    for sym, res in results.items():
        if res.get('expired_opt'):
            mapping.pop(sym, None)   # clear wrong mapping if saved before
            continue
        if res.get('confidence', 0) >= 70 and res.get('security_id'):
            mapping[sym] = {
                'security_id':      res['security_id'],
                'exchange_segment': res['exchange_segment'],
                'instrument':       res['instrument'],
            }
            saved += 1
    dhan_service.save_symbol_map(mapping)

    return jsonify({'results': results, 'saved': saved})


@whatif_bp.route('/api/whatif/symbol-map', methods=['POST'])
@login_required
def save_symbol_map():
    body       = request.json or {}
    symbol     = body.get('symbol', '').strip()
    sec_id     = body.get('security_id', '').strip()
    segment    = body.get('exchange_segment', 'NSE_FNO').strip()
    instrument = body.get('instrument', 'OPTIDX').strip()
    if not symbol or not sec_id:
        return jsonify({'error': 'symbol and security_id are required'}), 400
    mapping = dhan_service.load_symbol_map()
    mapping[symbol] = {
        'security_id':      sec_id,
        'exchange_segment': segment,
        'instrument':       instrument,
    }
    dhan_service.save_symbol_map(mapping)
    return jsonify({'ok': True})


@whatif_bp.route('/api/whatif/symbol-map', methods=['DELETE'])
@login_required
def delete_symbol_map():
    symbol  = (request.json or {}).get('symbol', '').strip()
    mapping = dhan_service.load_symbol_map()
    mapping.pop(symbol, None)
    dhan_service.save_symbol_map(mapping)
    return jsonify({'ok': True})


# ── OHLC Status ───────────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/ohlc-status')
@login_required
def ohlc_status():
    date_from = request.args.get('date_from', '')
    date_to   = request.args.get('date_to',   '')

    data_file  = get_user_data_file()
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    trades     = data.get('trades', [])

    if date_from:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) >= date_from]
    if date_to:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) <= date_to]
    symbol_map = dhan_service.load_symbol_map()

    seen   = set()
    result = []
    for t in trades:
        sym  = t.get('Instrument', '')
        date = t.get('date', t.get('trade_date', ''))
        key  = (sym, date)
        if not sym or not date or key in seen:
            continue
        seen.add(key)
        # Get entry time from trade data (used for precise ATM calculation)
        entry_time = ''
        for t in trades:
            if t.get('Instrument') == sym and t.get('date', t.get('trade_date', '')) == date:
                tt = t.get('TradeType', 'sell').lower()
                entry_time = str(t.get('Sell Time' if tt == 'sell' else 'Buy Time', '') or '')[:8]
                break

        # Priority: security_id (historical) > rollingoption (fallback)
        parsed = dhan_service._parse_nse_symbol(sym, date)
        is_option = bool(parsed and parsed.get('instrument') in ('OPTIDX', 'OPTSTK'))
        if sym in symbol_map:
            info   = symbol_map[sym]
            status = dhan_service.get_ohlc_status(info['security_id'], date)
            result.append({'symbol': sym, 'date': date, 'entry_time': entry_time, **status})
        elif is_option:
            status = dhan_service.get_expired_option_ohlc_status(sym, date)
            result.append({'symbol': sym, 'date': date, 'type': 'expired_opt', 'entry_time': entry_time, **status})
        else:
            result.append({'symbol': sym, 'date': date, 'status': 'not_mapped'})

    return jsonify(result)


# ── Fetch OHLC ────────────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/fetch-ohlc', methods=['POST'])
@login_required
def fetch_ohlc():
    """Body: { items: [{symbol, date}] }"""
    items      = (request.json or {}).get('items', [])
    symbol_map = dhan_service.load_symbol_map()

    results = []
    for item in items:
        sym  = item.get('symbol', '')
        date = item.get('date', '')
        parsed    = dhan_service._parse_nse_symbol(sym, date)
        is_option = bool(parsed and parsed.get('instrument') in ('OPTIDX', 'OPTSTK'))

        # Priority: security_id (accurate) > rollingoption (expired-only fallback)
        # If symbol not in map, try to resolve it from scrip master first.
        if sym not in symbol_map and is_option:
            try:
                mapped = dhan_service.auto_map_instruments({sym: date})
                info   = mapped.get(sym, {})
                print(f"[DEBUG fetch-ohlc] auto_map {sym} → {info}")
                if info.get('security_id'):
                    symbol_map[sym] = {
                        'security_id':      info['security_id'],
                        'exchange_segment': info['exchange_segment'],
                        'instrument':       info['instrument'],
                    }
            except Exception as ex:
                print(f"[DEBUG fetch-ohlc] auto_map error: {ex}")

        if sym in symbol_map:
            info = symbol_map[sym]
            expiry_date = None
            if is_option and parsed:
                try:
                    expiry_date = f"{parsed['year']}-{parsed['month_num']}-{parsed['day'].zfill(2)}"
                except Exception:
                    pass
            try:
                df = dhan_service.fetch_and_cache_ohlc(
                    info['security_id'], info['exchange_segment'], info['instrument'], date, expiry_date)
                candles = len(df) if (df is not None and not df.empty) else 0
                results.append({'symbol': sym, 'date': date, 'candles': candles, 'ok': True})
            except Exception as e:
                results.append({'symbol': sym, 'date': date, 'error': str(e)})
        elif is_option or item.get('type') == 'expired_opt':
            # Truly expired — not in scrip master, use rollingoption approximation
            try:
                df = dhan_service.fetch_expired_option_ohlc(sym, date, item.get('entry_time', ''))
                candles = len(df) if (df is not None and not df.empty) else 0
                if candles == 0:
                    results.append({'symbol': sym, 'date': date, 'error': 'No candles — check ATM or expiry'})
                else:
                    results.append({'symbol': sym, 'date': date, 'candles': candles, 'ok': True})
            except Exception as e:
                results.append({'symbol': sym, 'date': date, 'error': str(e)})
        else:
            results.append({'symbol': sym, 'date': date, 'error': 'not mapped'})

    return jsonify({'results': results})


# ── OHLC Chart Data ───────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/ohlc-data')
@login_required
def ohlc_data():
    symbol = request.args.get('symbol', '').strip()
    date   = request.args.get('date',   '').strip()
    if not symbol or not date:
        return jsonify({'error': 'symbol and date required'}), 400

    parsed    = dhan_service._parse_nse_symbol(symbol, date)
    is_option = bool(parsed and parsed.get('instrument') in ('OPTIDX', 'OPTSTK'))

    # For options: expired-option cache (rollingoption path) takes priority.
    # The auto-map can return a stale/wrong security_id for expired contracts
    # (they're no longer in scrip master), which points to the wrong cache file.
    if is_option:
        df = dhan_service.load_cached_expired_option_ohlc(symbol, date)
        if df is None or df.empty:
            # Fallback: check if historical cache exists (active/recent option)
            symbol_map = dhan_service.load_symbol_map()
            if symbol in symbol_map:
                df = dhan_service.load_cached_ohlc(symbol_map[symbol]['security_id'], date)
    else:
        symbol_map = dhan_service.load_symbol_map()
        if symbol in symbol_map:
            df = dhan_service.load_cached_ohlc(symbol_map[symbol]['security_id'], date)
        else:
            return jsonify({'error': 'not_mapped'}), 404

    if df is None or df.empty:
        return jsonify({'error': 'no_data'}), 404

    cols = [c for c in ['datetime','time','open','high','low','close','volume'] if c in df.columns]
    records = df[cols].to_dict('records')
    return jsonify({'candles': records})


# ── Sync All OHLC (streaming SSE) ────────────────────────────────────────────

@whatif_bp.route('/api/whatif/sync-all-ohlc', methods=['GET'])
@login_required
def sync_all_ohlc():
    """
    Streams Server-Sent Events with progress for:
      1. Auto-mapping all unmapped instruments from user's trades
      2. Fetching OHLC for every (symbol, date) pair that is missing or incomplete
    Client reads: data: {"msg":"...", "ok":bool, "done":bool}\n\n
    """
    def _generate():
        def evt(msg, ok=True, done=False):
            return f"data: {json.dumps({'msg': msg, 'ok': ok, 'done': done})}\n\n"

        # ── Load trades ───────────────────────────────────────────
        try:
            data_file = get_user_data_file()
            with open(data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            trades = data.get('trades', [])
        except Exception as e:
            yield evt(f'Error loading trades: {e}', ok=False, done=True)
            return

        # Collect unique (symbol, date) pairs and earliest date per symbol
        sym_date_map = {}   # symbol → earliest trade date
        pairs = []          # list of {symbol, date, entry_time}
        seen_pairs = set()
        for t in trades:
            sym  = t.get('Instrument', '')
            date = t.get('date', t.get('trade_date', ''))
            if not sym or not date:
                continue
            # track earliest date per symbol for auto-mapping
            if sym not in sym_date_map or date < sym_date_map[sym]:
                sym_date_map[sym] = date
            key = (sym, date)
            if key not in seen_pairs:
                seen_pairs.add(key)
                tt = t.get('TradeType', 'sell').lower()
                entry_time = str(t.get('Sell Time' if tt == 'sell' else 'Buy Time', '') or '')[:8]
                pairs.append({'symbol': sym, 'date': date, 'entry_time': entry_time})

        total_symbols = len(sym_date_map)
        total_pairs   = len(pairs)
        yield evt(f'Found {total_symbols} instruments across {total_pairs} trade days.')

        if not pairs:
            yield evt('No trades with instruments found.', done=True)
            return

        # ── Phase 1: Auto-map all unmapped symbols ────────────────
        symbol_map = dhan_service.load_symbol_map()
        unmapped   = {sym: date for sym, date in sym_date_map.items() if sym not in symbol_map}

        if unmapped:
            yield evt(f'Phase 1/2 — Auto-mapping {len(unmapped)} unmapped instruments…')
            try:
                results = dhan_service.auto_map_instruments(unmapped)
                new_saved = 0
                for sym, res in results.items():
                    if res.get('expired_opt'):
                        symbol_map.pop(sym, None)
                        continue
                    if res.get('confidence', 0) >= 70 and res.get('security_id'):
                        symbol_map[sym] = {
                            'security_id':      res['security_id'],
                            'exchange_segment': res['exchange_segment'],
                            'instrument':       res['instrument'],
                        }
                        new_saved += 1
                dhan_service.save_symbol_map(symbol_map)
                yield evt(f'Mapped {new_saved}/{len(unmapped)} new instruments.')
            except Exception as e:
                yield evt(f'Auto-map error: {e}', ok=False)
        else:
            yield evt('Phase 1/2 — All instruments already mapped.')

        # ── Phase 2: Fetch missing OHLC ───────────────────────────
        yield evt(f'Phase 2/2 — Checking {total_pairs} (symbol, date) pairs…')

        # Identify which pairs are already complete
        to_fetch = []
        for p in pairs:
            sym  = p['symbol']
            date = p['date']
            parsed    = dhan_service._parse_nse_symbol(sym, date)
            is_option = bool(parsed and parsed.get('instrument') in ('OPTIDX', 'OPTSTK'))
            if sym in symbol_map:
                info   = symbol_map[sym]
                status = dhan_service.get_ohlc_status(info['security_id'], date)
                if status.get('status') != 'complete':
                    to_fetch.append({**p, 'type': 'mapped'})
            elif is_option:
                status = dhan_service.get_expired_option_ohlc_status(sym, date)
                if status.get('status') != 'complete':
                    to_fetch.append({**p, 'type': 'expired_opt'})
            # else: not mapped and not an option — skip

        if not to_fetch:
            yield evt('All OHLC data already complete! Nothing to fetch.', done=True)
            return

        yield evt(f'Fetching {len(to_fetch)} missing entries — this may take a while…')

        ok_count  = 0
        err_count = 0
        for i, item in enumerate(to_fetch, 1):
            sym  = item['symbol']
            date = item['date']
            try:
                parsed    = dhan_service._parse_nse_symbol(sym, date)
                is_option = bool(parsed and parsed.get('instrument') in ('OPTIDX', 'OPTSTK'))

                # Try auto-map once more if still missing (scrip master may have been downloaded)
                if sym not in symbol_map and is_option:
                    try:
                        mapped = dhan_service.auto_map_instruments({sym: date})
                        info   = mapped.get(sym, {})
                        if info.get('security_id'):
                            symbol_map[sym] = {
                                'security_id':      info['security_id'],
                                'exchange_segment': info['exchange_segment'],
                                'instrument':       info['instrument'],
                            }
                    except Exception:
                        pass

                # For options: all trades in the journal are past trades → always expired.
                # Skip the historical endpoint (always DH-905 for expired) and go directly
                # to rollingoption. Only use historical for non-option instruments (futures, equities).
                if is_option:
                    df = dhan_service.fetch_expired_option_ohlc(sym, date, item.get('entry_time', ''))
                    candles = len(df) if (df is not None and not df.empty) else 0
                    if candles == 0:
                        raise ValueError('0 candles returned')
                    ok_count += 1
                    yield evt(f'[{i}/{len(to_fetch)}] {sym} {date} — {candles} candles ✓')
                elif sym in symbol_map:
                    info = symbol_map[sym]
                    df = dhan_service.fetch_and_cache_ohlc(
                        info['security_id'], info['exchange_segment'], info['instrument'],
                        date, None)
                    candles = len(df) if (df is not None and not df.empty) else 0
                    if candles == 0:
                        raise ValueError('0 candles returned')
                    ok_count += 1
                    yield evt(f'[{i}/{len(to_fetch)}] {sym} {date} — {candles} candles ✓')
                else:
                    err_count += 1
                    yield evt(f'[{i}/{len(to_fetch)}] {sym} {date} — not mapped, skipped', ok=False)
            except Exception as e:
                err_count += 1
                yield evt(f'[{i}/{len(to_fetch)}] {sym} {date} — {e}', ok=False)

            # Small delay to avoid hammering the API
            time.sleep(0.15)

        summary = f'Done — {ok_count} fetched, {err_count} errors out of {len(to_fetch)} total.'
        yield evt(summary, done=True)

    return Response(
        stream_with_context(_generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control':     'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


# ── Import Tradebook CSV (Zerodha) for actual expiry dates ───────────────────

@whatif_bp.route('/api/whatif/import-tradebook', methods=['POST'])
@login_required
def import_tradebook():
    """
    Parse a Zerodha F&O tradebook CSV.
    Extracts:
      - symbol → actual expiry_date mapping  (saved to symbol_expiry_map.json)
      - list of (symbol, trade_date, expiry_date, entry_time) pairs  (saved as sync queue)
    Returns: {ok, imported, pairs} — UI then auto-starts SSE sync.
    """
    import io
    import csv as _csv
    from datetime import datetime as _dt

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Empty filename'}), 400

    try:
        content = f.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            f.seek(0)
            content = f.read().decode('latin-1')
        except Exception as e:
            return jsonify({'error': f'Cannot decode file: {e}'}), 400

    reader   = _csv.DictReader(io.StringIO(content))
    fields   = reader.fieldnames or []
    fl       = [h.strip().lower() for h in fields]

    def _col(*names):
        for n in names:
            for i, h in enumerate(fl):
                if h == n or h.replace(' ', '_') == n:
                    return fields[i]
        return None

    sym_col    = _col('tradingsymbol', 'symbol', 'trading_symbol')
    expiry_col = _col('expiry_date', 'expiry date', 'expiry')
    date_col   = _col('trade_date', 'order_execution_time', 'date')
    time_col   = _col('order_execution_time', 'trade_time', 'time')

    if not sym_col or not expiry_col:
        return jsonify({'error': f'Cannot find symbol/expiry columns. Got: {fields}'}), 400

    def _norm_date(s):
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%b-%Y', '%Y-%m-%d %H:%M:%S'):
            try:
                return _dt.strptime(s.strip(), fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
        return s.strip()[:10]   # fallback: take first 10 chars

    def _norm_time(s):
        # "2026-02-24 09:17:43" → "09:17"; "09:17:43" → "09:17"
        s = s.strip()
        if ' ' in s:
            s = s.split(' ', 1)[1]
        return s[:5]

    expiry_map = {}   # symbol → actual expiry YYYY-MM-DD
    pairs_seen = {}   # (symbol, trade_date) → {symbol, trade_date, expiry_date, entry_time}

    for row in reader:
        sym    = str(row.get(sym_col, '') or '').strip().upper()
        expiry = str(row.get(expiry_col, '') or '').strip()
        if not sym or not expiry or expiry.lower() in ('nan', 'none', '', '-'):
            continue
        if not (sym.endswith('CE') or sym.endswith('PE')):
            continue

        expiry = _norm_date(expiry)
        expiry_map[sym] = expiry

        if date_col:
            raw_date = str(row.get(date_col, '') or '').strip()
            trade_date = _norm_date(raw_date) if raw_date else ''
        else:
            trade_date = ''

        entry_time = ''
        if time_col:
            raw_time = str(row.get(time_col, '') or '').strip()
            if raw_time:
                entry_time = _norm_time(raw_time)

        if trade_date:
            key = (sym, trade_date)
            if key not in pairs_seen:
                pairs_seen[key] = {
                    'symbol':      sym,
                    'trade_date':  trade_date,
                    'expiry_date': expiry,
                    'entry_time':  entry_time,
                }

    if not expiry_map:
        return jsonify({'error': 'No option symbols with expiry dates found in file'}), 400

    # Save symbol → expiry map (used by fetch_expired_option_ohlc)
    existing = dhan_service.load_symbol_expiry_map()
    existing.update(expiry_map)
    dhan_service.save_symbol_expiry_map(existing)

    # Save sync queue (used by sync-tradebook-ohlc SSE)
    queue = list(pairs_seen.values())
    dhan_service.save_tradebook_queue(queue)

    return jsonify({'ok': True, 'imported': len(expiry_map), 'pairs': len(queue)})


@whatif_bp.route('/api/whatif/sync-tradebook-ohlc', methods=['GET'])
@login_required
def sync_tradebook_ohlc():
    """
    SSE stream: fetch OHLC for every (symbol, trade_date) pair saved in
    tradebook_sync_queue.json. Uses actual expiry_date from the queue so
    NSE-holiday-adjusted expiries are handled correctly.
    """
    def _generate():
        def evt(msg, ok=True, done=False):
            return f"data: {json.dumps({'msg': msg, 'ok': ok, 'done': done})}\n\n"

        queue = dhan_service.load_tradebook_queue()
        if not queue:
            yield evt('No sync queue found. Import your tradebook CSV first.', ok=False, done=True)
            return

        yield evt(f'Loaded {len(queue)} (symbol, date) pairs from tradebook.')

        # Filter already-complete entries
        to_fetch = []
        for p in queue:
            sym  = p['symbol']
            date = p['trade_date']
            # Check expired-option cache (rollingoption path)
            status = dhan_service.get_expired_option_ohlc_status(sym, date)
            if status.get('status') == 'complete':
                continue
            # Also check if there's a security_id mapping (historical path)
            sym_map = dhan_service.load_symbol_map()
            if sym in sym_map:
                info = sym_map[sym]
                hist_status = dhan_service.get_ohlc_status(info['security_id'], date)
                if hist_status.get('status') == 'complete':
                    continue
            to_fetch.append(p)

        if not to_fetch:
            yield evt('All OHLC already cached — nothing to fetch!', done=True)
            return

        yield evt(f'Fetching {len(to_fetch)} missing entries…')
        ok_count  = 0
        err_count = 0

        for i, item in enumerate(to_fetch, 1):
            sym        = item['symbol']
            trade_date = item['trade_date']
            expiry_date = item.get('expiry_date', '')
            entry_time  = item.get('entry_time', '')

            try:
                df = dhan_service.fetch_expired_option_ohlc(sym, trade_date, entry_time)
                candles = len(df) if (df is not None and not df.empty) else 0
                if candles == 0:
                    raise ValueError('0 candles returned')
                ok_count += 1
                yield evt(f'[{i}/{len(to_fetch)}] {sym} {trade_date} — {candles} candles ✓')
            except Exception as e:
                err_count += 1
                yield evt(f'[{i}/{len(to_fetch)}] {sym} {trade_date} — {e}', ok=False)

            time.sleep(0.2)

        yield evt(f'Done — {ok_count} fetched, {err_count} errors out of {len(to_fetch)}.', done=True)

    return Response(
        stream_with_context(_generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


# ── Run Simulation ────────────────────────────────────────────────────────────

@whatif_bp.route('/api/whatif/run', methods=['POST'])
@login_required
def run_simulation():
    """
    Body:
      date_from, date_to         (optional YYYY-MM-DD)
      target_pts, sl_pts         (float)
      trail_trigger_pts          (float, 0 = disabled)
      timeframe                  (int, minutes: 1/2/3/4/5)
      direction                  ('' | 'long' | 'short')
    """
    body = request.json or {}
    date_from = body.get('date_from', '')
    date_to   = body.get('date_to',   '')
    params = {
        'target_pts':        float(body.get('target_pts',        30)),
        'sl_pts':            float(body.get('sl_pts',            15)),
        'trail_trigger_pts': float(body.get('trail_trigger_pts',  0)),
        'timeframe':         int(body.get('timeframe',            1)),
        'direction':         body.get('direction', ''),
    }

    # Load trades
    data_file = get_user_data_file()
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    trades = data.get('trades', [])

    # Filter by date range
    if date_from:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) >= date_from]
    if date_to:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) <= date_to]

    # Build OHLC map from cache.
    # Priority: security_id (historical, accurate) > rollingoption (fallback)
    symbol_map = dhan_service.load_symbol_map()
    ohlc_map   = {}
    for t in trades:
        sym  = t.get('Instrument', '')
        date = t.get('date', t.get('trade_date', ''))
        key  = (sym, date)
        if key in ohlc_map:
            continue
        if sym in symbol_map:
            # Has security_id — use accurate historical endpoint
            info = symbol_map[sym]
            df   = dhan_service.load_cached_ohlc(info['security_id'], date)
        else:
            # No security_id — fall back to rollingoption (options) or skip
            df = dhan_service.load_cached_expired_option_ohlc(sym, date)
        if df is not None:
            ohlc_map[key] = df

    # Simulate
    results = whatif_service.simulate_trades(trades, ohlc_map, params)
    summary = whatif_service.summary_stats(results)

    # Build T-number: per (instrument, date), number trades in time order → T1, T2, T3...
    trade_seq = {}   # (instrument, date) → counter
    out = []
    for r in results:
        sim  = r.get('_sim')
        tt   = r.get('TradeType', 'sell').lower()
        inst = r.get('Instrument', '')
        date = r.get('date', r.get('trade_date', ''))
        qty  = r.get('Qty', 1)
        broker     = r.get('Broker', '')
        fill_count = r.get('fill_count', 2)
        key  = (inst, date)
        trade_seq[key] = trade_seq.get(key, 0) + 1
        t_num = f"T{trade_seq[key]}"

        # Actual net P/L — from precomputed trade field (already has taxes)
        actual_net = r.get('Net P/L')

        # Planned net P/L — calculate charges on simulated exit price
        planned_net = None
        if sim and sim.get('planned_exit_price') is not None:
            ep  = sim['entry_price']
            xp  = sim['planned_exit_price']
            dir_  = sim['direction']
            buy_p  = xp if dir_ == 'short' else ep
            sell_p = ep if dir_ == 'short' else xp
            _, _, planned_net = _net_pnl(buy_p, sell_p, qty, broker, fill_count)

        # Missed net = planned_net - actual_net
        missed_net = None
        if planned_net is not None and actual_net is not None:
            missed_net = round(planned_net - actual_net, 2)

        out.append({
            'date':       date,
            'time':            r.get('Sell Time') if tt == 'sell' else r.get('Buy Time', ''),
            'actual_exit_time': r.get('Buy Time',  '') if tt == 'sell' else r.get('Sell Time', ''),
            'instrument': inst,
            't_num':      t_num,
            'direction':  'SHORT' if tt == 'sell' else 'LONG',
            'entry':      r.get('Sell Price (Avg)') if tt == 'sell' else r.get('Buy Price (Avg)'),
            'exit_actual': r.get('Buy Price (Avg)') if tt == 'sell' else r.get('Sell Price (Avg)'),
            'qty':        qty,
            'tags':       r.get('tags', []),
            'actual_pnl':      sim['actual_pnl']  if sim else None,
            'actual_net':      actual_net,
            'actual_pts':      sim['actual_pts']   if sim else None,
            'planned_pnl':     sim['planned_pnl']  if sim else None,
            'planned_net':     planned_net,
            'planned_pts':     sim['planned_pts']  if sim else None,
            'missed_pts':      sim['missed_pts']   if sim else None,
            'missed_net':      missed_net,
            'mfe':             sim['mfe']           if sim else None,
            'mae':             sim['mae']           if sim else None,
            'efficiency':      sim['efficiency']    if sim else None,
            'exit_reason':     sim['exit_reason']   if sim else 'no_ohlc',
            'exit_time':       sim['exit_time']     if sim else None,
            'trail_triggered': sim['trail_triggered'] if sim else False,
        })

    return jsonify({'summary': summary, 'trades': out})
