"""Add per-account learning-space creation permissions and quotas.

Revision ID: 0035_course_creation_policy
Revises: 0034_multi_provider_ai_keys
"""
from alembic import op
import sqlalchemy as sa

revision = "0035_course_creation_policy"
down_revision = "0034_multi_provider_ai_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    with op.batch_alter_table("users") as batch:
        if "can_create_courses" not in columns:
            batch.add_column(sa.Column("can_create_courses", sa.Boolean(), nullable=False, server_default=sa.true()))
        if "max_courses" not in columns:
            batch.add_column(sa.Column("max_courses", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("max_courses")
        batch.drop_column("can_create_courses")
