with open('tests/test_comprehensive.py', 'r') as f:
    content = f.read()

# Find and fix the entire TestFileUploadSecurity class
old_class = '''class TestFileUploadSecurity:
    """Test file upload security features."""

    def test_mime_validation_pdf(self):
        """Test PDF file signature validation."""
        from app.routes.documents import validate_mime_type
        pdf_header = b"%PDF-1.5\n"
        is_valid, mime = validate_mime_type(pdf_header, ".pdf")
        assert is_valid is True
        assert mime == "application/pdf"

    def test_mime_validation_docx(self):
        """Test DOCX file signature validation."""
        from app.routes.documents import validate_mime_type
        docx_header = b"PK\x03\x04" + b"\x00" * 100
        is_valid, mime = validate_mime_type(docx_header, ".docx")
        assert is_valid is True
        assert mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    def test_mime_validation_text(self):
        """Test text file validation."""
        from app.routes.documents import validate_mime_type
        text_content = b"Hello, world!"
        is_valid, mime = validate_mime_type(text_content, ".txt")
        assert is_valid is True
        assert mime == "text/plain"

    def test_mime_rejects_invalid_text(self):
            """Test that invalid UTF-8 text files are rejected."""
        from app.routes.documents import validate_mime_type
            # Invalid UTF-8 sequence
            invalid_text = b"\xff\xfe\x00\x00"
            is_valid, mime = validate_mime_type(invalid_text, ".txt")
            assert is_valid is False

        def test_mime_rejects_unknown_extension(self):
            """Test that unknown file extensions are rejected."""
            from app.routes.documents import validate_mime_type
            content = b"test"
            is_valid, mime = validate_mime_type(content, ".exe")
            assert is_valid is False

    def test_file_size_limit_enforced(self, client):
        """Test that file size limit is enforced."""
        # Create a file larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)
        
            # Need to authenticate - create a test user and get token
            from app.config import settings
            from app.auth import create_access_token
        
            # Create access token for test user
            token = create_access_token(data={"sub": "1"})
            headers = {"Authorization": f"Bearer {token}"}
        
        response = client.post(
            "/documents/upload",
            files={"file": ("large.txt", large_content, "text/plain")},
            headers=headers
        )
        # Should reject files over 10MB (413) or invalid auth (401/403)
        assert response.status_code in [400, 401, 403, 413]'''

new_class = '''class TestFileUploadSecurity:
    """Test file upload security features."""

    def test_mime_validation_pdf(self):
        """Test PDF file signature validation."""
        from app.routes.documents import validate_mime_type
        pdf_header = b"%PDF-1.5\n"
        is_valid, mime = validate_mime_type(pdf_header, ".pdf")
        assert is_valid is True
        assert mime == "application/pdf"

    def test_mime_validation_docx(self):
        """Test DOCX file signature validation."""
        from app.routes.documents import validate_mime_type
        docx_header = b"PK\x03\x04" + b"\x00" * 100
        is_valid, mime = validate_mime_type(docx_header, ".docx")
        assert is_valid is True
        assert mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    def test_mime_validation_text(self):
        """Test text file validation."""
        from app.routes.documents import validate_mime_type
        text_content = b"Hello, world!"
        is_valid, mime = validate_mime_type(text_content, ".txt")
        assert is_valid is True
        assert mime == "text/plain"

    def test_mime_rejects_invalid_text(self):
        """Test that invalid UTF-8 text files are rejected."""
        from app.routes.documents import validate_mime_type
        # Invalid UTF-8 sequence
        invalid_text = b"\xff\xfe\x00\x00"
        is_valid, mime = validate_mime_type(invalid_text, ".txt")
        assert is_valid is False

    def test_mime_rejects_unknown_extension(self):
        """Test that unknown file extensions are rejected."""
        from app.routes.documents import validate_mime_type
        content = b"test"
        is_valid, mime = validate_mime_type(content, ".exe")
        assert is_valid is False

    def test_file_size_limit_enforced(self, client):
        """Test that file size limit is enforced."""
        # Create a file larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)
        
        # Need to authenticate - create a test user and get token
        from app.config import settings
        from app.auth import create_access_token
        
        # Create access token for test user
        token = create_access_token(data={"sub": "1"})
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.post(
            "/documents/upload",
            files={"file": ("large.txt", large_content, "text/plain")},
            headers=headers
        )
        # Should reject files over 10MB (413) or invalid auth (401/403)
        assert response.status_code in [400, 401, 403, 413]'''

content = content.replace(old_class, new_class)

with open('tests/test_comprehensive.py', 'w') as f:
    f.write(content)

print('Fixed TestFileUploadSecurity class!')