"""LearningTask actions; task status is never patched directly."""

import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from libs.exceptions import ConflictError, NotFoundError
from models.learning_plan import LearningPlan
from models.learning_task import LearningTask
from models.content import CourseContentTree
from models.user import User
from routers.learning_plans import _task_response
from schemas.learning_plan import LearningTaskResponse, PostponeLearningTaskRequest, StartLearningPlanResponse
from services.auth.dependency import get_current_user
from services.learning_plans import LearningTaskService, LearningTaskTransitionError

router = APIRouter()


async def _owned_task(db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID) -> LearningTask:
    task = (await db.execute(select(LearningTask).join(LearningPlan).where(LearningTask.id == task_id, LearningPlan.user_id == user_id))).scalar_one_or_none()
    if not task: raise NotFoundError("LearningTask", task_id)
    return task


async def _task_action(task_id: uuid.UUID, user: User, db: AsyncSession, action: str, postponed_to=None):
    task = await _owned_task(db, task_id, user.id)
    try:
        result = await getattr(LearningTaskService, action)(db, task, postponed_to) if action == "postpone_task" else await getattr(LearningTaskService, action)(db, task)
    except LearningTaskTransitionError as exc:
        raise ConflictError(str(exc)) from exc
    await db.commit(); await db.refresh(result)
    return _task_response(result)


@router.post("/{task_id}/start", response_model=LearningTaskResponse)
async def start_task(task_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _task_action(task_id, user, db, "start_task")


@router.post("/{task_id}/launch", response_model=StartLearningPlanResponse)
async def launch_task(task_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Start the task the learner clicked and return its exact workspace link."""
    task = await _owned_task(db, task_id, user.id)
    try:
        await LearningTaskService.start_task(db, task)
    except LearningTaskTransitionError as exc:
        raise ConflictError(str(exc)) from exc
    plan = await db.get(LearningPlan, task.plan_id)
    node_exists = bool(task.content_node_id and (await db.execute(
        select(CourseContentTree.id).where(
            CourseContentTree.id == task.content_node_id,
            CourseContentTree.course_id == task.course_id,
        )
    )).scalar_one_or_none())
    from routers.learning_plans import _plan_response
    from services.learning_plans.action_links import build_action_href, module_for_task_type
    href = build_action_href(task_type=task.task_type, course_id=task.course_id,
                             content_node_id=task.content_node_id, node_exists=node_exists,
                             guided_session=True)
    await db.commit(); await db.refresh(task); await db.refresh(plan)
    return StartLearningPlanResponse(plan=_plan_response(plan), task=_task_response(task), href=href,
                                     target_module=module_for_task_type(task.task_type),
                                     relocated=bool(task.content_node_id and not node_exists))
@router.post("/{task_id}/complete", response_model=LearningTaskResponse)
async def complete_task(task_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _task_action(task_id, user, db, "complete_task")
@router.post("/{task_id}/postpone", response_model=LearningTaskResponse)
async def postpone_task(task_id: uuid.UUID, body: PostponeLearningTaskRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _task_action(task_id, user, db, "postpone_task", body.postponed_to)
@router.post("/{task_id}/skip", response_model=LearningTaskResponse)
async def skip_task(task_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _task_action(task_id, user, db, "skip_task")
@router.post("/{task_id}/reopen", response_model=LearningTaskResponse)
async def reopen_task(task_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _task_action(task_id, user, db, "reopen_task")
