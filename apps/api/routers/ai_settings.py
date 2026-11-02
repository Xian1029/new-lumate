"""Minimal, server-only DeepSeek credential management."""
from datetime import datetime, timedelta, timezone
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.ai_settings import PlatformAISettings, UserAISettings
from models.user import User
from services.auth.dependency import get_current_user, require_super_admin

router = APIRouter()
_last_test: dict[str, float] = {}

def _mask(value: str | None) -> str | None:
    if not value:
        return None
    return f"****{value[-4:]}" if len(value) >= 4 else "****"

class KeyPayload(BaseModel):
    api_key: str = Field(min_length=8, max_length=512)

class PlatformPayload(BaseModel):
    api_key: str | None = Field(default=None, max_length=512)
    enabled: bool | None = None
    allow_personal_keys: bool | None = None

async def _platform(db: AsyncSession) -> PlatformAISettings:
    row = (await db.execute(select(PlatformAISettings).where(PlatformAISettings.id == 1))).scalar_one_or_none()
    if row is None:
        row = PlatformAISettings(id=1)
        db.add(row)
        await db.flush()
    return row

def _status(row: PlatformAISettings, personal: UserAISettings | None = None) -> dict:
    key = row.get_key()
    response = {"platform_key_configured": bool(key), "platform_key_enabled": bool(row.platform_key_enabled),
                "allow_personal_keys": bool(row.allow_personal_keys), "platform_key_masked": _mask(key)}
    effective_key = key if row.platform_key_enabled and key else None
    effective_source = "platform" if effective_key else None
    if personal is not None:
        pkey = personal.get_key()
        response.update({"personal_key_configured": bool(pkey), "personal_key_masked": _mask(pkey)})
        if not effective_key and row.allow_personal_keys and pkey:
            effective_key = pkey
            effective_source = "personal"
    response.update({"effective_key_available": bool(effective_key), "effective_key_source": effective_source})
    return response

def _rate_limit(scope: str) -> None:
    now = time.monotonic()
    if now - _last_test.get(scope, 0) < 15:
        raise HTTPException(status_code=429, detail="请稍后再测试 AI 服务")
    _last_test[scope] = now

async def _test_key(key: str, scope: str) -> dict:
    _rate_limit(scope)
    from services.llm.providers.openai_client import OpenAIClient
    try:
        client = OpenAIClient(key, "deepseek-chat", base_url="https://api.deepseek.com/v1", name="deepseek")
        text, _ = await client.extract("Reply only OK.", "health check")
        return {"ok": "OK" in text.upper(), "message": "连接成功" if "OK" in text.upper() else "服务响应异常"}
    except Exception:
        return {"ok": False, "message": "无法连接 AI 服务，请检查密钥或稍后重试"}

@router.get("/me")
async def get_personal_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    platform = await _platform(db)
    personal = (await db.execute(select(UserAISettings).where(UserAISettings.user_id == user.id))).scalar_one_or_none()
    return _status(platform, personal)

@router.put("/me")
async def save_personal_settings(body: KeyPayload, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    platform = await _platform(db)
    if not platform.allow_personal_keys:
        raise HTTPException(status_code=403, detail="管理员未允许配置个人 AI Key")
    row = (await db.execute(select(UserAISettings).where(UserAISettings.user_id == user.id))).scalar_one_or_none()
    if row is None:
        row = UserAISettings(user_id=user.id)
        db.add(row)
    row.set_key(body.api_key.strip())
    await db.commit()
    return _status(platform, row)

@router.delete("/me", status_code=204)
async def delete_personal_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(UserAISettings).where(UserAISettings.user_id == user.id))).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()

@router.post("/me/test")
async def test_personal_key(body: KeyPayload, user: User = Depends(get_current_user)):
    return await _test_key(body.api_key.strip(), f"user:{user.id}")

@router.post("/me/test-saved")
async def test_saved_key(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    platform = await _platform(db)
    personal = (await db.execute(select(UserAISettings).where(UserAISettings.user_id == user.id))).scalar_one_or_none()
    key = platform.get_key() if platform.platform_key_enabled else None
    if not key and platform.allow_personal_keys and personal:
        key = personal.get_key()
    if not key:
        raise HTTPException(status_code=400, detail="当前账号没有可用的 AI Key")
    return await _test_key(key, f"saved:{user.id}")

@router.get("/platform")
async def get_platform_settings(_: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    return _status(await _platform(db))

@router.put("/platform")
async def save_platform_settings(body: PlatformPayload, admin: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    row = await _platform(db)
    if body.api_key is not None:
        row.set_key(body.api_key.strip())
    if body.enabled is not None:
        row.platform_key_enabled = body.enabled
    if body.allow_personal_keys is not None:
        row.allow_personal_keys = body.allow_personal_keys
    row.updated_by_user_id = admin.id
    await db.commit()
    return _status(row)

@router.delete("/platform", status_code=204)
async def delete_platform_key(admin: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    row = await _platform(db)
    row.set_key(None)
    row.platform_key_enabled = False
    row.updated_by_user_id = admin.id
    await db.commit()

@router.post("/platform/test")
async def test_platform_key(body: KeyPayload, admin: User = Depends(require_super_admin)):
    return await _test_key(body.api_key.strip(), f"admin:{admin.id}")
