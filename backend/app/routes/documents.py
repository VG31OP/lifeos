import os
import uuid
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.database import get_db
from app.schemas import DocumentResponse, DocumentChunkResponse
from app.models import Document, DocumentChunk
from app.routes.auth import get_current_active_user
from app.models import User
from app.ai_service import ai_service

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# MIME type validation - secure mapping of extensions to expected MIME types
ALLOWED_MIME_TYPES = {
    "text/plain": [".txt", ".md"],
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
}

# Map extensions to MIME types for verification
EXTENSION_TO_MIME = {
    ".txt": "text/plain",
    ".md": "text/plain",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# File signatures (magic bytes) for MIME type verification
FILE_SIGNATURES = {
    "application/pdf": [b"%PDF"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],  # ZIP-based formats
    "text/plain": [],  # No specific signature for plain text
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CHUNK_SIZE = 64 * 1024  # 64KB chunks for streaming


def validate_mime_type(file_content: bytes, file_ext: str) -> tuple[bool, str]:
    """Validate file MIME type matches expected type for extension using file signatures."""
    try:
        expected_mime = EXTENSION_TO_MIME.get(file_ext.lower())
        
        if not expected_mime:
            return False, f"Unsupported file extension: {file_ext}"
        
        # Check file signature (magic bytes) for binary formats
        signatures = FILE_SIGNATURES.get(expected_mime, [])
        if signatures:
            # Check if content starts with any of the expected signatures
            match_found = False
            for sig in signatures:
                if file_content.startswith(sig):
                    match_found = True
                    break
            if not match_found:
                return False, f"File content does not match expected type {expected_mime} (invalid file signature)"
        else:
            # For text files, do a basic validation - ensure it's valid UTF-8
            try:
                file_content[:1024].decode('utf-8')
            except UnicodeDecodeError:
                return False, f"File content is not valid UTF-8 text"
        
        return True, expected_mime
    except Exception as e:
        return False, f"MIME type validation failed: {str(e)}"


def extract_text_from_file(file_path: Path, file_type: str) -> str:
    """Extract text from uploaded file"""
    try:
        if file_type in [".txt", ".md"]:
            return file_path.read_text(encoding="utf-8")
        elif file_type == ".pdf":
            # Simple PDF extraction - in production use pypdf or pdfplumber
            import pypdf
            text = ""
            with open(file_path, "rb") as f:
                reader = pypdf.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            return text
        elif file_type == ".docx":
            import docx
            doc = docx.Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])
        else:
            return ""
    except Exception as e:
        return f"[Error extracting text: {str(e)}]"


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks"""
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        # Try to break at sentence boundary
        if end < len(text):
            last_period = text.rfind(".", start, end)
            if last_period > start:
                end = last_period + 1
        chunks.append(text[start:end])
        start = end - overlap
    return chunks


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in EXTENSION_TO_MIME:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed extensions: {list(EXTENSION_TO_MIME.keys())}")

    # Stream file content with size limit enforcement
    content_chunks = []
    total_size = 0
    
    async for chunk in file.iter_chunked(CHUNK_SIZE):
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)}MB")
        content_chunks.append(chunk)
    
    content = b"".join(content_chunks)
    
    # Validate MIME type against file content (not just extension)
    is_valid_mime, mime_result = validate_mime_type(content, file_ext)
    if not is_valid_mime:
        raise HTTPException(status_code=400, detail=mime_result)

    # Save file
    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}{file_ext}"
    file_path = UPLOAD_DIR / saved_filename
    file_path.write_bytes(content)

    # Create document record
    document = Document(
        user_id=current_user.id,
        filename=saved_filename,
        original_filename=file.filename,
        file_type=file_ext,
        file_size=len(content),
        processing_status="processing",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Process document in background (simplified - in production use background tasks)
    try:
        extracted_text = extract_text_from_file(file_path, file_ext)
        chunks = chunk_text(extracted_text)

        document.content = extracted_text
        document.chunk_count = len(chunks)
        document.processing_status = "completed"

        # Create chunks with embeddings
        for i, chunk_text in enumerate(chunks):
            embedding = await ai_service.get_embedding(chunk_text)
            chunk = DocumentChunk(
                document_id=document.id,
                chunk_index=i,
                content=chunk_text,
                embedding=embedding,
            )
            db.add(chunk)

        await db.commit()
        await db.refresh(document)

    except Exception as e:
        document.processing_status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

    return document


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Document).where(Document.user_id == current_user.id).order_by(Document.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/{document_id}/chunks", response_model=List[DocumentChunkResponse])
async def get_document_chunks(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Verify document ownership
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    return result.scalars().all()


@router.get("/{document_id}/search", response_model=List[DocumentChunkResponse])
async def search_document(
    document_id: int,
    query: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Verify document ownership
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    query_embedding = await ai_service.get_embedding(query)

    from sqlalchemy import text

    sql = text("""
        SELECT *, 1 - (embedding <=> :query_embedding) as similarity
        FROM document_chunks
        WHERE document_id = :document_id
        ORDER BY embedding <=> :query_embedding
        LIMIT :limit
    """)

    result = await db.execute(
        sql,
        {"query_embedding": query_embedding, "document_id": document_id, "limit": limit}
    )

    chunks = []
    for row in result:
        chunk = DocumentChunk(
            id=row.id,
            document_id=row.document_id,
            chunk_index=row.chunk_index,
            content=row.content,
            embedding=row.embedding,
            page_number=row.page_number,
            created_at=row.created_at,
        )
        chunks.append(chunk)

    return chunks


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    file_path = UPLOAD_DIR / document.filename
    if file_path.exists():
        file_path.unlink()

    await db.delete(document)
    await db.commit()
    return {"message": "Document deleted successfully"}