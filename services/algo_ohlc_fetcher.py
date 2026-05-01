"""
services/algo_ohlc_fetcher.py
------------------------------
Background service: auto-fetches today's 1-min OHLC for all algo watchlist
symbols during market hours (9:15–15:35 IST, Mon–Fri), every 5 minutes.
Runs independently of the trading bot (BOT ON/OFF doesn't matter).
Data saved to data/algo_ohlc/SYMBOL_DATE.json for backtesting.
"""
import time
import logging
import threading
from datetime import datetime, date

log = logging.getLogger('algo_ohlc_fetcher')

_thread = None
_INTERVAL_SECS = 300   # fetch every 5 minutes
_DELAY_PER_SYM = 0.5   # between symbols to avoid rate limit


def _is_market_open():
    now = datetime.now()
    if now.weekday() >= 5:          # Saturday=5, Sunday=6
        return False
    t = now.hour * 60 + now.minute  # minutes since midnight
    return 555 <= t <= 935          # 9:15 (555) to 15:35 (935)


def _fetch_all():
    """Fetch OHLC for every symbol in the watchlist and save to disk."""
    try:
        from services.algo_engine import (
            get_watchlist, _calc_ema, _store_cache, get_algo_config,
        )
        from services.brokers.broker_registry import get_broker
        from services.dhan_service_core import get_config as dhan_get_config

        dhan_cfg = dhan_get_config()
        if not dhan_cfg:
            log.warning('Dhan credentials not configured — skipping OHLC fetch')
            return

        watchlist = get_watchlist()
        if not watchlist:
            return

        cfg    = get_algo_config()
        broker = get_broker(cfg.get('broker', 'dhan'))
        today  = date.today().isoformat()
        ok, fail = 0, 0

        for item in watchlist:
            symbol = item['symbol']
            sid    = item['security_id']
            seg    = item.get('exchange_segment', 'NSE_EQ')
            instr  = item.get('instrument', 'EQUITY')
            try:
                time.sleep(_DELAY_PER_SYM)
                candles = broker.fetch_candles(sid, seg, instr, today)
                if candles:
                    ef = _calc_ema([c['close'] for c in candles], cfg['ema_fast'])
                    es = _calc_ema([c['close'] for c in candles], cfg['ema_slow'])
                    _store_cache(sid, symbol, candles, ef, es)  # also saves to disk
                    ok += 1
            except Exception as e:
                fail += 1
                log.debug('OHLC fetch failed for %s: %s', symbol, e)

        log.info('OHLC auto-fetch done: %d OK, %d failed (%s)', ok, fail, today)

    except Exception as e:
        log.exception('OHLC fetcher error: %s', e)


def _worker():
    log.info('OHLC background fetcher started (every %ds during market hours)', _INTERVAL_SECS)
    while True:
        if _is_market_open():
            _fetch_all()
        else:
            now = datetime.now()
            log.debug('Market closed (%s %02d:%02d) — skipping', now.strftime('%a'), now.hour, now.minute)
        time.sleep(_INTERVAL_SECS)


def start_ohlc_fetcher():
    global _thread
    if _thread and _thread.is_alive():
        return
    _thread = threading.Thread(target=_worker, daemon=True, name='algo-ohlc-fetcher')
    _thread.start()
