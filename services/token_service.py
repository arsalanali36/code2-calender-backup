"""
token_service.py
----------------
Signed API tokens for cross-origin auth (used by tradefeed static frontend).
Uses itsdangerous (bundled with Flask) — no extra dependencies.
"""
from itsdangerous import URLSafeTimedSerializer
from config import SECRET_KEY

_serializer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE = 86400 * 30  # 30 days


def create_token(user_id: int) -> str:
    return _serializer.dumps({'user_id': user_id}, salt='api-token')


def verify_token(token: str):
    """Returns user_id int if valid, None otherwise."""
    try:
        data = _serializer.loads(token, salt='api-token', max_age=TOKEN_MAX_AGE)
        return data.get('user_id')
    except Exception:
        return None
