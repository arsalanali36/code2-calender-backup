"""
routes/algo_routes.py
---------------------
HTTP layer for the Algo Lab (paper-trading EMA crossover bot).
All business logic lives in services/algo_engine.py.
"""
from flask import Blueprint, request, jsonify, render_template
from flask_login import login_required

from services.algo_engine import (
    get_algo_config, save_algo_config,
    get_watchlist, save_watchlist,
    get_orders, clear_orders, save_orders,
    resolve_equity_symbol, run_tick, reset_daily_state,
)

algo_bp = Blueprint('algo', __name__)


# ── Page ──────────────────────────────────────────────────────────────────────

@algo_bp.route('/algo-lab')
@login_required
def algo_lab_page():
    return render_template('algo_lab.html')


# ── Config ────────────────────────────────────────────────────────────────────

@algo_bp.route('/api/algo/config', methods=['GET'])
@login_required
def get_config():
    return jsonify(get_algo_config())


@algo_bp.route('/api/algo/config', methods=['POST'])
@login_required
def set_config():
    data = request.get_json() or {}
    cfg  = get_algo_config()
    for key in ('ema_fast', 'ema_slow', 'timeframe', 'entry_mode',
                'sl_type', 'daily_loss_limit', 'qty', 'running'):
        if key in data:
            val = data[key]
            if key in ('ema_fast', 'ema_slow', 'qty'):
                val = int(val)
            elif key in ('daily_loss_limit',):
                val = float(val)
            cfg[key] = val
    save_algo_config(cfg)
    return jsonify({"ok": True, "config": cfg})


@algo_bp.route('/api/algo/start', methods=['POST'])
@login_required
def start_algo():
    cfg = get_algo_config()
    cfg['running'] = True
    save_algo_config(cfg)
    return jsonify({"ok": True, "running": True})


@algo_bp.route('/api/algo/stop', methods=['POST'])
@login_required
def stop_algo():
    cfg = get_algo_config()
    cfg['running'] = False
    save_algo_config(cfg)
    return jsonify({"ok": True, "running": False})


# ── Watchlist ─────────────────────────────────────────────────────────────────

@algo_bp.route('/api/algo/watchlist', methods=['GET'])
@login_required
def get_wl():
    return jsonify(get_watchlist())


@algo_bp.route('/api/algo/watchlist', methods=['POST'])
@login_required
def set_wl():
    """
    Accepts {"symbols": "RELIANCE, TCS, INFY"} or {"items": [...resolved list...]}.
    If plain symbols given, auto-resolve from scrip master.
    """
    data = request.get_json() or {}

    if 'items' in data:
        save_watchlist(data['items'])
        return jsonify({"ok": True, "watchlist": data['items']})

    raw = data.get('symbols', '')
    syms = [s.strip().upper() for s in raw.replace('\n', ',').split(',') if s.strip()]

    resolved, failed = [], []
    for sym in syms:
        r = resolve_equity_symbol(sym)
        if r:
            resolved.append(r)
        else:
            failed.append(sym)

    save_watchlist(resolved)
    return jsonify({
        "ok":       True,
        "watchlist": resolved,
        "failed":   failed,
    })


@algo_bp.route('/api/algo/watchlist/resolve', methods=['POST'])
@login_required
def resolve_wl():
    """Resolve symbols without saving — for live preview."""
    data  = request.get_json() or {}
    raw   = data.get('symbols', '')
    syms  = [s.strip().upper() for s in raw.replace('\n', ',').split(',') if s.strip()]
    out   = []
    for sym in syms:
        r = resolve_equity_symbol(sym)
        out.append(r if r else {"symbol": sym, "security_id": None, "error": "Not found in scrip master"})
    return jsonify(out)


# ── Orders ────────────────────────────────────────────────────────────────────

@algo_bp.route('/api/algo/orders', methods=['GET'])
@login_required
def get_order_book():
    return jsonify(get_orders())


@algo_bp.route('/api/algo/orders/clear', methods=['POST'])
@login_required
def clear_order_book():
    clear_orders()
    reset_daily_state()
    return jsonify({"ok": True})


# ── Tick ──────────────────────────────────────────────────────────────────────

@algo_bp.route('/api/algo/tick', methods=['POST'])
@login_required
def tick():
    """Run one algo cycle and return updated state."""
    try:
        result = run_tick()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Status (lightweight poll) ─────────────────────────────────────────────────

@algo_bp.route('/api/algo/status', methods=['GET'])
@login_required
def status():
    cfg    = get_algo_config()
    orders = get_orders()
    open_c = sum(1 for o in orders if o['status'] == 'OPEN')
    closed = [o for o in orders if o['status'] == 'CLOSED']
    realized = sum(o['pnl'] for o in closed if o['pnl'] is not None)
    return jsonify({
        "running":    cfg.get('running', False),
        "open_positions": open_c,
        "realized_pnl":   round(realized, 2),
        "config":     cfg,
        "orders":     orders,
    })
