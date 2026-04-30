"""
services/strategies/base_strategy.py
--------------------------------------
Abstract interface every strategy must implement.
"""
from abc import ABC, abstractmethod


class BaseStrategy(ABC):

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def generate_signal(self, candles: list, params: dict = None) -> tuple:
        """
        Analyse candles and return a trading signal.

        Returns
        -------
        (signal, price, sl_price)
          signal   : 'BUY' | 'SELL' | None
          price    : float  (signal / entry price)
          sl_price : float | None
        """

    def default_params(self) -> dict:
        return {}
