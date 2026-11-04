from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from services.ingestion.assessment_source_pages import annotate_assessment_source_pages


def test_question_and_answer_sections_land_on_distinct_source_pages() -> None:
    root = SimpleNamespace(id="root", parent_id=None, title="试题", content=None, level=1, metadata_={})
    answers = SimpleNamespace(id="answers", parent_id=None, title="参考答案与试题解析", content=None, level=1, metadata_={})
    question = SimpleNamespace(id="q", parent_id="root", title="二、填空题", content="7. 如图，已知角平分线。[pic]", level=2, metadata_={})
    answer = SimpleNamespace(id="a", parent_id="answers", title="二、填空题", content="7.\n【答案】\n[pic]", level=2, metadata_={})
    pages = [
        SimpleNamespace(extract_text=lambda: "一、选择题\n二、填空题\n7. 如图，已知角平分线。"),
        SimpleNamespace(extract_text=lambda: "三、解答题\n8. 计算。"),
        SimpleNamespace(extract_text=lambda: "参考答案与试题解析\n二、填空题\n7. 【答案】"),
    ]
    with patch("pypdf.PdfReader", return_value=SimpleNamespace(pages=pages)):
        matched = annotate_assessment_source_pages([root, answers, question, answer], Path("paper.pdf"))
    assert matched == 2
    assert question.metadata_["source_pages"] == [1]
    assert answer.metadata_["source_pages"] == [3]
