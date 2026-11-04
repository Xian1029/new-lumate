from services.ingestion.semantic_outline import _parse_boundaries, apply_section_boundaries


def test_ai_boundaries_only_insert_headings_and_keep_every_paragraph():
    paragraphs = ["第一段完整正文。", "第二段完整正文。", "第三段完整正文。"]
    result = apply_section_boundaries(paragraphs, [(0, "第一章"), (2, "第二章")])
    assert result == "# 第一章\n\n第一段完整正文。\n\n第二段完整正文。\n\n# 第二章\n\n第三段完整正文。"
    assert all(paragraph in result for paragraph in paragraphs)


def test_ai_outline_discards_sentence_like_titles():
    raw = '{"sections":[{"start":0,"title":"内容类型能力分析"},{"start":2,"title":"从内容结构看，大致可分为以下几个板块"}]}'
    assert _parse_boundaries(raw, 0, 4) == [(0, "内容类型能力分析")]
