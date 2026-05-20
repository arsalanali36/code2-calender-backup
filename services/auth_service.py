"""
services/auth_service.py
------------------------
Business logic for authentication: user data migration on first registration.
"""
import logging
import os
import shutil

from config import BASE_DIR, DATA_FILE

logger = logging.getLogger(__name__)


def migrate_default_data_for_first_user(user_id: int) -> None:
    """
    If user_id == 1, copy the shared trades.json into trades_1.json
    so the first registered user inherits any pre-existing trade data.
    No-op if trades_1.json already exists or trades.json is missing.
    """
    if user_id != 1:
        # New users get randomised demo data so they can explore the app
        # without starting from a blank slate.
        try:
            from services.demo_service import generate_demo_data_for_user
            generate_demo_data_for_user(user_id)
        except Exception:
            logger.exception('Failed to generate demo data for user %s', user_id)
        return
    user_trades = os.path.join(BASE_DIR, 'data', f'trades_{user_id}.json')
    if os.path.exists(DATA_FILE) and not os.path.exists(user_trades):
        try:
            shutil.copy2(DATA_FILE, user_trades)
            logger.info('Migrated default trades.json → trades_%s.json', user_id)
        except Exception:
            logger.exception('Failed to migrate default trades data for user %s', user_id)
