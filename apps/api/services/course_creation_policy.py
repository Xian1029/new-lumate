"""Server-side learning-space creation policy shared by creation paths."""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.course import Course
from models.user import User


async def course_creation_status(db: AsyncSession, user: User) -> dict:
    current_count = await db.scalar(select(func.count()).select_from(Course).where(
        Course.user_id == user.id, Course.status != "TRASHED",
    )) or 0
    is_admin = user.role == "super_admin"
    allowed = is_admin or (user.can_create_courses and (user.max_courses is None or current_count < user.max_courses))
    return {
        "can_create_courses": is_admin or user.can_create_courses,
        "max_courses": None if is_admin else user.max_courses,
        "current_courses": current_count,
        "can_create_now": allowed,
    }


async def ensure_course_creation_allowed(db: AsyncSession, user: User) -> None:
    # Serialize concurrent creations for this account on databases that
    # support row locks (PostgreSQL). SQLite serializes writers itself.
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    await db.refresh(user, attribute_names=["role", "can_create_courses", "max_courses"])
    policy = await course_creation_status(db, user)
    if policy["can_create_now"]:
        return
    if not policy["can_create_courses"]:
        raise HTTPException(status_code=403, detail="管理员尚未允许此账号新建学习空间")
    raise HTTPException(status_code=403, detail=f"学习空间已达到管理员设置的上限（{policy['max_courses']} 个）")
