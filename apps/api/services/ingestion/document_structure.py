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
_ASSESSMENT_ANSWER_CUE = re.compile(
    r"_{2,}|（\s*）|\(\s*\)|(?:本题|每题|共)\s*\d+\s*分|"
    r"(?:请选择|求证|证明|计算|解答|作图|填空)|"
    r"(?:^|\s)[A-D][.．、]\s*\S+"
)
_ANSWER_SECTION = re.compile(
    r"^\s*(?:参考)?答案(?:与|及)?(?:试题)?解析\s*$|^\s*参考答案\s*$|^\s*试题解析\s*$"
)
_BILINGUAL_DOMAIN = re.compile(r"^[\u4e00-\u9fffA-Za-z& ]{2,28}[（(][A-Za-z][A-Za-z &/-]{1,45}[）)]\s*[：:]?$")
_REPORT_CAPTION_END = re.compile(
    r"(?:概览|详解|梳理|分析|说明|背景|目标|流程|框架|体系|模块|模式|机制|逻辑|"
    r"实施|评价|评估|总结|结论|建议|汇总|拆解|参与方式|培养方式|课程案例|核心问题)\s*[：:]?$"
)
_PROSE_HEADING_START = re.compile(r"^(?:例如|比如|尤其|其中|此外|因此|综上|总之|从.+(?:来看|来说)|内容中|其账号|代表作品)")
_BUSINESS_REPORT_NAME = re.compile(r"(?:公司|企业|账号|作品情况|运营|财务|市场|商业|投融资|客户).{0,20}(?:分析|报告|汇总|概览|调研)|(?:分析|报告).{0,20}(?:公司|企业|账号|作品)")
_OPERATIONS_DOCUMENT_NAME = re.compile(r"(?:合同|发票|收据|报价单|采购单|会议纪要|简历|行政通知|财务报表|运营周报|工作总结)")
_STUDY_NAME = re.compile(r"(?:教材|教科书|课本|讲义|知识点|课程|学习|试卷|习题|练习|题库|教案)")
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


def is_reference_only_document(filename: str, markdown: str, *, low_text: bool = False) -> bool:
    """Conservatively keep business reports and nearly empty files as reading sources.

    Academic reports and ordinary handouts remain eligible for study features.
    """
    name = Path(filename or "").stem
    if low_text and not is_question_only_document(filename, markdown):
        return True
    return bool((_BUSINESS_REPORT_NAME.search(name) or _OPERATIONS_DOCUMENT_NAME.search(name)) and not _STUDY_NAME.search(name))


def is_question_only_document(filename: str, markdown: str) -> bool:
    """Identify assessment materials independently of their file format."""
    name = Path(filename or "").stem
    if re.search(r"试卷|测试|练习|作业|考试|月考|期中|期末|模拟题|题库|测验|卷子", name):
        return True
    lines = [re.sub(r"^\s*#{1,6}\s+", "", line).strip() for line in (markdown or "").splitlines()]
    numbered_questions = [line for line in lines if _QUESTION_LINE.match(line)]
    questions = len(numbered_questions)
    groups = sum(bool(_QUESTION_TYPE.match(line)) for line in lines)
    answer_cues = sum(bool(_ASSESSMENT_ANSWER_CUE.search(line)) for line in numbered_questions)
    return questions >= 5 and (groups >= 1 or (questions >= 10 and answer_cues >= 2)) and not is_k12_textbook_document(filename, markdown)


def assessment_excerpt(markdown: str, max_chars: int = 4000) -> str:
    """Sample readable question text across a long section at bounded cost."""
    lines = [
        re.sub(r"\[(?:pic|image|图片)\]", "[图像内容未识别]", line, flags=re.IGNORECASE).strip()
        for line in (markdown or "").splitlines()
    ]
    lines = [line for line in lines if line and line != "[图像内容未识别]"]
    if not lines:
        return ""
    full = "\n".join(lines)
    if len(full) <= max_chars:
        return full
    # Choose bounded line windows from the beginning, middle, and end. This
    # avoids a 100-page paper being represented only by its first questions.
    slots = max(3, min(30, max_chars // 140))
    indices = sorted({round(i * (len(lines) - 1) / (slots - 1)) for i in range(slots)})
    selected: list[str] = []
    used = 0
    for index in indices:
        line = lines[index][:300]
        if used + len(line) + 1 > max_chars:
            break
        selected.append(line)
        used += len(line) + 1
    return "\n".join(selected)


def assessment_note_source(node, nodes: list, max_chars: int = 4000) -> str:
    """Give each question/answer section its own grounded concept-note input."""
    source = node.content or ""
    if "【答案】" in source:
        question = next((
            item for item in nodes
            if item.id != node.id and item.title == node.title
            and item.content_category == "assessment"
            and item.content and "【答案】" not in item.content
        ), None)
        if question:
            source = f"题干：\n{question.content}\n\n对应解析：\n{source}"
    return assessment_excerpt(source, max_chars)


def is_unreadable_assessment(filename: str, markdown: str) -> bool:
    """An exam missing its embedded formula/image content is not a safe quiz source."""
    if not re.search(r"试卷|测试|练习|作业|考试|月考|期中|期末|模拟题|题库|测验", filename or ""):
        return False
    placeholders = len(re.findall(r"\[(?:pic|image|图片)\]", markdown or "", re.IGNORECASE))
    questions = sum(bool(_QUESTION_LINE.match(line)) for line in (markdown or "").splitlines())
    return placeholders >= 5 and (questions == 0 or placeholders >= questions)


def _is_structural_source_heading(title: str, *, strict: bool = False) -> bool:
    compact = re.sub(r"\s+", " ", title).strip()
    if len(compact) > 42 or re.search(r"[，。！？；,!?;]", compact) or _PROSE_HEADING_START.match(compact):
        return False
    if re.match(r"^(?:第[一二三四五六七八九十百\d]+[章节单元]|\d+(?:\.\d+)*[.、．\s])", compact):
        return True
    return _is_report_heading(compact)[0] or (not strict and len(compact) <= 18)


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
    preliminary_answer_cues = sum(bool(_ASSESSMENT_ANSWER_CUE.search(line)) for line in preliminary_questions)
    likely_assessment = bool(
        assessment_name
        or preliminary_types
        or (len(preliminary_questions) >= 5 and preliminary_answer_cues >= 2)
    )
    # Word styles can mark body fragments as headings. Preserve the text but
    # demote sentence-like headings before the generic Markdown tree parser.
    if not likely_assessment:
        strict_report = is_reference_only_document(filename, source)
        source = re.sub(
            r"(?m)^(\s*)#{1,6}\s+([^\n]+)$",
            lambda match: match.group(0) if _is_structural_source_heading(match.group(2), strict=strict_report) else match.group(1) + match.group(2),
            source,
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
    answer_cues = sum(bool(_ASSESSMENT_ANSWER_CUE.search(line)) for line in question_lines)
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
    if is_unreadable_assessment(filename, text):
        return {
            "code": "EXAM_MEDIA_UNREADABLE",
            "title": "试卷中的公式和图片尚未识别完整",
            "message": (
                "已保留原文件；系统会从可识别的题干和解析中梳理知识点，生成知识图谱、测验和闪卡。"
                "图片及公式中的具体题意仍需对照原件核对；可上传可搜索的 PDF/DOCX 提高准确度。"
            ),
            "action": "replace_optional",
        }
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
