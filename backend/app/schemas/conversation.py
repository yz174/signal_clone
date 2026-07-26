from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import ConversationType, MemberRole
from app.schemas.message import MessageOut
from app.schemas.user import UserOut


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserOut
    role: MemberRole
    joined_at: datetime
    last_read_seq: int
    last_delivered_seq: int


class ConversationOut(BaseModel):
    id: str
    type: ConversationType
    name: str | None
    description: str | None
    avatar_url: str | None
    last_activity_at: datetime
    last_seq: int
    disappear_seconds: int | None
    members: list[MemberOut]
    unread_count: int
    last_message: MessageOut | None


class ConversationPageOut(BaseModel):
    items: list[ConversationOut]
    next_cursor: str | None


class DirectConversationIn(BaseModel):
    type: Literal["direct"]
    user_id: str


class GroupConversationIn(BaseModel):
    type: Literal["group"]
    name: str = Field(min_length=1, max_length=64)
    member_ids: list[str] = Field(min_length=1)
    description: str | None = Field(default=None, max_length=255)


ConversationCreate = Annotated[
    DirectConversationIn | GroupConversationIn,
    Field(discriminator="type"),
]


class ConversationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = None
    disappear_seconds: int | None = Field(default=None, ge=0)


class AddMembersIn(BaseModel):
    user_ids: list[str] = Field(min_length=1)


class SetRoleIn(BaseModel):
    role: MemberRole
