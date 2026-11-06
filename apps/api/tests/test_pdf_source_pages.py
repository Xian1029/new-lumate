import uuid

from models.content import CourseContentTree
from services.parser.pdf import annotate_nodes_from_page_text


def node(title: str, body: str) -> CourseContentTree:
    return CourseContentTree(
        id=uuid.uuid4(), course_id=uuid.uuid4(), title=title,
        content=body, level=2, order_index=1, source_file="math.pdf",
    )


def test_body_beats_duplicate_title_in_table_of_contents() -> None:
    item = node("1.1 正数和负数", "比零大的数叫正数，比零小的数叫负数。向东走记为正，向西走记为负。")
    pages = ["目录 1.1 正数和负数", "1.1 正数和负数。比零大的数叫正数，比零小的数叫负数。向东走记为正，向西走记为负。"]
    assert annotate_nodes_from_page_text([item], pages) == 1
    assert item.metadata_["source_page_start"] == 2
    assert item.metadata_["source_page_confidence"] == "body"


def test_ambiguous_heading_without_body_stays_unmapped() -> None:
    item = node("1.1 正数和负数", "")
    assert annotate_nodes_from_page_text([item], ["目录 1.1 正数和负数", "正文 1.1 正数和负数"]) == 0
    assert not item.metadata_


def test_unique_heading_on_contents_page_is_not_treated_as_section() -> None:
    item = node("第三章 有理数的运算", "")
    assert annotate_nodes_from_page_text([item], ["目录 第三章 有理数的运算", "没有文字层的正文页"]) == 0
    assert not item.metadata_


def test_existing_mapping_is_never_overwritten() -> None:
    item = node("1.1 正数和负数", "足够长的正文用于匹配原始页面。")
    item.metadata_ = {"source_pages": [5]}
    assert annotate_nodes_from_page_text([item], ["足够长的正文用于匹配原始页面。封面"]) == 0
    assert item.metadata_["source_pages"] == [5]
