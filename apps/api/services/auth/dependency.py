"""FastAPI dependency for user authentication.

When AUTH_ENABLED=false (default), falls back to single-user local mode.
When AUTH_ENABLED=true, requires a valid JWT bearer token.
"""

import uuid
import hashlib
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User

security = HTTPBearer(auto_error=False)
SCHEMA_INIT_DETAIL = "Database schema is not initialized. Run 'alembic upgrade head' before starting the API."


def _is_missing_user_table(exc: ProgrammingError) -> bool:
    message = str(exc).lower()
    return 'relation "users" does not exist' in message or "no such table: users" in message


async def _execute_user_query(db: AsyncSession, query):
    try:
        return await db.execute(query)
    except ProgrammingError as exc:
        if _is_missing_user_table(exc):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=SCHEMA_INIT_DETAIL,
            ) from exc
        raise


async def get_current_user(
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> User:
    """Resolve the current user from JWT or fall back to local user."""
    if settings.deployment_mode == "single_user" and not settings.auth_enabled:
        # Explicit single-user deployment mode.
        # A production database may already contain several JWT accounts.
        # Always resolve the same existing account when switching to the
        # single-user profile, regardless of database row iteration order.
        result = await _execute_user_query(
            db, select(User).order_by(User.created_at.asc(), User.id.asc()).limit(1)
        )
        user = result.scalar_one_or_none()
        if not user:
            user = User(name="Owner")
            db.add(user)
            await db.commit()
            await db.refresh(user)
        if request is not None:
            request.state.user_id = str(user.id)
            request.state.deployment_mode = settings.deployment_mode
        return user

    if not settings.auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_ENABLED must be true when DEPLOYMENT_MODE is multi_user",
        )

    cookie_session = request.cookies.get("lumate_session") if request is not None else None
    if not cookie_session and not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        if cookie_session:
            from models.user import UserSession
            digest = hashlib.sha256(cookie_session.encode()).hexdigest()
            session = (await _execute_user_query(db, select(UserSession).where(UserSession.id == digest))).scalar_one_or_none()
            if not session or session.expires_at <= datetime.now(timezone.utc):
                raise ValueError("expired session")
            user_id = session.user_id
        else:
            # Temporary API compatibility for existing clients during rollout.
            from services.auth.jwt import decode_token
            payload = decode_token(credentials.credentials)
            if payload.get("type") != "access":
                raise ValueError("invalid token type")
            user_id = uuid.UUID(payload["sub"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    result = await _execute_user_query(db, select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if request is not None:
        request.state.user_id = str(user.id)
        request.state.deployment_mode = settings.deployment_mode
    return user


async def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """Server-side role guard; UI visibility is never an authorization check."""
    if user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可访问")
    return user
