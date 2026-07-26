"""initial schema

Revision ID: 1059fccdeba9
Revises:
Create Date: 2026-07-26 20:24:17.069559
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "1059fccdeba9"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("phone_e164", sa.String(length=20), nullable=False),
        sa.Column("username", sa.String(length=32), nullable=True),
        sa.Column("display_name", sa.String(length=64), nullable=False),
        sa.Column("about", sa.String(length=140), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("avatar_color", sa.String(length=16), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=26), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("phone_e164", name=op.f("uq_users_phone_e164")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
    )
    op.create_table(
        "verification_codes",
        sa.Column("phone_e164", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=26), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_verification_codes")),
    )
    with op.batch_alter_table("verification_codes", schema=None) as batch_op:
        batch_op.create_index(
            "ix_verification_codes_phone_expires", ["phone_e164", "expires_at"], unique=False
        )

    op.create_table(
        "auth_sessions",
        sa.Column("user_id", sa.String(length=26), nullable=False),
        sa.Column("refresh_token_hash", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=26), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_auth_sessions_user_id"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_sessions")),
        sa.UniqueConstraint("refresh_token_hash", name=op.f("uq_auth_sessions_refresh_token_hash")),
    )
    with op.batch_alter_table("auth_sessions", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_auth_sessions_user_id"), ["user_id"], unique=False)

    op.create_table(
        "contacts",
        sa.Column("owner_id", sa.String(length=26), nullable=False),
        sa.Column("contact_user_id", sa.String(length=26), nullable=False),
        sa.Column("nickname", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("owner_id <> contact_user_id", name=op.f("ck_contacts_no_self_contact")),
        sa.ForeignKeyConstraint(
            ["contact_user_id"],
            ["users.id"],
            name=op.f("fk_contacts_contact_user_id"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_contacts_owner_id"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("owner_id", "contact_user_id", name=op.f("pk_contacts")),
    )
    op.create_table(
        "conversations",
        sa.Column(
            "type",
            sa.Enum(
                "direct",
                "group",
                name="conversation_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=64), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=26), nullable=True),
        sa.Column("direct_key", sa.String(length=64), nullable=True),
        sa.Column("last_seq", sa.Integer(), nullable=False),
        sa.Column("last_message_id", sa.String(length=26), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("disappear_seconds", sa.Integer(), nullable=True),
        sa.Column("id", sa.String(length=26), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_conversations_created_by"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_conversations")),
        sa.UniqueConstraint("direct_key", name=op.f("uq_conversations_direct_key")),
    )
    with op.batch_alter_table("conversations", schema=None) as batch_op:
        batch_op.create_index(
            "ix_conversations_last_activity_at", ["last_activity_at"], unique=False
        )

    op.create_table(
        "conversation_members",
        sa.Column("conversation_id", sa.String(length=26), nullable=False),
        sa.Column("user_id", sa.String(length=26), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "admin", "member", name="member_role", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_read_seq", sa.Integer(), nullable=False),
        sa.Column("last_delivered_seq", sa.Integer(), nullable=False),
        sa.Column("unread_count", sa.Integer(), nullable=False),
        sa.Column("muted_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_conversation_members_conversation_id"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_conversation_members_user_id"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("conversation_id", "user_id", name=op.f("pk_conversation_members")),
    )
    with op.batch_alter_table("conversation_members", schema=None) as batch_op:
        batch_op.create_index(
            "ix_conversation_members_user_id_left_at", ["user_id", "left_at"], unique=False
        )

    op.create_table(
        "messages",
        sa.Column("conversation_id", sa.String(length=26), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.String(length=26), nullable=True),
        sa.Column(
            "kind",
            sa.Enum(
                "text",
                "media",
                "system",
                name="message_kind",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("system_event", sa.JSON(), nullable=True),
        sa.Column("reply_to_id", sa.String(length=26), nullable=True),
        sa.Column("client_message_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=26), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_messages_conversation_id"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reply_to_id"],
            ["messages.id"],
            name=op.f("fk_messages_reply_to_id"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"], ["users.id"], name=op.f("fk_messages_sender_id"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_messages")),
        sa.UniqueConstraint("conversation_id", "seq", name="uq_messages_conversation_seq"),
        sa.UniqueConstraint(
            "sender_id", "client_message_id", name="uq_messages_sender_client_message_id"
        ),
    )
    with op.batch_alter_table("messages", schema=None) as batch_op:
        batch_op.create_index(
            "ix_messages_conversation_id_seq", ["conversation_id", "seq"], unique=False
        )
        batch_op.create_index("ix_messages_expires_at", ["expires_at"], unique=False)

    op.create_table(
        "attachments",
        sa.Column("message_id", sa.String(length=26), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "image", "file", name="attachment_kind", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=26), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_attachments_message_id"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attachments")),
    )
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_attachments_message_id"), ["message_id"], unique=False)

    op.create_table(
        "reactions",
        sa.Column("message_id", sa.String(length=26), nullable=False),
        sa.Column("user_id", sa.String(length=26), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_reactions_message_id"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_reactions_user_id"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("message_id", "user_id", name=op.f("pk_reactions")),
    )


def downgrade() -> None:
    op.drop_table("reactions")
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_attachments_message_id"))

    op.drop_table("attachments")
    with op.batch_alter_table("messages", schema=None) as batch_op:
        batch_op.drop_index("ix_messages_expires_at")
        batch_op.drop_index("ix_messages_conversation_id_seq")

    op.drop_table("messages")
    with op.batch_alter_table("conversation_members", schema=None) as batch_op:
        batch_op.drop_index("ix_conversation_members_user_id_left_at")

    op.drop_table("conversation_members")
    with op.batch_alter_table("conversations", schema=None) as batch_op:
        batch_op.drop_index("ix_conversations_last_activity_at")

    op.drop_table("conversations")
    op.drop_table("contacts")
    with op.batch_alter_table("auth_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_auth_sessions_user_id"))

    op.drop_table("auth_sessions")
    with op.batch_alter_table("verification_codes", schema=None) as batch_op:
        batch_op.drop_index("ix_verification_codes_phone_expires")

    op.drop_table("verification_codes")
    op.drop_table("users")
