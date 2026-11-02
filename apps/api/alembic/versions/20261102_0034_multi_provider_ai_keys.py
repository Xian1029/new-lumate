"""Allow platform and personal AI keys to select a cloud provider.

Revision ID: 0034_multi_provider_ai_keys
Revises: 0033_multi_user_mvp
"""
from alembic import op
import sqlalchemy as sa

revision = "0034_multi_provider_ai_keys"
down_revision = "0033_multi_user_mvp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("platform_ai_settings", "user_ai_settings"):
        columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}
        with op.batch_alter_table(table) as batch:
            if "provider" not in columns:
                batch.add_column(sa.Column("provider", sa.String(32), nullable=False, server_default="deepseek"))
            if "model" not in columns:
                batch.add_column(sa.Column("model", sa.String(128), nullable=True))


def downgrade() -> None:
    for table in ("user_ai_settings", "platform_ai_settings"):
        with op.batch_alter_table(table) as batch:
            batch.drop_column("model")
            batch.drop_column("provider")
