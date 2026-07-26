from pydantic import BaseModel

from app.models import ConversationType
from app.schemas.message import MessageOut
from app.schemas.user import UserOut


class ConversationHitOut(BaseModel):
    id: str
    title: str
    type: ConversationType


class MessageHitOut(BaseModel):
    message: MessageOut
    conversation_id: str
    conversation_title: str


class SearchResultsOut(BaseModel):
    contacts: list[UserOut]
    conversations: list[ConversationHitOut]
    messages: list[MessageHitOut]
