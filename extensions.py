"""
extensions.py
-------------
Flask extension instances (limiter, etc.) created here to avoid circular imports.
Import these in app.py to init_app(), and in routes to apply decorators.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
