from services.ingestion.document_structure import (
    assessment_excerpt,
    assessment_note_source,
    document_quality_notice,
    is_reference_only_document,
    is_k12_textbook_document,
    is_question_only_document,
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
    assert media and media["code"] == "EXAM_MEDIA_UNREADABLE"
    assert media["action"] == "replace_optional"
    assert is_question_only_document("数学试卷.doc", "1. 选择正确答案\n" + "[pic]" * 6)
    assert not is_reference_only_document("数学试卷.doc", "1. 选择正确答案\n" + "[pic]" * 6)
    assert not is_reference_only_document("数学试卷.doc", "1. 计算 -2+3 并说明理由。")

    weak = document_quality_notice(
        "很短的扫描内容",
        "资料.pdf",
        {"strategy": "report", "headings": 0},
    )
    assert weak and weak["code"] == "LOW_TEXT_CONTENT"


def test_question_only_material_is_learnable_in_each_supported_format() -> None:
    source = "\n".join(f"{i}. 数轴上正负数的意义是什么？" for i in range(1, 12))
    for suffix in ("pdf", "doc", "docx", "ppt", "pptx", "txt", "md"):
        name = f"七年级数学练习.{suffix}"
        structured, report = structure_non_textbook_document(source, name)
        assert report["strategy"] == "assessment"
        assert is_question_only_document(name, structured)
        assert not is_reference_only_document(name, structured)


def test_large_assessment_excerpt_covers_entire_source_without_media_guessing() -> None:
    source = "\n".join(f"{i}. 第{i}题考查数轴与正负数。[pic]" for i in range(1, 301))
    excerpt = assessment_excerpt(source, 1500)
    assert len(excerpt) <= 1500
    assert "1. 第1题" in excerpt
    assert "300. 第300题" in excerpt
    assert "[pic]" not in excerpt


def test_short_answer_section_uses_matching_question_stem_for_notes() -> None:
    from types import SimpleNamespace
    question = SimpleNamespace(id="question", title="二、填空题", content="7. 如图，已知角平分线的定义。[pic]", content_category="assessment")
    answer = SimpleNamespace(id="answer", title="二、填空题", content="7.\n【答案】\n[pic]", content_category="assessment")
    source = assessment_note_source(answer, [question, answer])
    assert "角平分线" in source
    assert "对应解析" in source
    assert "[pic]" not in source


def test_word_report_does_not_promote_body_fragments_to_chapters() -> None:
    source = """# 陕西某公司作品情况分析
## 国内账号情况概览
账号数据与作品分布的具体分析。

## 例如
这只是正文中的举例。

## 代表内容
这里描述一部作品。

## 从内容结构看，大致可分为以下几个板块
以下逐项说明。

## 内容类型能力分析
对作品类型进行归纳。"""
    structured, report = structure_non_textbook_document(source, "陕西某公司作品情况分析.docx")
    assert report["strategy"] == "source_headings"
    assert "## 国内账号情况概览" in structured
    assert "## 内容类型能力分析" in structured
    assert "## 例如" not in structured
    assert "## 代表内容" not in structured
    assert "## 从内容结构看" not in structured
    assert "这只是正文中的举例。" in structured
    assert is_reference_only_document("陕西某公司作品情况分析.docx", structured)
    assert not is_reference_only_document("七年级数学上册.docx", structured)
