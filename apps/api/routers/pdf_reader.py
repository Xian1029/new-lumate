"""Authenticated, page-grounded explanations for the PDF reader."""

import asyncio
import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from config import settings
from database import get_db
from libs.exceptions import NotFoundError
from models.ingestion import IngestionJob
from models.user import User
from schemas.pdf_reader import PdfExplanationRequest
from services.auth.dependency import get_current_user
from services.course_access import get_course_or_404
from services.llm.readiness import ensure_llm_ready
from services.llm.router import get_llm_client
from services.pdf_reader import page_evidence, prompts
from services.upload_storage import resolve_upload_path

router = APIRouter()


@router.post("/explanations/stream")
async def stream_explanation(
    body: PdfExplanationRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_course_or_404(db, body.course_id, user_id=user.id)
    job = (await db.execute(select(IngestionJob).where(
        IngestionJob.id == body.job_id,
        IngestionJob.user_id == user.id,
        IngestionJob.course_id == body.course_id,
    ))).scalar_one_or_none()
    if not job or not job.file_path:
        raise NotFoundError("File")
    file_path = resolve_upload_path(job.file_path, settings.upload_dir)
    if not file_path or file_path.suffix.lower() != ".pdf":
        raise NotFoundError("PDF file")

    try:
        source = await asyncio.to_thread(
            page_evidence, file_path, body.anchor.page, body.anchor.text,
        )
    except Exception:
        source = None

    async def no_text():
        yield {
            "event": "no_evidence",
            "data": json.dumps({
                "message": "这一页暂时无法提取课本正文，请换一页或检查是否为扫描件。",
            }, ensure_ascii=False),
        }

    if not source:
        return EventSourceResponse(no_text())

    await ensure_llm_ready("PDF 精读")
    system, prompt = prompts(body.anchor.text, body.question, source)

    async def events():
        yield {
            "event": "sources",
            "data": json.dumps([{
                "page": source["page"],
                "label": f"课本第{source['page']}页",
            }], ensure_ascii=False),
        }
        try:
            async with asyncio.timeout(45):
                async for chunk in get_llm_client("fast").stream_chat(system, prompt):
                    if await request.is_disconnected():
                        return
                    yield {
                        "event": "content",
                        "data": json.dumps({"content": chunk}, ensure_ascii=False),
                    }
            yield {"event": "done", "data": "{}"}
        except TimeoutError:
            yield {"event": "error", "data": '{"message":"解释超时，请重试。"}'}
        except Exception:
            yield {"event": "error", "data": '{"message":"AI 暂时不可用，请稍后重试。"}'}

    return EventSourceResponse(events())
