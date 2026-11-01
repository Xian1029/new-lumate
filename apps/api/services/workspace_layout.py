"""Server-side normalization for course workspace display instances.

The course metadata JSON remains the persistence mechanism, but this service
owns the lifecycle contract so clients cannot accidentally turn an optional
block into a permanent one.  It deliberately never touches learning content.
"""

from __future__ import annotations

from typing import Any

BLOCK_TYPES = {
    "notes", "quiz", "flashcards", "progress", "knowledge_graph", "review",
    "chapter_list", "plan", "wrong_answers", "forecast", "agent_insight", "summary",
}
REQUIRED_TYPES = {"chapter_list", "notes"}
SIZES = {"small", "medium", "large", "full"}
SOURCES = {"SYSTEM_REQUIRED", "SYSTEM_OPTIONAL", "USER_ADDED"}
_VALID_MODES = {"course_following", "self_paced", "exam_prep", "maintenance"}

# This is the server-owned counterpart of the client workspace templates.
# It is used only while creating a learning space that has no explicit layout,
# so direct API creation, imports and the regular upload wizard all start with
# the same functional baseline. Existing learner customizations are never
# replaced by this default.
_MODE_BLOCKS: dict[str, list[tuple[str, str, dict[str, Any]]]] = {
    "course_following": [
        ("chapter_list", "full", {}), ("notes", "full", {}),
        ("progress", "full", {}), ("quiz", "medium", {}),
        ("flashcards", "medium", {}), ("knowledge_graph", "full", {}),
        ("forecast", "full", {}),
    ],
    "self_paced": [
        ("chapter_list", "full", {}), ("notes", "full", {}),
        ("progress", "full", {}), ("flashcards", "full", {}),
        ("knowledge_graph", "full", {}), ("forecast", "full", {}),
    ],
    "exam_prep": [
        ("chapter_list", "full", {}), ("notes", "full", {"note_format": "summary", "purpose": "exam_review"}),
        ("quiz", "large", {"difficulty": "hard"}), ("progress", "full", {}),
        ("plan", "full", {}), ("knowledge_graph", "full", {}),
        ("forecast", "full", {}),
    ],
}


def _source(raw: Any, block_type: str) -> str:
    if raw in SOURCES:
        return str(raw)
    if raw == "user":
        return "USER_ADDED"
    return "SYSTEM_REQUIRED" if block_type in REQUIRED_TYPES else "SYSTEM_OPTIONAL"


class WorkspaceLayoutService:
    """Validate and normalize the persisted display-only workspace layout."""

    @staticmethod
    def default_layout(mode: Any = "course_following") -> dict[str, Any]:
        """Return a complete, deterministic initial workspace layout.

        ``maintenance`` is a legacy mode and intentionally maps to the
        current self-paced baseline, matching the frontend's migration rule.
        """
        effective_mode = mode if isinstance(mode, str) and mode in _VALID_MODES else "course_following"
        if effective_mode == "maintenance":
            effective_mode = "self_paced"
        blocks = []
        for position, (block_type, size, config) in enumerate(_MODE_BLOCKS[effective_mode]):
            blocks.append({
                "id": f"mode-{effective_mode}-{block_type}-{position}",
                "type": block_type,
                "position": position,
                "size": size,
                "config": dict(config),
                "isVisible": True,
                "isPinned": False,
                "source": _source(None, block_type),
            })
        return {
            "templateId": None,
            "blocks": blocks,
            "columns": 2,
            "mode": effective_mode,
        }

    @staticmethod
    def normalize(layout: Any) -> dict[str, Any]:
        if not isinstance(layout, dict):
            layout = {}
        raw_blocks = layout.get("blocks") if isinstance(layout.get("blocks"), list) else []
        blocks: list[dict[str, Any]] = []
        seen_types: set[str] = set()
        for index, raw in enumerate(raw_blocks):
            if not isinstance(raw, dict) or raw.get("type") not in BLOCK_TYPES:
                continue
            block_type = str(raw["type"])
            # The current UI supports one display instance of each block type.
            if block_type in seen_types:
                continue
            seen_types.add(block_type)
            source = _source(raw.get("source"), block_type)
            if block_type in REQUIRED_TYPES:
                source = "SYSTEM_REQUIRED"
            blocks.append({
                "id": str(raw.get("id") or f"srv-{block_type}-{index}"),
                "type": block_type,
                "position": len(blocks),
                "size": raw.get("size") if raw.get("size") in SIZES else "medium",
                "config": raw.get("config") if isinstance(raw.get("config"), dict) else {},
                "isVisible": bool(raw.get("isVisible", raw.get("visible", True))),
                "isPinned": bool(raw.get("isPinned", raw.get("fixed", False))),
                "source": source,
                **({"agentMeta": raw["agentMeta"]} if isinstance(raw.get("agentMeta"), dict) else {}),
            })
        if "chapter_list" not in seen_types:
            blocks.insert(0, {
                "id": "core-chapter_list", "type": "chapter_list", "position": 0,
                "size": "full", "config": {}, "isVisible": True,
                "isPinned": False, "source": "SYSTEM_REQUIRED",
            })
        if "notes" not in seen_types:
            # Notes are a foundational course-grounded learning capability,
            # just like the course outline. Do not leave an incomplete or
            # legacy layout without an accessible notes surface.
            blocks.insert(1 if blocks else 0, {
                "id": "core-notes", "type": "notes", "position": 0,
                "size": "full", "config": {}, "isVisible": True,
                "isPinned": False, "source": "SYSTEM_REQUIRED",
            })
        for position, block in enumerate(blocks):
            block["position"] = position
        return {
            "templateId": layout.get("templateId") if isinstance(layout.get("templateId"), str) else None,
            "blocks": blocks,
            "columns": layout.get("columns") if layout.get("columns") in {1, 2, 3} else 2,
            **({"mode": layout["mode"]} if isinstance(layout.get("mode"), str) else {}),
        }
