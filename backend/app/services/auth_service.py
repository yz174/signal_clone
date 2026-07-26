from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.avatars import pick_avatar_color
from app.core.config import settings
from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    decode_token,
    hash_low_entropy_secret,
    new_refresh_token,
    refresh_token_digest,
    verify_low_entropy_secret,
)
from app.db.base import utcnow
from app.models import AuthSession, User, VerificationCode

MAX_OTP_ATTEMPTS = 5


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def request_otp(self, phone_e164: str) -> datetime:
        expires_at = utcnow() + timedelta(seconds=settings.otp_ttl_seconds)

        await self._session.execute(
            update(VerificationCode)
            .where(
                VerificationCode.phone_e164 == phone_e164,
                VerificationCode.consumed_at.is_(None),
            )
            .values(consumed_at=utcnow())
        )
        self._session.add(
            VerificationCode(
                phone_e164=phone_e164,
                code_hash=hash_low_entropy_secret(settings.mock_otp_code),
                expires_at=expires_at,
            )
        )
        await self._session.commit()

        return expires_at

    async def verify_otp(self, phone_e164: str, code: str) -> User | None:
        challenge = await self._session.scalar(
            select(VerificationCode)
            .where(
                VerificationCode.phone_e164 == phone_e164,
                VerificationCode.consumed_at.is_(None),
                VerificationCode.expires_at > utcnow(),
            )
            .order_by(VerificationCode.created_at.desc())
            .limit(1)
        )
        if challenge is None:
            raise UnauthorizedError("No pending verification for this number")

        if challenge.attempts >= MAX_OTP_ATTEMPTS:
            raise UnauthorizedError("Too many incorrect attempts; request a new code")

        if not verify_low_entropy_secret(challenge.code_hash, code):
            challenge.attempts += 1
            await self._session.commit()
            raise UnauthorizedError("Incorrect code")

        challenge.consumed_at = utcnow()
        await self._session.commit()

        existing = await self._session.scalars(select(User).where(User.phone_e164 == phone_e164))
        return existing.first()

    async def register(
        self,
        registration_token: str,
        display_name: str,
        username: str | None,
        avatar_url: str | None,
    ) -> User:
        phone_e164 = decode_token(registration_token, "registration")

        user = User(
            phone_e164=phone_e164,
            display_name=display_name,
            username=username,
            avatar_url=avatar_url,
            avatar_color=pick_avatar_color(phone_e164),
        )
        self._session.add(user)

        try:
            await self._session.commit()
        except IntegrityError as exc:
            await self._session.rollback()
            raise ConflictError("That phone number or username is already registered") from exc

        return user

    async def start_session(self, user: User, user_agent: str | None) -> SessionTokens:
        refresh_token = new_refresh_token()
        self._session.add(
            AuthSession(
                user_id=user.id,
                refresh_token_hash=refresh_token_digest(refresh_token),
                user_agent=user_agent,
                expires_at=utcnow() + timedelta(seconds=settings.refresh_token_ttl_seconds),
            )
        )
        await self._session.commit()

        return SessionTokens(
            access_token=create_access_token(user.id),
            refresh_token=refresh_token,
            expires_in=settings.access_token_ttl_seconds,
        )

    async def refresh(
        self, refresh_token: str, user_agent: str | None
    ) -> tuple[User, SessionTokens]:
        session_row = await self._session.scalar(
            select(AuthSession).where(
                AuthSession.refresh_token_hash == refresh_token_digest(refresh_token)
            )
        )
        if session_row is None:
            raise UnauthorizedError("Invalid refresh token")

        if session_row.revoked_at is not None:
            await self._revoke_all_for_user(session_row.user_id)
            raise UnauthorizedError("Refresh token has already been used")

        if session_row.expires_at <= utcnow():
            raise UnauthorizedError("Refresh token has expired")

        user = await self._session.get(User, session_row.user_id)
        if user is None:
            raise UnauthorizedError("Account no longer exists")

        session_row.revoked_at = utcnow()
        return user, await self.start_session(user, user_agent)

    async def logout(self, refresh_token: str) -> None:
        await self._session.execute(
            update(AuthSession)
            .where(
                AuthSession.refresh_token_hash == refresh_token_digest(refresh_token),
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=utcnow())
        )
        await self._session.commit()

    async def _revoke_all_for_user(self, user_id: str) -> None:
        await self._session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
        await self._session.commit()
