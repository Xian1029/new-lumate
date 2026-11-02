"""Flashcard + FSRS spaced repetition API endpoints."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from libs.exceptions import AppError, NotFoundError, reraise_as_app_error
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from services.auth.dependency import get_current_user
from services.course_access import get_course_or_404
from services.llm.readiness import ensure_llm_ready

logger = logging.getLogger(__name__)

router = APIRouter()


class GenerateRequest(BaseModel):
    course_id: uuid.UUID
    content_node_id: uuid.UUID | None = None
    count: int = 5
    mode: str | None = None  # learning mode: course_following, self_paced, exam_prep, maintenance
    language: str | None = None
    exclude_fronts: list[str] = Field(default_factory=list, max_length=30)


class ReviewRequest(BaseModel):
    card: dict
    rating: int  # 1=Again, 2=Hard, 3=Good, 4=Easy
    batch_id: uuid.UUID | None = None
    card_index: int | None = None


class SaveGeneratedFlashcardsRequest(BaseModel):
    course_id: uuid.UUID
    cards: list[dict]
    title: str | None = None
    replace_batch_id: uuid.UUID | None = None


@router.post("/generate", summary="Generate flashcards", description="Generate flashcards from course content using LLM and FSRS scheduling.")
async def generate_flashcards(
    body: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate flashcards from course content using LLM + FSRS."""
    from services.spaced_repetition.flashcards import generate_flashcards

    await get_course_or_404(db, body.course_id, user_id=user.id)
    await ensure_llm_ready("Flashcard generation")
    try:
        cards = await generate_flashcards(
            db, body.course_id, body.content_node_id, body.count,
            mode=body.mode, language=body.language, user_id=user.id,
            exclude_fronts=body.exclude_fronts,
        )
    except (ConnectionError, TimeoutError, ValueError, KeyError, RuntimeError) as exc:
        reraise_as_app_error(exc, "Flashcard generation failed")
    except SQLAlchemyError as exc:
        reraise_as_app_error(exc, "Flashcard generation failed")
    return {"cards": cards, "count": len(cards)}


