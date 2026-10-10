"""Plain-text email over SMTP (invitations, API-54). Runs as a FastAPI background task.

Optional: nothing is sent unless SMTP_HOST and SMTP_FROM are set. A failure is logged with
its exception type only, never the address, the subject or the body.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import get_settings

log = logging.getLogger("medivara.mailer")


def configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from)


def send_email(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    # Header values may not contain line breaks; names are user-supplied.
    message["Subject"] = " ".join(subject.split())
    message.set_content(body)
    try:
        context = ssl.create_default_context()
        if settings.smtp_port == 465:  # implicit TLS
            smtp = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15, context=context)
        else:
            smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        with smtp:
            if settings.smtp_port != 465 and settings.smtp_starttls:
                smtp.starttls(context=context)
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        log.info("email_sent", extra={"outcome": "sent"})
    except Exception as exc:  # noqa: BLE001  never fail the request that queued it
        log.warning("email_failed", extra={"outcome": "failed", "exc_type": type(exc).__name__})
