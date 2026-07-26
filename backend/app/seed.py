import asyncio
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.avatars import pick_avatar_color
from app.db.base import utcnow
from app.db.session import SessionFactory
from app.models import (
    Contact,
    Conversation,
    ConversationMember,
    ConversationType,
    MemberRole,
    User,
    direct_key_for,
)

SEED_PEOPLE = [
    ("+15550100001", "ava", "Ava Mitchell", "Building things on the internet"),
    ("+15550100002", "noah", "Noah Berger", "Coffee first"),
    ("+15550100003", "mia", "Mia Fernandes", "Designer. Cat person."),
    ("+15550100004", "liam", "Liam O'Donnell", None),
    ("+15550100005", "zoe", "Zoe Nakamura", "Away from keyboard"),
    ("+15550100006", "kai", "Kai Ramirez", "Runner, reader"),
    ("+15550100007", "ines", "Inés Duarte", None),
    ("+15550100008", "omar", "Omar Haddad", "Backend gremlin"),
    ("+15550100009", "sara", "Sara Lindqvist", "Photos: @sara"),
    ("+15550100010", "theo", "Theo Almeida", None),
]

DEMO_PHONE = SEED_PEOPLE[0][0]

DIRECT_PARTNERS = ["noah", "mia", "liam", "zoe", "kai"]

SEED_GROUPS = [
    ("Design Review", "Weekly critique + handoff", ["ava", "noah", "mia", "sara"], "ava"),
    ("Weekend Trip", "Logistics for the cabin", ["ava", "liam", "zoe", "kai", "theo"], "liam"),
]


@dataclass(frozen=True)
class SeedSummary:
    users: int
    contacts: int
    conversations: int
    memberships: int

    def __str__(self) -> str:
        return (
            f"{self.users} users, {self.contacts} contacts, "
            f"{self.conversations} conversations, {self.memberships} memberships"
        )


async def _already_seeded(session: AsyncSession) -> bool:
    count = await session.scalar(select(func.count()).select_from(User))
    return bool(count)


def _build_users() -> dict[str, User]:
    people = {}
    for index, (phone, username, display_name, about) in enumerate(SEED_PEOPLE):
        user = User(
            phone_e164=phone,
            username=username,
            display_name=display_name,
            about=about,
            avatar_color=pick_avatar_color(phone),
            last_seen_at=utcnow() - timedelta(minutes=index * 7),
        )
        people[username] = user
    return people


def _build_conversations(people: dict[str, User]) -> tuple[list[Conversation], int]:
    demo = people["ava"]
    conversations: list[Conversation] = []
    memberships = 0
    now = utcnow()

    for index, partner_username in enumerate(DIRECT_PARTNERS):
        partner = people[partner_username]
        conversation = Conversation(
            type=ConversationType.DIRECT,
            created_by=demo.id,
            direct_key=direct_key_for(demo.id, partner.id),
            last_activity_at=now - timedelta(minutes=index * 25),
        )
        conversation.members = [
            ConversationMember(user_id=demo.id, role=MemberRole.MEMBER),
            ConversationMember(user_id=partner.id, role=MemberRole.MEMBER),
        ]
        memberships += 2
        conversations.append(conversation)

    for index, (name, description, usernames, admin_username) in enumerate(SEED_GROUPS):
        admin = people[admin_username]
        conversation = Conversation(
            type=ConversationType.GROUP,
            name=name,
            description=description,
            created_by=admin.id,
            last_activity_at=now - timedelta(hours=index + 1),
        )
        conversation.members = [
            ConversationMember(
                user_id=people[username].id,
                role=MemberRole.ADMIN if username == admin_username else MemberRole.MEMBER,
            )
            for username in usernames
        ]
        memberships += len(usernames)
        conversations.append(conversation)

    return conversations, memberships


def _build_contacts(people: dict[str, User]) -> list[Contact]:
    demo = people["ava"]
    contacts = [
        Contact(owner_id=demo.id, contact_user_id=user.id)
        for user in people.values()
        if user.id != demo.id
    ]
    contacts += [
        Contact(owner_id=people[username].id, contact_user_id=demo.id)
        for username in DIRECT_PARTNERS
    ]
    return contacts


async def seed(session: AsyncSession) -> SeedSummary | None:
    if await _already_seeded(session):
        return None

    people = _build_users()
    session.add_all(people.values())
    await session.flush()

    contacts = _build_contacts(people)
    conversations, memberships = _build_conversations(people)
    session.add_all(contacts)
    session.add_all(conversations)
    await session.commit()

    return SeedSummary(
        users=len(people),
        contacts=len(contacts),
        conversations=len(conversations),
        memberships=memberships,
    )


async def main() -> None:
    async with SessionFactory() as session:
        summary = await seed(session)
    print(f"Seeded {summary}" if summary else "Database already contains users; nothing to do.")


if __name__ == "__main__":
    asyncio.run(main())
