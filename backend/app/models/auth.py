from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import ID_LENGTH, Base, IdMixin, utcnow


class VerificationCode(Base, IdMixin):
    __tablename__ = "verification_codes"
    __table_args__ = (Index("ix_verification_codes_phone_expires", "phone_e164", "expires_at"),)

    phone_e164: Mapped[str] = mapped_column(String(20))
    code_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime]
    consumed_at: Mapped[datetime | None] = mapped_column(default=None)
    attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AuthSession(Base, IdMixin):
    __tablename__ = "auth_sessions"

    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(Text, unique=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None] = mapped_column(default=None)
