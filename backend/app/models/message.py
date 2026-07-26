from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ID_LENGTH, Base, IdMixin, enum_column, utcnow


class MessageKind(StrEnum):
    TEXT = "text"
    MEDIA = "media"
    SYSTEM = "system"


class AttachmentKind(StrEnum):
    IMAGE = "image"
    FILE = "file"


class Message(Base, IdMixin):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "seq", name="uq_messages_conversation_seq"),
        UniqueConstraint(
            "sender_id", "client_message_id", name="uq_messages_sender_client_message_id"
        ),
        Index("ix_messages_conversation_id_seq", "conversation_id", "seq"),
        Index("ix_messages_expires_at", "expires_at"),
    )

    conversation_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("conversations.id", ondelete="CASCADE")
    )
    seq: Mapped[int]

    sender_id: Mapped[str | None] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    kind: Mapped[MessageKind] = mapped_column(
        enum_column(MessageKind, "message_kind"), default=MessageKind.TEXT
    )
    body: Mapped[str | None] = mapped_column(Text, default=None)
    system_event: Mapped[dict[str, Any] | None] = mapped_column(default=None)

    reply_to_id: Mapped[str | None] = mapped_column(
        String(ID_LENGTH), ForeignKey("messages.id", ondelete="SET NULL"), default=None
    )
    client_message_id: Mapped[str] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    edited_at: Mapped[datetime | None] = mapped_column(default=None)

    deleted_at: Mapped[datetime | None] = mapped_column(default=None)
    expires_at: Mapped[datetime | None] = mapped_column(default=None)

    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="message", cascade="all, delete-orphan", lazy="selectin"
    )
    reactions: Mapped[list["Reaction"]] = relationship(
        back_populates="message", cascade="all, delete-orphan", lazy="selectin"
    )


class Attachment(Base, IdMixin):
    __tablename__ = "attachments"

    message_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[AttachmentKind] = mapped_column(enum_column(AttachmentKind, "attachment_kind"))
    url: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(String(128))
    size_bytes: Mapped[int]

    width: Mapped[int | None] = mapped_column(default=None)
    height: Mapped[int | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    message: Mapped[Message] = relationship(back_populates="attachments")


class Reaction(Base):
    __tablename__ = "reactions"

    message_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    message: Mapped[Message] = relationship(back_populates="reactions")
