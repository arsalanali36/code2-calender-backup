"""
services/brokers/dhan_broker.py
---------------------------------
Dhan broker implementation.
Reuses _post_json / _dhan_headers / get_config from dhan_service_core.
"""
import json
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timedelta

from services.brokers.base_broker import BaseBroker
from services.dhan_service_core import (
    DHAN_API_BASE, _post_json, _dhan_headers, get_config,
)

# Dhan product type mapping (common vocab → Dhan API strings)
_PRODUCT_MAP = {
    'INTRADAY': 'INTRADAY',
    'DELIVERY': 'CNC',
    'MARGIN':   'MARGIN',
}


def _get_json(url, headers):
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"Dhan GET {e.code}: {body[:300]}")


def _delete_json(url, headers):
    req = urllib.request.Request(url, headers=headers, method='DELETE')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"Dhan DELETE {e.code}: {body[:300]}")


class DhanBroker(BaseBroker):

    @property
    def name(self) -> str:
        return 'dhan'

    def _cfg(self):
        cfg = get_config()
        if not cfg:
            raise RuntimeError("Dhan credentials not configured. Login via Strategy Lab.")
        return cfg

    # ── Data ──────────────────────────────────────────────────────────────────

    def fetch_candles(self, security_id, exchange_segment, instrument,
                      trade_date, interval=1) -> list:
        cfg  = self._cfg()
        url  = f"{DHAN_API_BASE}/v2/charts/intraday"
        payload = {
            "securityId":      str(security_id),
            "exchangeSegment": exchange_segment,
            "instrument":      instrument,
            "interval":        interval,
            "fromDate":        trade_date,
            "toDate":          trade_date,
        }
        resp   = _post_json(url, payload, _dhan_headers(cfg))
        opens  = resp.get('open',      []) or []
        highs  = resp.get('high',      []) or []
        lows   = resp.get('low',       []) or []
        closes = resp.get('close',     []) or []
        vols   = resp.get('volume',    []) or []
        stamps = resp.get('timestamp', []) or []

        if not closes:
            return []

        candles = []
        if stamps:
            for i, ts in enumerate(stamps):
                dt = datetime.fromtimestamp(int(ts))
                if dt.strftime('%Y-%m-%d') != trade_date:
                    continue
                candles.append({
                    'time':  dt.strftime('%H:%M'),
                    'open':  float(opens[i])  if i < len(opens)  else 0.0,
                    'high':  float(highs[i])  if i < len(highs)  else 0.0,
                    'low':   float(lows[i])   if i < len(lows)   else 0.0,
                    'close': float(closes[i]),
                    'vol':   int(vols[i])     if i < len(vols)   else 0,
                })
        else:
            start = datetime.strptime(f"{trade_date} 09:15", '%Y-%m-%d %H:%M')
            for i, c in enumerate(closes):
                dt = start + timedelta(minutes=i * interval)
                candles.append({
                    'time':  dt.strftime('%H:%M'),
                    'open':  float(opens[i])  if i < len(opens)  else 0.0,
                    'high':  float(highs[i])  if i < len(highs)  else 0.0,
                    'low':   float(lows[i])   if i < len(lows)   else 0.0,
                    'close': float(c),
                    'vol':   int(vols[i])     if i < len(vols)   else 0,
                })
        return candles

    # ── Orders ────────────────────────────────────────────────────────────────

    def place_order(self, *, symbol, security_id, exchange_segment,
                    transaction_type, order_type, product_type,
                    qty, price=0.0) -> dict:
        cfg = self._cfg()
        dhan_product = _PRODUCT_MAP.get(product_type.upper(), 'INTRADAY')
        payload = {
            "dhanClientId":       cfg.get('client_id', ''),
            "correlationId":      str(uuid.uuid4())[:16],
            "transactionType":    transaction_type.upper(),
            "exchangeSegment":    exchange_segment,
            "productType":        dhan_product,
            "orderType":          order_type.upper(),
            "validity":           "DAY",
            "tradingSymbol":      symbol,
            "securityId":         str(security_id),
            "quantity":           int(qty),
            "disclosedQuantity":  0,
            "price":              float(price),
            "triggerPrice":       0.0,
            "afterMarketOrder":   False,
            "amoTime":            "OPEN",
            "boProfitValue":      0.0,
            "boStopLossValue":    0.0,
        }
        url = f"{DHAN_API_BASE}/v2/orders"
        resp = _post_json(url, payload, _dhan_headers(cfg))
        return {
            "order_id": resp.get("orderId", ""),
            "status":   resp.get("orderStatus", "PENDING"),
            "raw":      resp,
        }

    def cancel_order(self, order_id) -> dict:
        cfg = self._cfg()
        url = f"{DHAN_API_BASE}/v2/orders/{order_id}"
        resp = _delete_json(url, _dhan_headers(cfg))
        return resp

    def get_order_status(self, order_id) -> dict:
        cfg = self._cfg()
        url = f"{DHAN_API_BASE}/v2/orders/{order_id}"
        resp = _get_json(url, _dhan_headers(cfg))
        return {
            "order_id": order_id,
            "status":   resp.get("orderStatus", "UNKNOWN"),
            "raw":      resp,
        }

    def get_positions(self) -> list:
        cfg = self._cfg()
        url = f"{DHAN_API_BASE}/v2/positions"
        resp = _get_json(url, _dhan_headers(cfg))
        return resp if isinstance(resp, list) else resp.get("data", [])
