from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.db.base import utcnow
from app.models import Conversation, ConversationMember, Message, MessageKind, User
from app.realtime.bus import EventBus
from app.realtime.events import Event, EventType
from app.schemas.message import MessageOut
from app.services.attachment_service import claim_attachments
from app.services.membership import peer_ids, require_membership

MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class MessagePage:
    items: list[Message]
    has_more: bool


class MessageService:
    def __init__(self, session: AsyncSession, bus: EventBus | None = None) -> None:
        self._session = session
        self._bus = bus

    async def send(
        self,
        user: User,
        conversation_id: str,
        client_message_id: str,
        body: str,
        reply_to_id: str | None,
        attachment_ids: list[str] | None = None,
    ) -> Message:
        await require_membership(self._session, conversation_id, user.id)

        duplicate = await self._by_client_message_id(user.id, client_message_id)
        if duplicate is not None:
            return duplicate

        conversation = await self._session.get(Conversation, conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation not found")

        if not body.strip() and not attachment_ids:
            raise ValidationError("A message needs text or an attachment")

        if reply_to_id is not None:
            await self._require_message_in(conversation_id, reply_to_id)

        now = utcnow()
        seq = await self._next_seq(conversation_id, now)

        message = Message(
            conversation_id=conversation_id,
            seq=seq,
            sender_id=user.id,
            kind=MessageKind.TEXT,
            body=body,
            reply_to_id=reply_to_id,
            client_message_id=client_message_id,
            created_at=now,
            expires_at=(
                now + timedelta(seconds=conversation.disappear_seconds)
                if conversation.disappear_seconds
                else None
            ),
        )
        message.reactions = []
        message.attachments = []
        self._session.add(message)
        await self._session.flush()

        if attachment_ids:
            message.attachments = await claim_attachments(
                self._session, user, attachment_ids, message.id
            )
            message.kind = MessageKind.MEDIA

        conversation.last_message_id = message.id
        await self._bump_unread(conversation_id, sender_id=user.id)
        await self._advance_sender_cursors(conversation_id, user.id, seq)

        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raced = await self._by_client_message_id(user.id, client_message_id)
            if raced is None:
                raise
            return raced

        await self._publish(
            EventType.MESSAGE_CREATED,
            {"conversation_id": conversation_id, "message": _message_payload(message)},
            await peer_ids(self._session, conversation_id, user.id),
        )
        return message

    async def list_for_conversation(
        self,
        user: User,
        conversation_id: str,
        before_seq: int | None,
        after_seq: int | None,
        limit: int,
    ) -> MessagePage:
        await require_membership(self._session, conversation_id, user.id)
        limit = min(limit, MAX_PAGE_SIZE)

        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.reactions), selectinload(Message.attachments))
        )

        if after_seq is not None:
            query = query.where(Message.seq > after_seq).order_by(Message.seq).limit(limit + 1)
            rows = list(await self._session.scalars(query))
            has_more = len(rows) > limit
            return MessagePage(items=rows[:limit], has_more=has_more)

        if before_seq is not None:
            query = query.where(Message.seq < before_seq)

        rows = list(
            await self._session.scalars(query.order_by(Message.seq.desc()).limit(limit + 1))
        )
        has_more = len(rows) > limit
        return MessagePage(items=list(reversed(rows[:limit])), has_more=has_more)

    async def delete(self, user: User, message_id: str) -> Message:
        message = await self._load(message_id)

        await require_membership(self._session, message.conversation_id, user.id)

        if message.sender_id != user.id:
            raise ForbiddenError("Only the sender can delete a message")

        if message.deleted_at is None:
            message.deleted_at = utcnow()
            message.body = None
            await self._session.commit()
            await self._publish(
                EventType.MESSAGE_DELETED,
                {"conversation_id": message.conversation_id, "message_id": message.id},
                await peer_ids(self._session, message.conversation_id, user.id),
            )

        return message

    async def mark_read(self, user: User, conversation_id: str, seq: int) -> ConversationMember:
        member = await require_membership(self._session, conversation_id, user.id)

        if seq > member.last_read_seq:
            member.last_read_seq = seq
        if seq > member.last_delivered_seq:
            member.last_delivered_seq = seq

        member.unread_count = await self._count_unread(
            conversation_id, user.id, member.last_read_seq
        )
        await self._session.commit()
        await self._publish_receipt(member)

        return member

    async def mark_delivered(
        self, user: User, conversation_id: str, seq: int
    ) -> ConversationMember:
        member = await require_membership(self._session, conversation_id, user.id)

        if seq > member.last_delivered_seq:
            member.last_delivered_seq = seq
            await self._session.commit()
            await self._publish_receipt(member)

        return member

    async def _publish_receipt(self, member: ConversationMember) -> None:
        await self._publish(
            EventType.RECEIPT_UPDATED,
            {
                "conversation_id": member.conversation_id,
                "user_id": member.user_id,
                "last_read_seq": member.last_read_seq,
                "last_delivered_seq": member.last_delivered_seq,
            },
            await peer_ids(self._session, member.conversation_id, member.user_id),
        )

    async def _publish(
        self, event_type: EventType, payload: dict[str, object], recipients: tuple[str, ...]
    ) -> None:
        if self._bus is None or not recipients:
            return
        await self._bus.publish(Event(type=event_type, payload=payload, recipients=recipients))

    async def _load(self, message_id: str) -> Message:
        message = await self._session.scalar(
            select(Message)
            .where(Message.id == message_id)
            .options(selectinload(Message.reactions), selectinload(Message.attachments))
        )
        if message is None:
            raise NotFoundError("Message not found")
        return message

    async def _next_seq(self, conversation_id: str, now: datetime) -> int:
        result = await self._session.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(last_seq=Conversation.last_seq + 1, last_activity_at=now)
            .returning(Conversation.last_seq)
        )
        return result.scalar_one()

    async def _bump_unread(self, conversation_id: str, sender_id: str) -> None:
        await self._session.execute(
            update(ConversationMember)
            .where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id != sender_id,
                ConversationMember.left_at.is_(None),
            )
            .values(unread_count=ConversationMember.unread_count + 1)
        )

    async def _advance_sender_cursors(self, conversation_id: str, sender_id: str, seq: int) -> None:
        await self._session.execute(
            update(ConversationMember)
            .where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == sender_id,
            )
            .values(last_read_seq=seq, last_delivered_seq=seq, unread_count=0)
        )

    async def _count_unread(self, conversation_id: str, user_id: str, read_seq: int) -> int:
        total = await self._session.scalar(
            select(func.count())
            .select_from(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.seq > read_seq,
                Message.sender_id != user_id,
                Message.deleted_at.is_(None),
            )
        )
        return int(total or 0)

    async def _by_client_message_id(self, sender_id: str, client_message_id: str) -> Message | None:
        matches = await self._session.scalars(
            select(Message).where(
                Message.sender_id == sender_id,
                Message.client_message_id == client_message_id,
            )
        )
        return matches.first()

    async def _require_message_in(self, conversation_id: str, message_id: str) -> Message:
        message = await self._session.get(Message, message_id)
        if message is None or message.conversation_id != conversation_id:
            raise ValidationError("Cannot reply to a message from another conversation")
        return message


def _message_payload(message: Message) -> dict[str, object]:
    return MessageOut.model_validate(message).model_dump(mode="json")
