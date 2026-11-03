from pathlib import Path

from services.ingestion.document_loader_formats import _extract_pptx_fallback


def test_pptx_extraction_preserves_sections_and_slide_order(tmp_path: Path) -> None:
    from pptx import Presentation

    source = tmp_path / "结构化演示.pptx"
    presentation = Presentation()

    cover = presentation.slides.add_slide(presentation.slide_layouts[0])
    cover.shapes.title.text = "项目分析报告"
    cover.placeholders[1].text = "汇报说明"

    section = presentation.slides.add_slide(presentation.slide_layouts[2])
    section.shapes.title.text = "CHAPTER 01"
    section.placeholders[1].text = "第一部分 基础情况"

    topic = presentation.slides.add_slide(presentation.slide_layouts[1])
    topic.shapes.title.text = "核心指标"
    topic.placeholders[1].text = "指标正文"
    presentation.save(source)

    _, markdown = _extract_pptx_fallback(str(source))

    assert "<!-- OPENTUTOR_SLIDE:1 -->" in markdown
    assert "# 第一部分 基础情况" in markdown
    assert "## 核心指标" in markdown
    assert markdown.index("项目分析报告") < markdown.index("第一部分 基础情况") < markdown.index("核心指标")
    assert "Slide 301" not in markdown
