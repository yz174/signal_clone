from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import utcnow
from app.models import ConversationMember, User
from app.realtime.bus import EventBus
from app.realtime.events import Event, EventType


class PresenceService:
    def __init__(self, session: AsyncSession, bus: EventBus) -> None:
        self._session = session
        self._bus = bus

    async def announce(self, user: User, is_online: bool) -> None:
        user.last_seen_at = utcnow()
        await self._session.commit()

        peers = await self.peers_of(user.id)
        if not peers:
            return

        await self._bus.publish(
            Event(
                type=EventType.PRESENCE_UPDATED,
                payload={
                    "user_id": user.id,
                    "is_online": is_online,
                    "last_seen_at": user.last_seen_at.isoformat() if user.last_seen_at else None,
                },
                recipients=peers,
            )
        )

    async def peers_of(self, user_id: str) -> tuple[str, ...]:
        mine = select(ConversationMember.conversation_id).where(
            ConversationMember.user_id == user_id,
            ConversationMember.left_at.is_(None),
        )
        others = await self._session.scalars(
            select(ConversationMember.user_id)
            .where(
                ConversationMember.conversation_id.in_(mine),
                ConversationMember.user_id != user_id,
                ConversationMember.left_at.is_(None),
            )
            .distinct()
        )
        return tuple(others)
