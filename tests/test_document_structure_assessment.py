"""Distinguish research questionnaires from actual assessment papers."""

from services.ingestion.document_structure import (
    is_question_only_document,
    structure_non_textbook_document,
)


def test_numbered_research_questions_remain_report_content():
    source = """全国 K12 学校科创教育调研内容明细
1、调研目的
主要想了解学校科创教育实际投入和预算情况。
2、调研的学校：
优先调研已开展科创课程的学校。
3、为什么要区分学校类型？
比较不同学校的投入方式。
4、最核心想了解什么？
了解预算、经费来源和采购需求。
5、应该找学校什么岗位？
联系了解经费和项目的负责人。
6、我们最终想做什么？
梳理项目需求。
7、对学校怎么讲？
说明调研目的。
"""
    filename = "全国K12学校科创教育调研内容明细.pdf"
    structured, report = structure_non_textbook_document(source, filename)
    assert report["strategy"] == "report"
    assert "试卷题目" not in structured
    assert not is_question_only_document(filename, structured)


def test_actual_worksheet_keeps_assessment_structure():
    source = "\n".join(f"{i}、计算 {i} + 2 = ____" for i in range(1, 6))
    structured, report = structure_non_textbook_document(source, "数学练习.pdf")
    assert report["strategy"] == "assessment"
    assert structured.startswith("# 试卷题目")
    assert is_question_only_document("数学练习.pdf", structured)


def test_long_research_questionnaire_is_not_question_only():
    source = "\n".join(f"{i}、调研学校在第 {i} 项活动中投入多少？" for i in range(1, 13))
    structured, report = structure_non_textbook_document(source, "科创教育调研.pdf")
    assert report["strategy"] == "report"
    assert not is_question_only_document("科创教育调研.pdf", structured)
