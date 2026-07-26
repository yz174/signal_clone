from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"

    phone_e164: Mapped[str] = mapped_column(String(20), unique=True)
    username: Mapped[str | None] = mapped_column(String(32), unique=True, default=None)
    display_name: Mapped[str] = mapped_column(String(64))
    about: Mapped[str | None] = mapped_column(String(140), default=None)
    avatar_url: Mapped[str | None] = mapped_column(Text, default=None)
    avatar_color: Mapped[str] = mapped_column(String(16))
    last_seen_at: Mapped[datetime | None] = mapped_column(default=None)
