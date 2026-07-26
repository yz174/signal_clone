from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ID_LENGTH, Base, IdMixin, TimestampMixin, enum_column, utcnow

if TYPE_CHECKING:
    from app.models.user import User


class ConversationType(StrEnum):
    DIRECT = "direct"
    GROUP = "group"


class MemberRole(StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


def direct_key_for(user_a_id: str, user_b_id: str) -> str:
    first, second = sorted((user_a_id, user_b_id))
    return f"{first}:{second}"


class Conversation(Base, IdMixin, TimestampMixin):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_last_activity_at", "last_activity_at"),)

    type: Mapped[ConversationType] = mapped_column(
        enum_column(ConversationType, "conversation_type")
    )
    name: Mapped[str | None] = mapped_column(String(64), default=None)
    description: Mapped[str | None] = mapped_column(String(255), default=None)
    avatar_url: Mapped[str | None] = mapped_column(Text, default=None)
    created_by: Mapped[str | None] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    direct_key: Mapped[str | None] = mapped_column(String(64), unique=True, default=None)
    last_seq: Mapped[int] = mapped_column(default=0)

    last_message_id: Mapped[str | None] = mapped_column(String(ID_LENGTH), default=None)
    last_activity_at: Mapped[datetime] = mapped_column(default=utcnow)

    disappear_seconds: Mapped[int | None] = mapped_column(default=None)

    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", lazy="selectin"
    )


class ConversationMember(Base):
    """Membership plus that member's read state.

    Receipts are two integers per member rather than a row per (message, recipient): a
    message to 500 people costs one write, and any message's tick state is derived by
    comparing these cursors against its seq.
    """

    __tablename__ = "conversation_members"
    __table_args__ = (Index("ix_conversation_members_user_id_left_at", "user_id", "left_at"),)

    conversation_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[MemberRole] = mapped_column(
        enum_column(MemberRole, "member_role"), default=MemberRole.MEMBER
    )
    joined_at: Mapped[datetime] = mapped_column(default=utcnow)

    left_at: Mapped[datetime | None] = mapped_column(default=None)

    last_read_seq: Mapped[int] = mapped_column(default=0)
    last_delivered_seq: Mapped[int] = mapped_column(default=0)
    unread_count: Mapped[int] = mapped_column(default=0)

    muted_until: Mapped[datetime | None] = mapped_column(default=None)
    is_pinned: Mapped[bool] = mapped_column(default=False)
    is_archived: Mapped[bool] = mapped_column(default=False)

    conversation: Mapped[Conversation] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(lazy="joined")
