"""Deterministic structure recovery for non-textbook learning materials.

This module deliberately stays separate from the K12 textbook parser. Reports,
exam papers, interviews and handouts have different boundaries: question-type
labels, report section captions and bilingual domain headings.  Every retained
source line remains present verbatim; only Markdown heading markers are added.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
import re

from services.content_text import clean_course_text


_MARKDOWN_HEADING = re.compile(r"(?m)^\s*#{1,6}\s+\S+")
_PAGE_MARKER = re.compile(
    r"^(?:第\s*\d+\s*页\s*(?:共|/|of)\s*\d+\s*页?|page\s*\d+\s*(?:of|/)\s*\d+)$",
    re.IGNORECASE,
)
_QUESTION_TYPE = re.compile(
    r"^(?:(?:第?[一二三四五六七八九十百\d]+)[、.．)）\s]*)?"
    r"(选择题|填空题|判断题|计算题|解答题|证明题|作图题|应用题|综合题|探究题|"
    r"阅读理解题|完形填空|写作题|作文|听力(?:部分|题)?|基础知识|附加题)"
    r"(?:\s*[（(][^）)]{0,40}[）)])?\s*[：:]?$"
)
_QUESTION_LINE = re.compile(r"^\s*\d{1,3}\s*[.．、)）]\s*\S+")
_ANSWER_SECTION = re.compile(
    r"^\s*(?:参考)?答案(?:与|及)?(?:试题)?解析\s*$|^\s*参考答案\s*$|^\s*试题解析\s*$"
)
_BILINGUAL_DOMAIN = re.compile(r"^[\u4e00-\u9fffA-Za-z& ]{2,28}[（(][A-Za-z][A-Za-z &/-]{1,45}[）)]\s*[：:]?$")
_REPORT_CAPTION_END = re.compile(
    r"(?:概览|详解|梳理|分析|说明|背景|目标|流程|框架|体系|模块|模式|机制|逻辑|"
    r"实施|评价|评估|总结|结论|建议|汇总|拆解|参与方式|培养方式|课程案例|核心问题)\s*[：:]?$"
)
_TEXTBOOK_NAME = re.compile(
    r"(?:义务教育教科书|教科书|教材|课本|教师用书|学生读本|"
    r"上册|下册|全一册|人教版|北师大版|苏教版|译林版)",
    re.IGNORECASE,
)
_TEXTBOOK_BODY = re.compile(
    r"(?:义务教育教科书|本册导引|第[一二三四五六七八九十百\d]+(?:章|单元).{0,80}"
    r"(?:小结|复习题|语文园地|写作|综合性学习))",
    re.IGNORECASE | re.DOTALL,
)


def is_k12_textbook_document(filename: str, content: str) -> bool:
    """Identify actual K12 books without treating every subject file as one."""
    name = Path(filename or "").name
    assessment_name = re.search(r"试卷|测试|练习|作业|考试|月考|期中|期末|模拟题|题库", name)
    if assessment_name:
        return False
    if _TEXTBOOK_NAME.search(name):
        return True
    if _TEXTBOOK_BODY.search((content or "")[:12000]):
        return True
    # A genuine contents block advertises several numbered lessons. A report
    # merely containing the word “目录” or “课程” is not a textbook.
    sample = (content or "")[:16000]
    has_contents = bool(re.search(r"(?m)^\s*目\s*录\s*$", sample))
    sections = set(re.findall(r"(?m)^\s*\d{1,2}\s*[.．]\s*\d{1,2}\s+", sample))
    return has_contents and len(sections) >= 4


def _is_report_heading(line: str) -> tuple[bool, int]:
    """Return whether a plain line is a report heading and its Markdown level."""
    compact = re.sub(r"\s+", " ", line).strip()
    if not compact or len(compact) > 72 or "://" in compact:
        return False, 0
    # PDF table headers are sometimes flattened into one line.  They may end
    # in words such as “评价/分析”, but promoting them creates unreadable
    # directory entries.  Keep the row in body text instead.
    if "|" in compact or (compact.count("官方") >= 2 and "/" in compact):
        return False, 0
    if _QUESTION_LINE.match(compact) or re.match(r"^[①②③④⑤⑥⑦⑧⑨⑩]", compact):
        return False, 0
    if compact.endswith(("。", "！", "？", ".", "!", "?", ";", "；")):
        return False, 0
    if _BILINGUAL_DOMAIN.match(compact):
        return True, 2
    if re.search(r"(?:分析|研究|报告)[（(][^）)]{2,60}[）)]$", compact):
        return True, 1
    if compact.endswith(("：", ":")) and len(compact) <= 42:
        return True, 1
    if _REPORT_CAPTION_END.search(compact) and len(compact) <= 52:
        return True, 1
    return False, 0


def structure_non_textbook_document(markdown: str, filename: str) -> tuple[str, dict]:
    """Add reliable headings to an exam/report while preserving full content."""
    source = clean_course_text(markdown) or ""
    if not source:
        return source, {"strategy": "empty", "headings": 0}

    # Office documents frequently use Word/PPT "Heading" styles for every
    # numbered question.  Those style-derived Markdown headings are not a
    # usable learning outline.  Detect assessment material before trusting the
    # source hierarchy, and rebuild only that profile from plain source lines.
    assessment_name = bool(re.search(
        r"试卷|测试|练习|作业|考试|月考|期中|期末|模拟题|题库|测验|卷子",
        filename or "",
    ))
    plain_source = re.sub(r"(?m)^\s*#{1,6}\s+", "", source)
    preliminary_lines = [line.strip() for line in plain_source.splitlines() if line.strip()]
    preliminary_types = [line for line in preliminary_lines if _QUESTION_TYPE.match(line)]
    preliminary_questions = [line for line in preliminary_lines if _QUESTION_LINE.match(line)]
    preliminary_answer_cues = sum(bool(re.search(
        r"[？?]|_{2,}|（\s*）|\(\s*\)|(?:本题|每题|共)\s*\d+\s*分|"
        r"(?:请选择|求证|证明|计算|解答|作图|填空)",
        line,
    )) for line in preliminary_questions)
    likely_assessment = bool(
        assessment_name
        or preliminary_types
        or (len(preliminary_questions) >= 5 and preliminary_answer_cues >= 2)
    )
    source_heading_count = len(_MARKDOWN_HEADING.findall(source))
    if source_heading_count >= 2 and not likely_assessment:
        return source, {"strategy": "source_headings", "headings": source_heading_count}
    if likely_assessment:
        source = plain_source

    raw_lines = [line.strip() for line in source.splitlines()]
    nonempty = [line for line in raw_lines if line]
    counts = Counter(nonempty)
    stem = Path(filename or "资料").stem.strip()

    cleaned_lines: list[str] = []
    removed_layout_lines = 0
    for line in raw_lines:
        if not line:
            cleaned_lines.append("")
            continue
        if _PAGE_MARKER.match(line):
            removed_layout_lines += 1
            continue
        # Repeated long page headers are layout artefacts. Exact repeated body
        # rows are retained unless they closely match the document title.
        title_similarity = len(stem) >= 6 and (stem in line or line in stem)
        if counts[line] >= 3 and (title_similarity or len(line) >= 28):
            removed_layout_lines += 1
            continue
        cleaned_lines.append(line)

    question_lines = [line for line in cleaned_lines if _QUESTION_LINE.match(line)]
    question_type_lines = [line for line in cleaned_lines if _QUESTION_TYPE.match(line)]
    answer_cues = sum(bool(re.search(
        r"[？?]|_{2,}|（\s*）|\(\s*\)|(?:本题|每题|共)\s*\d+\s*分|"
        r"(?:请选择|求证|证明|计算|解答|作图|填空)",
        line,
    )) for line in question_lines)
    is_assessment = likely_assessment or bool(
        question_type_lines or (len(question_lines) >= 5 and answer_cues >= 2)
    )
    has_answer_section = is_assessment and any(_ANSWER_SECTION.match(line) for line in cleaned_lines)
    output: list[str] = []
    headings = 0
    report_heading_counts = Counter(
        line.rstrip("：:")
        for line in cleaned_lines
        if _is_report_heading(line)[0]
    ) if not is_assessment else Counter()
    question_group_started = False
    in_answer_section = False
    for line in cleaned_lines:
        if not line:
            if output and output[-1] != "":
                output.append("")
            continue
        if is_assessment and _ANSWER_SECTION.match(line):
            answer_title = re.sub(r"\s+", " ", line).strip()
            output.append(f"# {answer_title}")
            headings += 1
            in_answer_section = True
            continue
        question_type = _QUESTION_TYPE.match(line) if is_assessment else None
        if question_type:
            if has_answer_section and not in_answer_section and not question_group_started:
                output.append("# 试题")
                headings += 1
                question_group_started = True
            level = 2 if has_answer_section else 1
            output.append(f"{'#' * level} {line.rstrip('：:')}")
            headings += 1
            continue
        is_heading, level = _is_report_heading(line)
        if not is_assessment and is_heading:
            title = line.rstrip("：:")
            # Generic captions repeated under several topics should remain
            # visible in the source text, but a duplicate directory label is
            # ambiguous and offers no useful navigation.
            if report_heading_counts[title] > 1 and len(title) <= 24:
                output.append(line)
                continue
            output.append(f"{'#' * level} {title}")
            headings += 1
            continue
        output.append(line)

    # A question paper without printed type labels is still one coherent,
    # readable unit; individual question lines must never flood the directory.
    if is_assessment and headings == 0:
        first_content = next((i for i, line in enumerate(output) if line), 0)
        output.insert(first_content, "# 试卷题目")
        headings = 1

    structured = "\n".join(output).strip()
    return structured, {
        "strategy": "assessment" if is_assessment else "report",
        "headings": headings,
        "removed_layout_lines": removed_layout_lines,
    }


def document_quality_notice(markdown: str, filename: str, structure_report: dict) -> dict | None:
    """Return one actionable, learner-facing notice for a usable weak source."""
    text = markdown or ""
    visible_chars = len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))
    image_placeholders = len(re.findall(r"\[(?:pic|image|图片)\]", text, re.IGNORECASE))
    if image_placeholders >= 5:
        return {
            "code": "EMBEDDED_MEDIA_NOT_TEXT",
            "title": "部分公式或图片需要核对",
            "message": (
                f"已读取正文并生成学习结构，但检测到 {image_placeholders} 处嵌入公式或图片"
                "无法直接转换为文字。建议将原文件另存为清晰 PDF 或 DOCX 后重新上传；"
                "当前资料仍可继续查看和学习。"
            ),
            "action": "replace_optional",
        }
    if visible_chars < 120:
        return {
            "code": "LOW_TEXT_CONTENT",
            "title": "可读取的正文较少",
            "message": (
                "文件可以打开，但可识别文字较少。若原文件主要是扫描图片、截图或复杂公式，"
                "建议上传更清晰的 PDF，或导出为可搜索的 PDF/DOCX 后重试。"
            ),
            "action": "replace_optional",
        }
    if structure_report.get("headings", 0) == 0 and structure_report.get("strategy") not in {
        "source_headings", "k12_textbook",
    }:
        return {
            "code": "SEMANTIC_STRUCTURE_USED",
            "title": "未检测到明确目录",
            "message": (
                "系统已保留全文，并按正文语义自动整理学习区块。建议进入学习空间后快速核对章节名称；"
                "这不会把资料自动归入数学、语文或英语教材。"
            ),
            "action": "review_outline",
        }
    return None
