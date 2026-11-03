import uuid
from datetime import datetime, timezone

from models.content import CourseContentTree
from routers.courses_crud import _serialize_content_tree


def _node(*, course_id, title, level, order, parent_id=None):
    return CourseContentTree(
        id=uuid.uuid4(),
        course_id=course_id,
        parent_id=parent_id,
        title=title,
        level=level,
        order_index=order,
        source_file="自动化方案.docx",
        source_type="docx",
        created_at=datetime(2026, 11, 3, tzinfo=timezone.utc),
    )


def test_existing_word_orphans_are_adopted_by_the_single_material_root():
    course_id = uuid.uuid4()
    root = _node(course_id=course_id, title="自动化方案.docx", level=0, order=0)
    first = _node(course_id=course_id, title="一、方案描述", level=1, order=2, parent_id=root.id)
    fifth = _node(course_id=course_id, title="五、执行示例", level=1, order=6, parent_id=root.id)
    section_21 = _node(course_id=course_id, title="2.1 意图识别", level=2, order=1)
    section_31 = _node(course_id=course_id, title="3.1 工具集成", level=2, order=1)
    subsection = _node(course_id=course_id, title="3.1.1 API 调用", level=3, order=1, parent_id=section_31.id)

    result = _serialize_content_tree([root, first, fifth, section_21, section_31, subsection])

    assert len(result) == 1
    assert result[0].title == "自动化方案.docx"
    assert [node.title for node in result[0].children] == [
        "一、方案描述", "2.1 意图识别", "3.1 工具集成", "五、执行示例",
    ]
    assert result[0].children[2].children[0].title == "3.1.1 API 调用"


def test_numbered_and_generic_word_headings_can_be_sorted_together():
    course_id = uuid.uuid4()
    root = _node(course_id=course_id, title="资料.docx", level=0, order=0)
    generic = _node(course_id=course_id, title="方案概述", level=1, order=1, parent_id=root.id)
    numbered = _node(course_id=course_id, title="2.1 实施步骤", level=1, order=2, parent_id=root.id)
    chinese = _node(course_id=course_id, title="三、结果验收", level=1, order=3, parent_id=root.id)

    result = _serialize_content_tree([root, numbered, chinese, generic])

    assert len(result) == 1
    assert [node.title for node in result[0].children] == [
        "方案概述", "2.1 实施步骤", "三、结果验收",
    ]
