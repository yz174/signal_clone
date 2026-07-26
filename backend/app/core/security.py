import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings
from app.core.errors import UnauthorizedError

TokenType = Literal["access", "registration"]

_hasher = PasswordHasher()


def hash_low_entropy_secret(secret: str) -> str:
    return _hasher.hash(secret)


def verify_low_entropy_secret(hashed: str, secret: str) -> bool:
    try:
        return _hasher.verify(hashed, secret)
    except VerifyMismatchError:
        return False


def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def refresh_token_digest(token: str) -> str:
   return sha256(token.encode()).hexdigest()


def _encode(subject: str, token_type: TokenType, ttl_seconds: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "typ": token_type,
        "iat": now,
        "exp": now + timedelta(seconds=ttl_seconds),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return _encode(user_id, "access", settings.access_token_ttl_seconds)


def create_registration_token(phone_e164: str) -> str:
    return _encode(phone_e164, "registration", settings.otp_ttl_seconds)


def decode_token(token: str, expected_type: TokenType) -> str:
    try:
        payload: dict[str, Any] = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc

    if payload.get("typ") != expected_type:
        raise UnauthorizedError("Token is not valid for this operation")

    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise UnauthorizedError("Malformed token")

    return subject
