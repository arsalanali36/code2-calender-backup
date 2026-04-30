"""
services/brokers/base_broker.py
--------------------------------
Abstract interface every broker must implement.
Common vocabulary (translated internally per broker):
  transaction_type : 'BUY' | 'SELL'
  order_type       : 'MARKET' | 'LIMIT'
  product_type     : 'INTRADAY' | 'DELIVERY' | 'MARGIN'
"""
from abc import ABC, abstractmethod


class BaseBroker(ABC):

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def fetch_candles(self, security_id, exchange_segment, instrument,
                      trade_date, interval=1) -> list:
        """Return list of dicts: {time, open, high, low, close, vol}."""

    @abstractmethod
    def place_order(self, *, symbol, security_id, exchange_segment,
                    transaction_type, order_type, product_type,
                    qty, price=0.0) -> dict:
        """Place a live order. Returns dict with at least {order_id, status}."""

    @abstractmethod
    def cancel_order(self, order_id) -> dict: ...

    @abstractmethod
    def get_order_status(self, order_id) -> dict: ...

    @abstractmethod
    def get_positions(self) -> list: ...
