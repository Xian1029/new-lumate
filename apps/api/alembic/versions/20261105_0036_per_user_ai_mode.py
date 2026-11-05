"""Allow administrators to select AI credential use per account."""
from alembic import op
import sqlalchemy as sa

revision = "0036_per_user_ai_mode"
down_revision = "0035_course_creation_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "ai_key_mode" not in columns:
        with op.batch_alter_table("users") as batch:
            batch.add_column(sa.Column("ai_key_mode", sa.String(16), nullable=False, server_default="auto"))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("ai_key_mode")
