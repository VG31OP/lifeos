import io
import zipfile

import pytest
from fastapi import HTTPException

from app.routes.documents import chunk_text, validate_upload


def test_upload_requires_matching_pdf_signature():
    with pytest.raises(HTTPException) as error:
        validate_upload("report.pdf", b"not a pdf")

    assert error.value.status_code == 400


def test_upload_rejects_non_utf8_text():
    with pytest.raises(HTTPException, match="UTF-8"):
        validate_upload("notes.txt", b"\xff")


def test_upload_accepts_utf8_markdown_and_sanitizes_path_separators():
    assert validate_upload(r"C:\\private\\notes.md", b"# Notes") == ".md"


def test_upload_rejects_docx_archive_with_traversal_path():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", "<document/>")
        archive.writestr("../outside.txt", "unsafe")

    with pytest.raises(HTTPException, match="DOCX"):
        validate_upload("report.docx", buffer.getvalue())


def test_chunking_overlaps_without_losing_text():
    text = "a" * 2500

    chunks = chunk_text(text, chunk_size=1000, overlap=200)

    assert len(chunks) == 3
    assert chunks[0][-200:] == chunks[1][:200]
    assert chunks[1][-200:] == chunks[2][:200]
    assert chunks[-1] == text[-900:]


def test_chunking_makes_progress_with_early_sentence_boundaries():
    text = "a." * 1000

    chunks = chunk_text(text, chunk_size=100, overlap=20)

    assert len(chunks) > 1
    assert chunks[-1].endswith(text[-1])
    assert all(len(chunk) > 20 for chunk in chunks[:-1])
    assert all(chunks[index][-20:] == chunks[index + 1][:20] for index in range(len(chunks) - 1))
