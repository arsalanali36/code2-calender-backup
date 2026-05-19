"""
services/email_service.py
--------------------------
Admin notification emails via Gmail SMTP.
Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

logger = logging.getLogger(__name__)

ADMIN_EMAIL    = "arsalanali36@gmail.com"
GMAIL_USER     = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASS = os.getenv("GMAIL_APP_PASSWORD", "")


def notify_new_user(new_user_email: str) -> None:
    """
    Send admin notification when a new user registers.
    No-op if GMAIL_USER / GMAIL_APP_PASSWORD not set.
    Never raises — caller wraps in try/except.
    """
    if not GMAIL_USER or not GMAIL_APP_PASS:
        logger.debug("[email] Gmail creds not set — skipping admin notification")
        return

    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    msg = MIMEMultipart()
    msg["From"]    = GMAIL_USER
    msg["To"]      = ADMIN_EMAIL
    msg["Subject"] = f"[Trading Journal] New signup: {new_user_email}"
    msg.attach(MIMEText(
        f"New user registered on your Trading Journal.\n\n"
        f"Email : {new_user_email}\n"
        f"Time  : {timestamp}\n",
        "plain"
    ))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_USER, GMAIL_APP_PASS)
        smtp.sendmail(GMAIL_USER, ADMIN_EMAIL, msg.as_string())

    logger.info("[email] Admin notified of new signup: %s", new_user_email)
