import uuid
from types import SimpleNamespace

from services.knowledge.graph import _structural_prerequisite_pairs
from services.loom_extraction import _is_meaningful_concept_name, _select_extraction_chunks


def node(title: str, parent_id=None, order_index: int = 0):
    return SimpleNamespace(
        id=uuid.uuid4(), title=title, parent_id=parent_id, order_index=order_index,
    )


def test_formally_numbered_sibling_lessons_get_prerequisites():
    chapter = uuid.uuid4()
    first = node("1.1 正数和负数", chapter, 1)
    second = node("1.2 有理数及其大小比较", chapter, 2)
    third = node("1.3 有理数的加法", chapter, 3)

    assert _structural_prerequisite_pairs([first, second, third]) == [
        (second.id, first.id),
        (third.id, second.id),
    ]


def test_document_order_without_formal_numbering_is_not_a_prerequisite():
    parent = uuid.uuid4()
    first = node("项目背景", parent, 1)
    second = node("实施计划", parent, 2)

    assert _structural_prerequisite_pairs([first, second]) == []


def test_extraction_chunk_selection_covers_the_whole_material():
    items = list(range(100))
    selected = _select_extraction_chunks(items, limit=8)

    assert len(selected) == 8
    assert selected[0] == 0
    assert selected[-1] == 99
    assert selected != items[:8]


def test_graph_rejects_document_structure_but_keeps_real_concepts():
    for label in (
        "选择题", "二、填空题", "试卷题目", "课程核心问题", "官方来源汇总", "第 3 页",
        "XML架构声明", "文档属性", "变量标记", "预处理器标记",
        "信息标记", "特殊字符串标记", "文档保护设置", "数学公式支持",
    ):
        assert not _is_meaningful_concept_name(label)

    for concept in ("正数与负数", "数轴上的点", "变量控制", "项目风险评估", "Photosynthesis"):
        assert _is_meaningful_concept_name(concept)
