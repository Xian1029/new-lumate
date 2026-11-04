"""Map question-paper sections to pages in the original or Office PDF preview."""

from __future__ import annotations

from pathlib import Path
import re


def _compact(value: str) -> str:
    return re.sub(r"[^\w\u4e00-\u9fff]", "", value or "").lower()


def annotate_assessment_source_pages(nodes: list, pdf_path: Path) -> int:
    """Set a verified first source page; leave uncertain nodes unannotated."""
    try:
        from pypdf import PdfReader
        pages = [_compact(page.extract_text() or "") for page in PdfReader(str(pdf_path), strict=False).pages]
    except Exception:
        return 0
    if not any(pages):
        return 0

    by_id = {node.id: node for node in nodes}
    answer_first = next((i for i, text in enumerate(pages) if "参考答案" in text or "答案与试题解析" in text), None)
    matched_count = 0
    for node in nodes:
        if (node.level or 0) < 2 or not (node.content or "").strip():
            continue
        parent = by_id.get(node.parent_id)
        is_answer = bool(parent and re.search(r"答案|解析", parent.title or ""))
        candidate_pages = range(len(pages))
        if answer_first is not None:
            candidate_pages = range(answer_first, len(pages)) if is_answer else range(0, answer_first)
        title = _compact(node.title or "")
        match = next((i for i in candidate_pages if len(title) >= 3 and title in pages[i]), None)
        if match is None:
            visible = re.sub(r"\[(?:pic|image|图片)\]", " ", node.content or "", flags=re.IGNORECASE)
            fragments = [
                _compact(line) for line in visible.splitlines()
                if len(_compact(line)) >= 8 and "【答案】" not in line
            ]
            match = next((i for i in candidate_pages if any(fragment[:18] in pages[i] for fragment in fragments[:12])), None)
        if match is not None:
            node.metadata_ = {**(node.metadata_ or {}), "source_pages": [match + 1]}
            matched_count += 1
    return matched_count
