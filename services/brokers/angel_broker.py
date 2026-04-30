"""
services/brokers/angel_broker.py
----------------------------------
Angel One broker stub — not yet implemented.
"""
from services.brokers.base_broker import BaseBroker


class AngelBroker(BaseBroker):

    @property
    def name(self) -> str:
        return 'angel'

    def fetch_candles(self, security_id, exchange_segment, instrument,
                      trade_date, interval=1) -> list:
        raise NotImplementedError("Angel One broker not yet implemented.")

    def place_order(self, *, symbol, security_id, exchange_segment,
                    transaction_type, order_type, product_type,
                    qty, price=0.0) -> dict:
        raise NotImplementedError("Angel One broker not yet implemented.")

    def cancel_order(self, order_id) -> dict:
        raise NotImplementedError("Angel One broker not yet implemented.")

    def get_order_status(self, order_id) -> dict:
        raise NotImplementedError("Angel One broker not yet implemented.")

    def get_positions(self) -> list:
        raise NotImplementedError("Angel One broker not yet implemented.")
