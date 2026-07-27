from collections.abc import Sequence

from alembic import op

revision: str = "b31c7de40915"
down_revision: str | None = "df8a54f5a2a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.create_unique_constraint("uq_attachments_url", ["url"])


def downgrade() -> None:
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.drop_constraint("uq_attachments_url", type_="unique")
