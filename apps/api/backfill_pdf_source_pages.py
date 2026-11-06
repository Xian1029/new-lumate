"""Backfill verified PDF page links without recreating learning content.

Run from apps/api: python backfill_pdf_source_pages.py [--course-id UUID] [--apply]
The default is a dry run. Back up the database before using --apply.
"""

import argparse
import asyncio
import uuid

from sqlalchemy import select

from config import settings
from database import async_session
from models.content import CourseContentTree
from models.ingestion import IngestionJob
from services.parser.pdf import _annotate_source_pages
from services.upload_storage import resolve_upload_path


async def run(course_id: uuid.UUID | None, apply: bool) -> None:
    async with async_session() as db:
        query = select(IngestionJob).where(
            IngestionJob.status == "completed",
            IngestionJob.is_current_attempt.is_(True),
            IngestionJob.file_path.is_not(None),
            IngestionJob.original_filename.ilike("%.pdf"),
        ).order_by(IngestionJob.created_at.desc())
        if course_id:
            query = query.where(IngestionJob.course_id == course_id)
        jobs = (await db.execute(query)).scalars().all()
        total = 0
        seen_sources: set[tuple[uuid.UUID, str]] = set()
        for job in jobs:
            source_key = (job.course_id, job.original_filename)
            if source_key in seen_sources:
                continue
            seen_sources.add(source_key)
            source = resolve_upload_path(job.file_path, settings.upload_dir)
            if not source or not source.is_file():
                print(f"skip missing source: {job.id}")
                continue
            nodes = (await db.execute(select(CourseContentTree).where(
                CourseContentTree.course_id == job.course_id,
                CourseContentTree.source_file == job.original_filename,
            ))).scalars().all()
            if not nodes:
                continue
            before = {node.id for node in nodes if (node.metadata_ or {}).get("source_pages")}
            await asyncio.to_thread(_annotate_source_pages, nodes, str(source))
            changed = [node for node in nodes if node.id not in before and (node.metadata_ or {}).get("source_pages")]
            total += len(changed)
            print(f"{job.original_filename}: {len(changed)} verified page links / {len(nodes)} nodes")
            if apply:
                for node in changed:
                    db.add(node)
        if apply:
            await db.commit()
        else:
            await db.rollback()
        print(f"{'updated' if apply else 'dry run'}: {total} new links")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--course-id", type=uuid.UUID)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.course_id, args.apply))
