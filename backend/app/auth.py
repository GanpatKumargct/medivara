"""Passwords, opaque session tokens and the current-user dependency (FR-001, FR-002).

Tokens are 24 random bytes (hex) with an `mvs_` prefix. Only their SHA-256 is stored.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_session
from app.errors import ApiError
from app.models import AuthSession, User, as_utc, utcnow

_hasher = PasswordHasher()
# Verified against when the email is unknown, so both failure paths cost the same.
_DUMMY_HASH = _hasher.hash("medivara-dummy-password")

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_session(session: Session, user: User) -> tuple[str, AuthSession]:
    token = "mvs_" + secrets.token_hex(24)
    now = utcnow()
    row = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        created_at=now,
        expires_at=now + timedelta(hours=get_settings().session_hours),
    )
    session.add(row)
    return token, row


@dataclass
class CurrentUser:
    user: User
    auth_session: AuthSession


def current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> CurrentUser:
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise ApiError(401, "UNAUTHENTICATED", "Please sign in.")
    row = session.exec(select(AuthSession).where(AuthSession.token_hash == hash_token(creds.credentials))).first()
    if row is None:
        raise ApiError(401, "UNAUTHENTICATED", "Please sign in.")
    if row.revoked_at is not None or as_utc(row.expires_at) <= utcnow():
        raise ApiError(401, "SESSION_EXPIRED", "Your session ended. Please sign in again.")
    user = session.get(User, row.user_id)
    if user is None:
        raise ApiError(401, "UNAUTHENTICATED", "Please sign in.")
    request.state.user_id = user.id
    return CurrentUser(user=user, auth_session=row)
