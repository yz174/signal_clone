from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.models import Message, Reaction, User
from app.realtime.bus import EventBus
from app.realtime.events import Event, EventType
from app.services.membership import peer_ids, require_membership


class ReactionService:
    def __init__(self, session: AsyncSession, bus: EventBus | None = None) -> None:
        self._session = session
        self._bus = bus

    async def react(self, user: User, message_id: str, emoji: str) -> Message:
        message = await self._visible_message(user, message_id)

        existing = await self._session.get(Reaction, {"message_id": message_id, "user_id": user.id})
        if existing is None:
            self._session.add(Reaction(message_id=message_id, user_id=user.id, emoji=emoji))
        else:
            existing.emoji = emoji

        await self._session.commit()
        await self._announce(user, message, emoji)
        return await self._reload(message_id)

    async def clear(self, user: User, message_id: str) -> Message:
        message = await self._visible_message(user, message_id)

        await self._session.execute(
            delete(Reaction).where(Reaction.message_id == message_id, Reaction.user_id == user.id)
        )
        await self._session.commit()
        await self._announce(user, message, None)
        return await self._reload(message_id)

    async def _visible_message(self, user: User, message_id: str) -> Message:
        message = await self._session.get(Message, message_id)
        if message is None:
            raise NotFoundError("Message not found")
        await require_membership(self._session, message.conversation_id, user.id)
        return message

    async def _reload(self, message_id: str) -> Message:
        message = await self._session.scalar(
            select(Message)
            .where(Message.id == message_id)
            .options(selectinload(Message.reactions))
            .execution_options(populate_existing=True)
        )
        if message is None:
            raise NotFoundError("Message not found")
        return message

    async def _announce(self, user: User, message: Message, emoji: str | None) -> None:
        if self._bus is None:
            return

        recipients = await peer_ids(self._session, message.conversation_id, user.id)
        if not recipients:
            return

        await self._bus.publish(
            Event(
                type=EventType.MESSAGE_REACTION,
                payload={
                    "conversation_id": message.conversation_id,
                    "message_id": message.id,
                    "user_id": user.id,
                    "emoji": emoji,
                },
                recipients=recipients,
            )
        )
