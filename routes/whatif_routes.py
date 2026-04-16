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
from services.whatif_service import net_pnl as _net_pnl
from services.trade_service import get_all_trades
from flask_login import current_user as _current_user


def _load_trades_for_current_user():
    """Helper: load trades respecting the logged-in user."""
    user_id = _current_user.id if _current_user.is_authenticated else None
    return get_all_trades(user_id=user_id).get('trades', [])

whatif_bp = Blueprint('whatif', __name__)


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
    Body (optional): { symbols: [...], date_from, date_to }
    """
    body       = request.json or {}
    symbols_in = body.get('symbols', [])
    date_from  = body.get('date_from', '')
    date_to    = body.get('date_to',   '')

    if not symbols_in:
        trades = _load_trades_for_current_user()
        sym_date_map, _ = whatif_service.collect_trade_pairs(trades, date_from, date_to)
        symbols_in = sym_date_map

    if not symbols_in:
        return jsonify({'results': {}, 'saved': 0})

    if isinstance(symbols_in, list):
        symbols_in = {s: None for s in symbols_in}

    try:
        results = dhan_service.auto_map_instruments(symbols_in)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    for sym, res in results.items():
        res['trade_date'] = symbols_in.get(sym, '')

    mapping = dhan_service.load_symbol_map()
    mapping, saved = whatif_service.apply_confidence_mapping(results, mapping)
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

    trades = _load_trades_for_current_user()

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

        parsed = dhan_service._parse_nse_symbol(sym, date)
        is_option = bool(parsed and parsed.get('instrument') in ('OPTIDX', 'OPTSTK'))
        if sym in symbol_map:
            info   = symbol_map[sym]
            status = dhan_service.get_ohlc_status(info['security_id'], date)
            # For options: also check expired-option cache — data may have been
            # fetched via the rollingoption path and stored as EXP_*.csv
            if status.get('status') != 'complete' and is_option:
                exp_status = dhan_service.get_expired_option_ohlc_status(sym, date)
                if exp_status.get('status') == 'complete':
                    status = exp_status
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
            trades = _load_trades_for_current_user()
        except Exception as e:
            yield evt(f'Error loading trades: {e}', ok=False, done=True)
            return

        sym_date_map, pairs = whatif_service.collect_trade_pairs(trades)
        yield evt(f'Found {len(sym_date_map)} instruments across {len(pairs)} trade days.')

        if not pairs:
            yield evt('No trades with instruments found.', done=True)
            return

        # ── Phase 1: Auto-map all unmapped symbols ────────────────
        symbol_map = dhan_service.load_symbol_map()
        unmapped   = {sym: date for sym, date in sym_date_map.items() if sym not in symbol_map}

        if unmapped:
            yield evt(f'Phase 1/2 — Auto-mapping {len(unmapped)} unmapped instruments…')
            try:
                results   = dhan_service.auto_map_instruments(unmapped)
                symbol_map, new_saved = whatif_service.apply_confidence_mapping(results, symbol_map)
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
                # Also check EXP_ cache — expired options may have been fetched
                # via rollingoption and stored there instead of historical path
                if status.get('status') != 'complete' and is_option:
                    exp_st = dhan_service.get_expired_option_ohlc_status(sym, date)
                    if exp_st.get('status') == 'complete':
                        status = exp_st
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
    Saves symbol→expiry map and sync queue; returns {ok, imported, pairs}.
    """
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

    try:
        expiry_map, queue = whatif_service.parse_tradebook_csv(content)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    existing = dhan_service.load_symbol_expiry_map()
    existing.update(expiry_map)
    dhan_service.save_symbol_expiry_map(existing)
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

    trades = _load_trades_for_current_user()
    if date_from:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) >= date_from]
    if date_to:
        trades = [t for t in trades if t.get('date', t.get('trade_date', '')) <= date_to]

    # Build OHLC cache map. Priority: security_id (historical) > rollingoption (fallback)
    symbol_map = dhan_service.load_symbol_map()
    ohlc_map   = {}
    for t in trades:
        sym  = t.get('Instrument', '')
        date = t.get('date', t.get('trade_date', ''))
        key  = (sym, date)
        if key in ohlc_map:
            continue
        if sym in symbol_map:
            df = dhan_service.load_cached_ohlc(symbol_map[sym]['security_id'], date)
        else:
            df = dhan_service.load_cached_expired_option_ohlc(sym, date)
        if df is not None:
            ohlc_map[key] = df

    results = whatif_service.simulate_trades(trades, ohlc_map, params)
    summary = whatif_service.summary_stats(results)
    out     = whatif_service.format_simulation_output(results, _net_pnl)

    return jsonify({'summary': summary, 'trades': out})
