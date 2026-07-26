from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import ID_LENGTH, Base, utcnow


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (CheckConstraint("owner_id <> contact_user_id", name="no_self_contact"),)

    owner_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    contact_user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    nickname: Mapped[str | None] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
