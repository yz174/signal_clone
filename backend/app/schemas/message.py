from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import AttachmentKind, MessageKind


class ReactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    emoji: str


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: AttachmentKind
    url: str
    mime_type: str
    size_bytes: int
    width: int | None
    height: int | None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    seq: int
    sender_id: str | None
    kind: MessageKind
    body: str | None
    reply_to_id: str | None
    client_message_id: str
    created_at: datetime
    edited_at: datetime | None
    deleted_at: datetime | None
    expires_at: datetime | None
    reactions: list[ReactionOut] = []
    attachments: list[AttachmentOut] = []


class MessagePageOut(BaseModel):
    items: list[MessageOut]
    has_more: bool


class MessageCreate(BaseModel):
    client_message_id: str = Field(min_length=1, max_length=64)
    body: str = Field(default="", max_length=4096)
    reply_to_id: str | None = None
    attachment_ids: list[str] = []


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class ReadReceiptIn(BaseModel):
    seq: int = Field(ge=0)


class ReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conversation_id: str
    user_id: str
    last_read_seq: int
    last_delivered_seq: int
    unread_count: int
