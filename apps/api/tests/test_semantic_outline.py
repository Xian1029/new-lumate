from services.ingestion.semantic_outline import apply_section_boundaries


def test_ai_boundaries_only_insert_headings_and_keep_every_paragraph():
    paragraphs = ["第一段完整正文。", "第二段完整正文。", "第三段完整正文。"]
    result = apply_section_boundaries(paragraphs, [(0, "第一章"), (2, "第二章")])
    assert result == "# 第一章\n\n第一段完整正文。\n\n第二段完整正文。\n\n# 第二章\n\n第三段完整正文。"
    assert all(paragraph in result for paragraph in paragraphs)
