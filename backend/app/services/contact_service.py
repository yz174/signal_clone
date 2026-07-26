from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models import Contact, User

MAX_SEARCH_RESULTS = 25


@dataclass(frozen=True)
class ContactEntry:
    user: User
    nickname: str | None


class ContactService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_user(self, user: User) -> list[ContactEntry]:
        rows = await self._session.execute(
            select(Contact, User)
            .join(User, User.id == Contact.contact_user_id)
            .where(Contact.owner_id == user.id)
            .order_by(User.display_name)
        )
        return [
            ContactEntry(user=contact_user, nickname=contact.nickname)
            for contact, contact_user in rows
        ]

    async def add(self, user: User, contact_user_id: str, nickname: str | None) -> ContactEntry:
        if contact_user_id == user.id:
            raise ValidationError("Cannot add yourself as a contact")

        contact_user = await self._session.get(User, contact_user_id)
        if contact_user is None:
            raise NotFoundError("User not found")

        self._session.add(
            Contact(owner_id=user.id, contact_user_id=contact_user_id, nickname=nickname)
        )
        try:
            await self._session.commit()
        except IntegrityError as exc:
            await self._session.rollback()
            raise ConflictError("Already in your contacts") from exc

        return ContactEntry(user=contact_user, nickname=nickname)

    async def remove(self, user: User, contact_user_id: str) -> None:
        contact = await self._session.get(
            Contact, {"owner_id": user.id, "contact_user_id": contact_user_id}
        )
        if contact is None:
            raise NotFoundError("Contact not found")

        await self._session.delete(contact)
        await self._session.commit()

    async def search_directory(self, user: User, query: str) -> list[User]:
        pattern = f"%{query.strip()}%"
        matches = await self._session.scalars(
            select(User)
            .where(
                User.id != user.id,
                or_(
                    User.phone_e164.ilike(pattern),
                    User.username.ilike(pattern),
                    User.display_name.ilike(pattern),
                ),
            )
            .order_by(User.display_name)
            .limit(MAX_SEARCH_RESULTS)
        )
        return list(matches)
