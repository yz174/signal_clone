from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.db.base import utcnow
from app.models import (
    Conversation,
    ConversationMember,
    ConversationType,
    MemberRole,
    Message,
    User,
    direct_key_for,
)
from app.schemas.conversation import ConversationUpdate
from app.services.membership import require_membership

MAX_PAGE_SIZE = 50


@dataclass(frozen=True)
class ConversationView:
    conversation: Conversation
    unread_count: int
    last_message: Message | None


@dataclass(frozen=True)
class ConversationPage:
    items: list[ConversationView]
    next_cursor: str | None


def encode_cursor(last_activity_at: datetime, conversation_id: str) -> str:
    raw = f"{last_activity_at.isoformat()}|{conversation_id}"
    return urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        timestamp, conversation_id = urlsafe_b64decode(cursor.encode()).decode().split("|", 1)
        return datetime.fromisoformat(timestamp), conversation_id
    except (ValueError, TypeError) as exc:
        raise ValidationError("Malformed cursor") from exc


class ConversationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_direct(self, user: User, other_user_id: str) -> ConversationView:
        if other_user_id == user.id:
            raise ValidationError("Cannot start a direct conversation with yourself")

        other = await self._session.get(User, other_user_id)
        if other is None:
            raise NotFoundError("User not found")

        key = direct_key_for(user.id, other.id)
        existing = await self._by_direct_key(key)
        if existing is not None:
            return await self.get(user, existing.id)

        conversation = Conversation(
            type=ConversationType.DIRECT,
            created_by=user.id,
            direct_key=key,
            last_activity_at=utcnow(),
        )
        conversation.members = [
            ConversationMember(user_id=user.id),
            ConversationMember(user_id=other.id),
        ]
        self._session.add(conversation)

        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raced = await self._by_direct_key(key)
            if raced is None:
                raise
            return await self.get(user, raced.id)

        return await self.get(user, conversation.id)

    async def create_group(
        self,
        user: User,
        name: str,
        member_ids: list[str],
        description: str | None,
    ) -> ConversationView:
        wanted = list(dict.fromkeys([user.id, *member_ids]))
        found = await self._session.scalars(select(User.id).where(User.id.in_(wanted)))
        missing = set(wanted) - set(found.all())
        if missing:
            raise NotFoundError("Unknown user", {"user_ids": sorted(missing)})

        conversation = Conversation(
            type=ConversationType.GROUP,
            name=name,
            description=description,
            created_by=user.id,
            last_activity_at=utcnow(),
        )
        conversation.members = [
            ConversationMember(
                user_id=member_id,
                role=MemberRole.ADMIN if member_id == user.id else MemberRole.MEMBER,
            )
            for member_id in wanted
        ]
        self._session.add(conversation)
        await self._session.commit()

        return await self.get(user, conversation.id)

    async def get(self, user: User, conversation_id: str) -> ConversationView:
        member = await require_membership(self._session, conversation_id, user.id)

        conversation = await self._session.scalar(
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(selectinload(Conversation.members).joinedload(ConversationMember.user))
        )
        if conversation is None:
            raise NotFoundError("Conversation not found")

        conversation.members = [entry for entry in conversation.members if entry.left_at is None]
        last_message = (
            await self._session.get(Message, conversation.last_message_id)
            if conversation.last_message_id
            else None
        )
        return ConversationView(
            conversation=conversation,
            unread_count=member.unread_count,
            last_message=last_message,
        )

    async def list_for_user(self, user: User, cursor: str | None, limit: int) -> ConversationPage:
        limit = min(limit, MAX_PAGE_SIZE)

        query = (
            select(Conversation)
            .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
            .where(
                ConversationMember.user_id == user.id,
                ConversationMember.left_at.is_(None),
            )
            .options(selectinload(Conversation.members).joinedload(ConversationMember.user))
            .order_by(Conversation.last_activity_at.desc(), Conversation.id.desc())
            .limit(limit + 1)
        )

        if cursor is not None:
            activity, conversation_id = decode_cursor(cursor)
            query = query.where(
                or_(
                    Conversation.last_activity_at < activity,
                    (Conversation.last_activity_at == activity)
                    & (Conversation.id < conversation_id),
                )
            )

        rows = list(await self._session.scalars(query))
        has_more = len(rows) > limit
        conversations = rows[:limit]

        for conversation in conversations:
            conversation.members = [
                member for member in conversation.members if member.left_at is None
            ]

        views = await self._build_views(conversations, user.id)
        next_cursor = (
            encode_cursor(conversations[-1].last_activity_at, conversations[-1].id)
            if has_more and conversations
            else None
        )
        return ConversationPage(items=views, next_cursor=next_cursor)

    async def _build_views(
        self, conversations: list[Conversation], viewer_id: str
    ) -> list[ConversationView]:
        message_ids = [
            conversation.last_message_id
            for conversation in conversations
            if conversation.last_message_id
        ]
        previews: dict[str, Message] = {}
        if message_ids:
            found = await self._session.scalars(select(Message).where(Message.id.in_(message_ids)))
            previews = {message.id: message for message in found}

        views = []
        for conversation in conversations:
            mine = next(member for member in conversation.members if member.user_id == viewer_id)
            views.append(
                ConversationView(
                    conversation=conversation,
                    unread_count=mine.unread_count,
                    last_message=previews.get(conversation.last_message_id or ""),
                )
            )
        return views

    async def update(
        self, user: User, conversation_id: str, changes: ConversationUpdate
    ) -> ConversationView:
        conversation = await self._require_group(conversation_id)
        await self._require_admin(conversation_id, user.id)

        for field, value in changes.model_dump(exclude_unset=True).items():
            setattr(conversation, field, value)

        await self._session.commit()
        return await self.get(user, conversation_id)

    async def add_members(
        self, user: User, conversation_id: str, user_ids: list[str]
    ) -> ConversationView:
        await self._require_group(conversation_id)
        await self._require_admin(conversation_id, user.id)

        wanted = list(dict.fromkeys(user_ids))
        found = await self._session.scalars(select(User.id).where(User.id.in_(wanted)))
        missing = set(wanted) - set(found.all())
        if missing:
            raise NotFoundError("Unknown user", {"user_ids": sorted(missing)})

        for member_id in wanted:
            existing = await self._session.get(
                ConversationMember, {"conversation_id": conversation_id, "user_id": member_id}
            )
            if existing is None:
                self._session.add(
                    ConversationMember(conversation_id=conversation_id, user_id=member_id)
                )
            elif existing.left_at is not None:
                existing.left_at = None
                existing.joined_at = utcnow()
                existing.role = MemberRole.MEMBER

        await self._session.commit()
        return await self.get(user, conversation_id)

    async def remove_member(self, user: User, conversation_id: str, member_id: str) -> None:
        await self._require_group(conversation_id)
        await self._require_admin(conversation_id, user.id)

        member = await require_membership(self._session, conversation_id, member_id)
        member.left_at = utcnow()
        await self._session.commit()

    async def leave(self, user: User, conversation_id: str) -> None:
        conversation = await self._require_group(conversation_id)
        member = await require_membership(self._session, conversation_id, user.id)

        leaves_no_admin = (
            member.role is MemberRole.ADMIN and await self._admin_count(conversation_id) == 1
        )
        member.left_at = utcnow()

        if leaves_no_admin:
            successor = await self._session.scalar(
                select(ConversationMember)
                .where(
                    ConversationMember.conversation_id == conversation.id,
                    ConversationMember.left_at.is_(None),
                    ConversationMember.user_id != user.id,
                )
                .order_by(ConversationMember.joined_at)
                .limit(1)
            )
            if successor is not None:
                successor.role = MemberRole.ADMIN

        await self._session.commit()

    async def set_role(
        self, user: User, conversation_id: str, member_id: str, role: MemberRole
    ) -> ConversationView:
        await self._require_group(conversation_id)
        await self._require_admin(conversation_id, user.id)

        member = await require_membership(self._session, conversation_id, member_id)
        demoting_last_admin = (
            member.role is MemberRole.ADMIN
            and role is MemberRole.MEMBER
            and await self._admin_count(conversation_id) == 1
        )
        if demoting_last_admin:
            raise ConflictError("A group must keep at least one admin")

        member.role = role
        await self._session.commit()
        return await self.get(user, conversation_id)

    async def _by_direct_key(self, key: str) -> Conversation | None:
        matches = await self._session.scalars(
            select(Conversation)
            .where(Conversation.direct_key == key)
            .options(selectinload(Conversation.members).joinedload(ConversationMember.user))
        )
        return matches.first()

    async def _require_admin(self, conversation_id: str, user_id: str) -> ConversationMember:
        member = await require_membership(self._session, conversation_id, user_id)
        if member.role is not MemberRole.ADMIN:
            raise ForbiddenError("Only admins can do that")
        return member

    async def _require_group(self, conversation_id: str) -> Conversation:
        conversation = await self._session.get(Conversation, conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation not found")
        if conversation.type is not ConversationType.GROUP:
            raise ValidationError("This action only applies to group conversations")
        return conversation

    async def _admin_count(self, conversation_id: str) -> int:
        admins = await self._session.scalars(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.left_at.is_(None),
                ConversationMember.role == MemberRole.ADMIN,
            )
        )
        return len(admins.all())
