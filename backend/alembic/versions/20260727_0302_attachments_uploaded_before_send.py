from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "df8a54f5a2a6"
down_revision: str | None = "1059fccdeba9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.add_column(sa.Column("uploaded_by", sa.String(length=26), nullable=True))
        batch_op.alter_column("message_id", existing_type=sa.VARCHAR(length=26), nullable=True)
        batch_op.create_foreign_key(
            batch_op.f("fk_attachments_uploaded_by"),
            "users",
            ["uploaded_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f("fk_attachments_uploaded_by"), type_="foreignkey")
        batch_op.alter_column("message_id", existing_type=sa.VARCHAR(length=26), nullable=False)
        batch_op.drop_column("uploaded_by")
