from docx import Document
from io import BytesIO
import base64

from services.ingestion.document_loader_formats import _extract_docx_fallback


def test_docx_extraction_preserves_paragraph_and_table_order(tmp_path):
    path = tmp_path / "材料.docx"
    document = Document()
    document.add_heading("第一部分", level=1)
    document.add_paragraph("表格之前")
    table = document.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "字段"
    table.cell(0, 1).text = "内容"
    table.cell(1, 0).text = "顺序"
    table.cell(1, 1).text = "保持"
    document.add_paragraph("表格之后")
    document.save(path)

    _, markdown = _extract_docx_fallback(str(path))

    assert markdown.index("# 第一部分") < markdown.index("表格之前")
    assert markdown.index("表格之前") < markdown.index("| 字段 | 内容 |")
    assert markdown.index("| 顺序 | 保持 |") < markdown.index("表格之后")


def test_docx_extraction_marks_embedded_image_in_exam(tmp_path):
    path = tmp_path / "七年级数学试卷.docx"
    document = Document()
    paragraph = document.add_paragraph("1. 观察图形，选择正确答案：")
    image = BytesIO(base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII="
    ))
    paragraph.add_run().add_picture(image)
    document.save(path)

    _, markdown = _extract_docx_fallback(str(path))

    assert "观察图形" in markdown
    assert "[pic]" in markdown
