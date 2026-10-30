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
