from services.ingestion.document_structure import (
    document_quality_notice,
    is_k12_textbook_document,
    structure_non_textbook_document,
)


def test_math_exam_uses_question_types_not_individual_questions() -> None:
    source = """七年级数学测试卷
一、选择题
1. 下列说法正确的是（ ）
2. 数轴上表示-2的点是（ ）
二、填空题
3. -5的相反数是____。
三、解答题
4. 计算并说明理由。"""

    structured, report = structure_non_textbook_document(source, "七年级数学试卷.docx")

    assert report["strategy"] == "assessment"
    assert "# 一、选择题" in structured
    assert "# 二、填空题" in structured
    assert "# 三、解答题" in structured
    assert "# 1. 下列说法" not in structured
    assert not is_k12_textbook_document("七年级数学试卷.docx", source)


def test_report_removes_page_headers_and_keeps_complete_sections() -> None:
    title = "Astra Nova School 教育模式研究"
    source = f"""{title}
第 1 页共 2 页
申请流程详解：
申请正文。
{title}
第 2 页共 2 页
数学（Mathematics）：
数学正文。
家长参与方式：
家长正文。"""

    structured, report = structure_non_textbook_document(source, "研究报告.pdf")

    assert report["strategy"] == "report"
    assert "# 申请流程详解" in structured
    assert "## 数学（Mathematics）" in structured
    assert "# 家长参与方式" in structured
    assert "申请正文。" in structured and "数学正文。" in structured and "家长正文。" in structured
    assert "第 1 页共 2 页" not in structured


def test_actual_textbook_profiles_remain_separate() -> None:
    assert is_k12_textbook_document("人教版七年级数学上册课本.pdf", "第一章 有理数")
    assert is_k12_textbook_document("学习资料.pdf", "义务教育教科书\n第一单元\n语文园地")
    assert not is_k12_textbook_document("七年级数学知识总结.pdf", "知识梳理与典型例题")


def test_exam_with_answers_has_two_clear_groups() -> None:
    source = """数学试卷
一、选择题
1. 下列说法正确的是（ ）
二、填空题
2. 结果是____。
参考答案与试题解析
一、选择题
1. 【答案】A
二、填空题
2. 【答案】3"""

    structured, report = structure_non_textbook_document(source, "数学试卷.doc")

    assert report["strategy"] == "assessment"
    assert "# 试题" in structured
    assert "# 参考答案与试题解析" in structured
    assert structured.count("## 一、选择题") == 2
    assert structured.count("## 二、填空题") == 2


def test_document_quality_notices_are_actionable() -> None:
    media = document_quality_notice(
        "题目 " + " [pic]" * 6,
        "数学试卷.doc",
        {"strategy": "assessment", "headings": 3},
    )
    assert media and media["code"] == "EMBEDDED_MEDIA_NOT_TEXT"
    assert media["action"] == "replace_optional"

    weak = document_quality_notice(
        "很短的扫描内容",
        "资料.pdf",
        {"strategy": "report", "headings": 0},
    )
    assert weak and weak["code"] == "LOW_TEXT_CONTENT"
