"""Per-platform and per-user AI credential records.

Secrets are encrypted by the model helpers and are never serialized in API
responses.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from models.compat import CompatUUID


class PlatformAISettings(Base):
    __tablename__ = "platform_ai_settings"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    encrypted_deepseek_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    platform_key_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allow_personal_keys: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(CompatUUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def set_key(self, value: str | None) -> None:
        from libs.encryption import encrypt_value
        self.encrypted_deepseek_api_key = encrypt_value(value or "") or None

    def get_key(self) -> str | None:
        from libs.encryption import decrypt_value
        return decrypt_value(self.encrypted_deepseek_api_key or "") or None


class UserAISettings(Base):
    __tablename__ = "user_ai_settings"
    user_id: Mapped[uuid.UUID] = mapped_column(CompatUUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    encrypted_deepseek_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def set_key(self, value: str | None) -> None:
        from libs.encryption import encrypt_value
        self.encrypted_deepseek_api_key = encrypt_value(value or "") or None

    def get_key(self) -> str | None:
        from libs.encryption import decrypt_value
        return decrypt_value(self.encrypted_deepseek_api_key or "") or None
