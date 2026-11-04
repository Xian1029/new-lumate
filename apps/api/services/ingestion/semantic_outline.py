"""Cost-conscious AI structure recovery for genuinely unheaded documents."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from services.content_text import clean_course_title, has_unreadable_text
from services.ingestion.document_structure import _is_structural_source_heading
from services.llm.router import get_llm_client

logger = logging.getLogger(__name__)
_HEADING = re.compile(r"(?m)^\s*#{1,6}\s+\S+")
_TOP_HEADING = re.compile(r"(?m)^\s*#\s+\S+")
_SLIDE_MARKER = re.compile(r"<!--\s*OPENTUTOR_SLIDE:(\d+)\s*-->")


def _parse_boundaries(raw: str, offset: int, count: int) -> list[tuple[int, str]]:
    cleaned = re.sub(r"^\s*```(?:json)?|```\s*$", "", raw.strip(), flags=re.IGNORECASE)
    payload = json.loads(cleaned)
    sections = payload.get("sections", []) if isinstance(payload, dict) else []
    result: list[tuple[int, str]] = []
    for item in sections[:10]:
        if not isinstance(item, dict):
            continue
        start = item.get("start")
        title = clean_course_title(str(item.get("title") or ""), fallback="")
        if isinstance(start, int) and 0 <= start < count and title and not has_unreadable_text(title) and _is_structural_source_heading(title):
            result.append((offset + start, title[:80]))
    return result


def apply_section_boundaries(paragraphs: list[str], boundaries: list[tuple[int, str]]) -> str:
    """Insert headings while retaining every source paragraph verbatim."""
    titles = {index: title for index, title in boundaries if 0 <= index < len(paragraphs)}
    output: list[str] = []
    for index, paragraph in enumerate(paragraphs):
        if index in titles:
            output.append(f"# {titles[index]}")
        output.append(paragraph)
    return "\n\n".join(output)


async def enhance_outline_with_ai(markdown: str, filename: str) -> tuple[str, bool]:
    """Use compact paragraph excerpts to find boundaries; never rewrite text."""
    if Path(filename).suffix.lower() in {".ppt", ".pptx"}:
        return await _enhance_presentation_outline(markdown, filename)
    # Existing Word/PDF headings remain the source of truth and cost no tokens.
    if len(_HEADING.findall(markdown)) >= 2:
        return markdown, False
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", markdown) if part.strip()]
    if len(paragraphs) < 4:
        return markdown, False

    boundaries: list[tuple[int, str]] = []
    try:
        client = get_llm_client("fast")
        # Up to 60 short excerpts per request keeps calls and token cost low.
        for offset in range(0, len(paragraphs), 60):
            chunk = paragraphs[offset:offset + 60]
            excerpt_lines: list[str] = []
            for index, paragraph in enumerate(chunk):
                compact = re.sub(r"\s+", " ", paragraph)[:120]
                excerpt_lines.append(f"[{index}] {compact}")
            excerpts = "\n".join(excerpt_lines)
            prompt = f"""文件：{Path(filename).stem}
根据以下按原顺序编号的文段识别章节起点。仅返回严格 JSON：
{{"sections":[{{"start":0,"title":"章节标题"}}]}}
start 必须是本批次编号，标题用简体中文。建议 2 至 8 节，不要输出解释。
{excerpts}"""
            raw, _ = await client.extract(
                "你负责为无目录学习资料识别语义章节，只输出 JSON。",
                prompt,
            )
            boundaries.extend(_parse_boundaries(raw, offset, len(chunk)))
    except Exception as exc:
        logger.info("AI semantic outline unavailable for %s: %s", filename, type(exc).__name__)
        return markdown, False

    unique = sorted(dict(boundaries).items())
    if len(unique) < 2:
        return markdown, False
    structured = apply_section_boundaries(paragraphs, unique)
    if any(paragraph not in structured for paragraph in paragraphs):
        return markdown, False
    return structured, True


async def _enhance_presentation_outline(markdown: str, filename: str) -> tuple[str, bool]:
    """Group slides into semantic chapters while preserving every slide.

    Native PowerPoint section-divider slides are already emitted as top-level
    headings and remain authoritative. AI is used only when the deck has no
    useful section structure, with one short excerpt per slide.
    """
    if len(_TOP_HEADING.findall(markdown)) >= 2:
        return markdown, False
    slides = [part.strip() for part in re.split(r"\n\s*---\s*\n", markdown) if part.strip()]
    if len(slides) < 5 or not all(_SLIDE_MARKER.search(slide) for slide in slides):
        return markdown, False

    excerpt_lines: list[str] = []
    for index, slide in enumerate(slides[:80]):
        visible = _SLIDE_MARKER.sub("", slide)
        visible = re.sub(r"(?m)^#{1,6}\s+", "", visible)
        visible = re.sub(r"\s+", " ", visible).strip()[:160]
        excerpt_lines.append(f"[{index}] {visible}")

    try:
        raw, _ = await get_llm_client("fast").extract(
            "你负责为演示文稿识别语义章节，只输出 JSON，不改写原文。",
            f"""文件：{Path(filename).stem}
根据以下按原顺序排列的幻灯片摘要识别章节起点。忽略封面、目录和结束页。
仅返回严格 JSON：{{"sections":[{{"start":2,"title":"章节标题"}}]}}
start 必须是幻灯片数组编号，标题用简体中文。建议 2 至 8 章，不要输出解释。
{chr(10).join(excerpt_lines)}""",
        )
        boundaries = _parse_boundaries(raw, 0, min(len(slides), 80))
    except Exception as exc:
        logger.info("AI presentation outline unavailable for %s: %s", filename, type(exc).__name__)
        return markdown, False

    unique = sorted(dict(boundaries).items())
    if len(unique) < 2:
        return markdown, False
    titles = dict(unique)
    structured: list[str] = []
    for index, slide in enumerate(slides):
        chapter_title = titles.get(index)
        if chapter_title:
            first_topic = re.search(r"(?m)^##\s+(.+)$", slide)
            if first_topic and clean_course_title(first_topic.group(1), fallback="") == chapter_title:
                slide = slide[:first_topic.start()] + f"# {chapter_title}" + slide[first_topic.end():]
            else:
                marker = _SLIDE_MARKER.search(slide)
                insertion = marker.end() if marker else 0
                slide = slide[:insertion] + f"\n\n# {chapter_title}" + slide[insertion:]
        structured.append(slide)
    return "\n\n---\n\n".join(structured), True
