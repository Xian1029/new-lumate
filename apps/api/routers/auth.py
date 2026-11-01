"""Authentication endpoints for student and administrator accounts."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, UserResponse
from services.auth.dependency import get_current_user, require_super_admin
from pydantic import BaseModel
import uuid
from services.auth.password import hash_password, verify_password

router = APIRouter()


class AdminAccountRequest(RegisterRequest):
    pass


class AdminAccountStatus(BaseModel):
    is_active: bool


@router.get("/admin/users")
async def list_users(_: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(User).where(User.role == "student").order_by(User.created_at.desc()))).scalars().all()
    return [{**_user_response(user).model_dump(), "is_active": user.is_active} for user in users]


@router.post("/admin/users", status_code=201)
async def create_user(body: AdminAccountRequest, _: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    username = body.username.strip().lower()
    if username == "admin" or (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="用户名不可用")
    user = User(username=username, name=(body.name or username), role="student", hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {**_user_response(user).model_dump(), "is_active": True}


async def _managed_student(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = (await db.execute(select(User).where(User.id == user_id, User.role == "student"))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="普通账号不存在")
    return user


@router.patch("/admin/users/{user_id}")
async def change_user_status(user_id: uuid.UUID, body: AdminAccountStatus, _: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    user = await _managed_student(db, user_id)
    user.is_active = body.is_active
    if not user.is_active:
        from models.user import UserSession
        await db.execute(UserSession.__table__.delete().where(UserSession.user_id == user.id))
    await db.commit()
    return {**_user_response(user).model_dump(), "is_active": user.is_active}


@router.delete("/admin/users/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, _: User = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    user = await _managed_student(db, user_id)
    from models.course import Course
    from models.ingestion import IngestionJob
    from models.learning_plan import LearningPlan
    for model in (Course, IngestionJob, LearningPlan):
        if await db.scalar(select(func.count()).select_from(model).where(model.user_id == user.id)):
            raise HTTPException(status_code=409, detail="该账号已有学习数据，请先停用；为防止数据丢失，暂不支持永久删除")
    from models.user import UserSession
    await db.execute(UserSession.__table__.delete().where(UserSession.user_id == user.id))
    await db.delete(user)
    await db.commit()


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id), email=user.email, name=user.name,
        username=user.username, role=user.role,
        must_change_password=user.must_change_password,
    )


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    username = body.username.strip().lower()
    if username == "admin":
        raise HTTPException(status_code=400, detail="该用户名不可注册")
    if (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="用户名已存在")
    user = User(username=username, name=(body.name or username), role="student", hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_response(user)


@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    username = body.username.strip().lower()
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已停用")
    from models.user import UserSession
    raw_session = secrets.token_urlsafe(32)
    db.add(UserSession(id=hashlib.sha256(raw_session.encode()).hexdigest(), user_id=user.id,
                       expires_at=datetime.now(timezone.utc) + timedelta(days=14)))
    await db.commit()
    from config import settings
    response.set_cookie("lumate_session", raw_session, httponly=True,
                        secure=settings.environment in {"production", "staging"}, samesite="lax", max_age=1209600, path="/")
    return _user_response(user)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from models.user import UserSession
    raw = request.cookies.get("lumate_session")
    if raw:
        await db.execute(UserSession.__table__.delete().where(UserSession.id == hashlib.sha256(raw.encode()).hexdigest()))
        await db.commit()
    response.delete_cookie("lumate_session", path="/")
    return None


@router.post("/change-password", response_model=UserResponse)
async def change_password(body: ChangePasswordRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # A forced first change follows a successful password login in the same
    # authenticated session, so asking for the bootstrap password a second
    # time only creates avoidable lockouts. Normal password changes still
    # require the current password.
    if not user.must_change_password and (
        not user.hashed_password or not verify_password(body.current_password, user.hashed_password)
    ):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    user.hashed_password = hash_password(body.new_password)
    user.must_change_password = False
    await db.commit()
    await db.refresh(user)
    return _user_response(user)
