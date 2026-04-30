"""
services/brokers/zerodha_broker.py
------------------------------------
Zerodha Kite broker stub — not yet implemented.
"""
from services.brokers.base_broker import BaseBroker


class ZerodhaBroker(BaseBroker):

    @property
    def name(self) -> str:
        return 'zerodha'

    def fetch_candles(self, security_id, exchange_segment, instrument,
                      trade_date, interval=1) -> list:
        raise NotImplementedError("Zerodha broker not yet implemented.")

    def place_order(self, *, symbol, security_id, exchange_segment,
                    transaction_type, order_type, product_type,
                    qty, price=0.0) -> dict:
        raise NotImplementedError("Zerodha broker not yet implemented.")

    def cancel_order(self, order_id) -> dict:
        raise NotImplementedError("Zerodha broker not yet implemented.")

    def get_order_status(self, order_id) -> dict:
        raise NotImplementedError("Zerodha broker not yet implemented.")

    def get_positions(self) -> list:
        raise NotImplementedError("Zerodha broker not yet implemented.")
