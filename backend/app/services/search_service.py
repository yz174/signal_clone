from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Contact,
    Conversation,
    ConversationMember,
    ConversationType,
    Message,
    User,
)

MAX_HITS = 20


@dataclass(frozen=True)
class ConversationHit:
    id: str
    title: str
    type: ConversationType


@dataclass(frozen=True)
class MessageHit:
    message: Message
    conversation_id: str
    conversation_title: str


@dataclass(frozen=True)
class SearchResults:
    contacts: list[User]
    conversations: list[ConversationHit]
    messages: list[MessageHit]


class SearchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(self, user: User, term: str) -> SearchResults:
        needle = term.strip()
        if not needle:
            return SearchResults(contacts=[], conversations=[], messages=[])

        pattern = f"%{needle}%"
        mine = await self._my_conversations(user.id)
        titles = {conversation.id: self._title_for(conversation, user.id) for conversation in mine}

        return SearchResults(
            contacts=await self._contacts(user.id, pattern),
            conversations=[
                ConversationHit(
                    id=conversation.id, title=titles[conversation.id], type=conversation.type
                )
                for conversation in mine
                if needle.lower() in titles[conversation.id].lower()
            ][:MAX_HITS],
            messages=await self._messages(list(titles), titles, pattern),
        )

    async def _my_conversations(self, user_id: str) -> list[Conversation]:
        rows = await self._session.scalars(
            select(Conversation)
            .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
            .where(
                ConversationMember.user_id == user_id,
                ConversationMember.left_at.is_(None),
            )
            .options(selectinload(Conversation.members).joinedload(ConversationMember.user))
            .order_by(Conversation.last_activity_at.desc())
        )
        return list(rows)

    def _title_for(self, conversation: Conversation, viewer_id: str) -> str:
        if conversation.type is ConversationType.GROUP:
            return conversation.name or "Group"
        for member in conversation.members:
            if member.user_id != viewer_id:
                return member.user.display_name
        return "Note to self"

    async def _contacts(self, user_id: str, pattern: str) -> list[User]:
        rows = await self._session.scalars(
            select(User)
            .join(Contact, Contact.contact_user_id == User.id)
            .where(
                Contact.owner_id == user_id,
                or_(
                    User.display_name.ilike(pattern),
                    User.username.ilike(pattern),
                    User.phone_e164.ilike(pattern),
                ),
            )
            .order_by(User.display_name)
            .limit(MAX_HITS)
        )
        return list(rows)

    async def _messages(
        self, conversation_ids: list[str], titles: dict[str, str], pattern: str
    ) -> list[MessageHit]:
        if not conversation_ids:
            return []

        rows = await self._session.scalars(
            select(Message)
            .where(
                Message.conversation_id.in_(conversation_ids),
                Message.deleted_at.is_(None),
                Message.body.ilike(pattern),
            )
            .order_by(Message.created_at.desc())
            .limit(MAX_HITS)
        )
        return [
            MessageHit(
                message=message,
                conversation_id=message.conversation_id,
                conversation_title=titles[message.conversation_id],
            )
            for message in rows
        ]
