"""Add account roles, revocable sessions and encrypted AI credential tables.

Revision ID: 0033_multi_user_mvp
Revises: 0032_learning_progress_metadata
"""
from alembic import op
import sqlalchemy as sa

revision = "0033_multi_user_mvp"
down_revision = "0032_learning_progress_metadata"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind(); inspector = sa.inspect(bind)
    users = {c["name"] for c in inspector.get_columns("users")}
    with op.batch_alter_table("users") as batch:
        if "username" not in users: batch.add_column(sa.Column("username", sa.String(64), nullable=True))
        if "role" not in users: batch.add_column(sa.Column("role", sa.String(20), nullable=False, server_default="student"))
        if "must_change_password" not in users: batch.add_column(sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "updated_at" not in users: batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True, if_not_exists=True)
    if "user_sessions" not in inspector.get_table_names():
        op.create_table("user_sessions", sa.Column("id", sa.String(64), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    if "platform_ai_settings" not in inspector.get_table_names():
        op.create_table("platform_ai_settings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("encrypted_deepseek_api_key", sa.Text(), nullable=True), sa.Column("platform_key_enabled", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("allow_personal_keys", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("updated_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    if "user_ai_settings" not in inspector.get_table_names():
        op.create_table("user_ai_settings", sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("encrypted_deepseek_api_key", sa.Text(), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))

def downgrade() -> None:
    op.drop_table("user_ai_settings"); op.drop_table("platform_ai_settings"); op.drop_table("user_sessions")
