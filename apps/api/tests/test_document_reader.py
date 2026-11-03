from services.pdf_reader import document_evidence, prompts


def test_document_evidence_uses_a_small_window_around_the_selection() -> None:
    content = "开头" * 900 + "需要精读的关键内容" + "结尾" * 900

    source = document_evidence(content, "需要精读的关键内容")

    assert source is not None
    assert "需要精读的关键内容" in source["text"]
    assert len(source["text"]) <= 4200
    assert source["label"] == "文档原文"


def test_document_prompt_is_grounded_in_document_source() -> None:
    source = document_evidence("# 第一章\n这是一段文档正文。", "这是一段文档正文")
    assert source is not None
    source["label"] = "学习资料.docx"

    system, user_prompt = prompts("这是一段文档正文", "它是什么意思？", source)

    assert "只依据提供的资料正文" in system
    assert "学习资料.docx（唯一证据）" in user_prompt
    assert "它是什么意思？" in user_prompt