@router.post("/review", summary="Review a flashcard", description="Submit a flashcard review rating and get updated FSRS scheduling.")
async def review_flashcard_endpoint(
    body: ReviewRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Review a flashcard and get FSRS scheduling result."""
    from services.spaced_repetition.flashcards import review_flashcard

    updated_card = review_flashcard(body.card, body.rating)

    # The persisted asset is authoritative for course/node linkage.  This
    # keeps older card batches (which may not contain metadata on every card)
    # connected to progress and the knowledge graph after a review.
    resolved_course_id = updated_card.get("course_id")
    resolved_content_node_id = updated_card.get("content_node_id")

    # Persist FSRS state back to the GeneratedAsset in the database.
    # Note: read-modify-write on JSON column without row-level locking.
    # Safe under SQLite (serialized writes) but would need SELECT ... FOR UPDATE
    # if migrated to PostgreSQL with concurrent reviewers.
    if body.batch_id is not None and body.card_index is not None:
        from models.generated_asset import GeneratedAsset

        result = await db.execute(
            select(GeneratedAsset).where(
                GeneratedAsset.batch_id == body.batch_id,
                GeneratedAsset.user_id == user.id,
                GeneratedAsset.is_archived == False,  # noqa: E712
            )
        )
        asset = result.scalar_one_or_none()
        if asset and asset.content:
            cards = asset.content.get("cards", [])
            if 0 <= body.card_index < len(cards):
                stored_card = cards[body.card_index]
                resolved_course_id = resolved_course_id or asset.course_id
                resolved_content_node_id = resolved_content_node_id or stored_card.get("content_node_id")
                if resolved_course_id:
                    updated_card["course_id"] = str(resolved_course_id)
                if resolved_content_node_id:
                    updated_card["content_node_id"] = str(resolved_content_node_id)
                cards[body.card_index] = {
                    **stored_card,
                    "fsrs": updated_card.get("fsrs", {}),
                    "knowledge_points": updated_card.get("knowledge_points", []),
                }
                # SQLAlchemy needs the JSON column reassigned to detect the mutation
                asset.content = {**asset.content, "cards": cards}

    # Emit standardized learning event for analytics + plugin hooks
    try:
        from services.analytics.events import emit_flashcard_reviewed
        card_id = body.card.get("id") or body.card.get("front", "unknown")[:40]
        if resolved_course_id:
            await emit_flashcard_reviewed(
                db,
                user_id=user.id,
                course_id=uuid.UUID(str(resolved_course_id)),
                card_id=str(card_id),
                rating=body.rating,
            )
    except (SQLAlchemyError, ValueError, TypeError):
        logger.exception("Flashcard learning event emission failed (best-effort)")

    # Flashcards record recall and drive spaced repetition only. They are not
    # treated as solved exercises: one "Good" click must not mark a graph
    # concept as mastered. Knowledge mastery comes from confirmed practice.
    # Record the confirmed review even when the card has no graph concept.
    if resolved_course_id:
        try:
            from services.progress.tracker import record_flashcard_review
            cid = uuid.UUID(str(resolved_course_id))
            raw_content_node_id = resolved_content_node_id
            node_id = uuid.UUID(str(raw_content_node_id)) if raw_content_node_id else None
            await record_flashcard_review(
                db, user.id, cid, node_id, recalled=body.rating >= 3,
            )
        except (SQLAlchemyError, ValueError, KeyError):
            logger.debug("Flashcard → learning progress sync failed (best-effort)")

    # Single commit covers FSRS persistence, analytics event, and mastery sync
    await db.commit()

    return {
        "card": updated_card,
        "next_review": updated_card.get("fsrs", {}).get("due"),
    }


@router.post("/generated/save", summary="Save generated flashcards", description="Persist a batch of generated flashcards as a reusable asset.")
async def save_generated_flashcards(
    body: SaveGeneratedFlashcardsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    course = await get_course_or_404(db, body.course_id, user_id=user.id)

    from services.generated_assets import save_generated_asset

    try:
        result = await save_generated_asset(
            db,
            user_id=user.id,
            course_id=body.course_id,
            asset_type="flashcards",
            title=body.title or course.name,
            content={"cards": body.cards},
            metadata={"count": len(body.cards)},
            replace_batch_id=body.replace_batch_id,
        )
    except ValueError as exc:
        raise NotFoundError(resource="generated_asset", resource_id=str(body.replace_batch_id)) from exc

    await db.commit()
    return result


@router.get("/generated/{course_id}", summary="List saved flashcard batches", description="Return all saved flashcard batches for a course.")
async def list_generated_flashcards(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_course_or_404(db, course_id, user_id=user.id)

    from services.generated_assets import list_generated_asset_batches

    return await list_generated_asset_batches(
        db,
        user_id=user.id,
        course_id=course_id,
        asset_type="flashcards",
    )


@router.get("/lector-order/{course_id}", summary="Get LECTOR-ordered flashcards", description="Return due flashcards ordered by LECTOR semantic priority instead of FSRS due date.")
async def get_lector_ordered_flashcards(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get flashcards ordered by LECTOR semantic priority instead of pure FSRS due date.

    Merges LECTOR concept priority with flashcard content for a semantically-aware review order.
    """
    from models.generated_asset import GeneratedAsset
    from services.lector import get_smart_review_session

    await get_course_or_404(db, course_id, user_id=user.id)

    # Get LECTOR priority order
    review_items = await get_smart_review_session(db, user.id, course_id, max_items=30)

    # Apply structured session ordering if experiment enables it
    from services.experiments.framework import get_experiment_config
    use_structured = get_experiment_config(
        user.id, "lector_scheduling_v1", "use_structured_session", default=False,
    )
    if use_structured and review_items:
        from services.lector_session import build_structured_session
        review_items = await build_structured_session(review_items, max_items=30)

    concept_priority = {item.concept_name.lower(): (i, item) for i, item in enumerate(review_items)}

    # Get all active flashcard batches
    result = await db.execute(
        select(GeneratedAsset).where(
            GeneratedAsset.user_id == user.id,
            GeneratedAsset.course_id == course_id,
            GeneratedAsset.asset_type == "flashcards",
            GeneratedAsset.is_archived == False,  # noqa: E712
        )
    )
    batches = result.scalars().all()

    now = datetime.now(timezone.utc)
    scored_cards: list[tuple[float, int, dict]] = []

    for batch in batches:
        cards = (batch.content or {}).get("cards", [])
        for idx, card in enumerate(cards):
            fsrs = card.get("fsrs")
            is_due = True
            if fsrs and fsrs.get("due"):
                try:
                    due_dt = datetime.fromisoformat(fsrs["due"].replace("Z", "+00:00"))
                    is_due = due_dt <= now
                except (ValueError, TypeError) as exc:
                    logger.debug("Failed to parse FSRS due date: %s", exc)

            if not is_due:
                continue

            # Score by LECTOR concept match
            front = (card.get("front") or "").lower()
            concept = card.get("concept", "").lower()
            priority_score = 999.0  # Default: no concept match
            reason = "due"

            for concept_name, (rank, item) in concept_priority.items():
                if concept_name in front or concept_name in concept or concept in concept_name:
                    priority_score = rank
                    reason = item.reason
                    break

            card_with_meta = {
                **card,
                "batch_id": str(batch.batch_id),
                "card_index": idx,
                "lector_priority": priority_score,
                "lector_reason": reason,
            }
            scored_cards.append((priority_score, idx, card_with_meta))

    scored_cards.sort(key=lambda x: (x[0], x[1]))
    ordered_cards = [c[2] for c in scored_cards]

    return {
        "cards": ordered_cards,
        "count": len(ordered_cards),
        "lector_concepts": len(review_items),
    }


@router.get("/due/{course_id}", summary="List due flashcards", description="Return flashcards due for review today across all saved batches.")
async def get_due_flashcards(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get flashcards due for review today across all saved batches for a course.

    Scans active batches and returns only cards previously reviewed by this
    learner whose next FSRS date is due. New cards belong to initial learning,
    not to the "today review" reminder.
    """
    from models.generated_asset import GeneratedAsset

    await get_course_or_404(db, course_id, user_id=user.id)

    result = await db.execute(
        select(GeneratedAsset).where(
            GeneratedAsset.user_id == user.id,
            GeneratedAsset.course_id == course_id,
            GeneratedAsset.asset_type == "flashcards",
            GeneratedAsset.is_archived == False,  # noqa: E712
        )
    )
    batches = result.scalars().all()

    now = datetime.now(timezone.utc)
    due_cards: list[dict] = []

    for batch in batches:
        cards = (batch.content or {}).get("cards", [])
        for card_index, card in enumerate(cards):
            from services.spaced_repetition.flashcards import is_flashcard_due
            fsrs = card.get("fsrs") or {}
            try:
                has_review_history = int(fsrs.get("reps") or 0) > 0 or bool(fsrs.get("last_review"))
            except (TypeError, ValueError):
                has_review_history = bool(fsrs.get("last_review"))
            if has_review_history and is_flashcard_due(card, now):
                due_cards.append({**card, "batch_id": str(batch.batch_id), "card_index": card_index})

    # Adjust card order based on cognitive load (easier cards first when loaded)
    try:
        from services.cognitive_load import compute_cognitive_load, adjust_review_order_for_load
        cl = await compute_cognitive_load(db, user.id, course_id)
        if cl.get("score", 0) >= 0.5:
            due_cards = adjust_review_order_for_load(cl["score"], due_cards)
    except (SQLAlchemyError, ValueError, KeyError, TypeError):
        logger.exception("Cognitive load adjustment failed (best-effort)")

    return {"cards": due_cards, "due_count": len(due_cards), "total_batches": len(batches)}


@router.get("/confusion-pairs/{course_id}", summary="Get confusion pairs", description="Return confused concept pairs for side-by-side comparison review.")
async def get_confusion_pairs(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get confused concept pairs for side-by-side comparison review."""
    await get_course_or_404(db, course_id, user_id=user.id)

    from services.loom_confusion import get_confused_concepts
    pairs = await get_confused_concepts(db, course_id)

    # Enrich with concept descriptions from knowledge nodes
    if pairs:
        from models.knowledge_graph import KnowledgeNode
        result = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.course_id == course_id)
        )
        nodes = {n.name.lower(): n for n in result.scalars().all()}

        for pair in pairs:
            node_a = nodes.get(pair["concept_a"].lower())
            node_b = nodes.get(pair["concept_b"].lower())
            pair["description_a"] = node_a.description if node_a and node_a.description else None
            pair["description_b"] = node_b.description if node_b and node_b.description else None

    return {"pairs": pairs, "count": len(pairs)}
