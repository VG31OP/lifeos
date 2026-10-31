from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import bindparam, select
from pgvector.sqlalchemy import Vector
from typing import List, Optional
from app.database import get_db
from app.schemas import MemoryCreate, MemoryUpdate, MemoryResponse
from app.models import EMBEDDING_DIMENSION, Memory
from app.routes.auth import get_current_active_user
from app.models import User
from app.ai_service import ai_service

router = APIRouter(prefix="/memories", tags=["memories"])


@router.post("", response_model=MemoryResponse)
async def create_memory(
    memory_data: MemoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not memory_data.consented:
        raise HTTPException(status_code=400, detail="Explicit consent is required to save a memory")

    # Generate embedding for semantic search
    embedding = await ai_service.get_embedding(memory_data.content)

    memory = Memory(
        user_id=current_user.id,
        content=memory_data.content,
        memory_type=memory_data.memory_type,
        embedding=embedding,
        consented=memory_data.consented,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return memory


@router.get("", response_model=List[MemoryResponse])
async def list_memories(
    memory_type: Optional[str] = Query(None, pattern="^(preference|fact|goal|note)$"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Memory).where(Memory.user_id == current_user.id, Memory.consented.is_(True))
    if memory_type:
        query = query.where(Memory.memory_type == memory_type)
    query = query.order_by(Memory.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/search", response_model=List[MemoryResponse])
async def search_memories(
    query: str = Query(..., min_length=1),
    memory_type: Optional[str] = Query(None, pattern="^(preference|fact|goal|note)$"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from sqlalchemy import text, select
    from app.config import settings

    if "postgresql" in settings.DATABASE_URL:
        # Generate embedding for the search query
        query_embedding = await ai_service.get_embedding(query)

        # Use pgvector for semantic search
        sql = text("""
            SELECT *, 1 - (embedding <=> :query_embedding) as similarity
            FROM memories
            WHERE user_id = :user_id
            AND (:memory_type IS NULL OR memory_type = :memory_type)
            ORDER BY embedding <=> :query_embedding
            LIMIT :limit
        """)

        result = await db.execute(
            sql,
            {
                "query_embedding": query_embedding,
                "user_id": current_user.id,
                "memory_type": memory_type,
                "limit": limit,
            }
        )

        memories = []
        for row in result:
            memory = Memory(
                id=row.id,
                user_id=row.user_id,
                content=row.content,
                memory_type=row.memory_type,
                embedding=row.embedding,
                consented=row.consented,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            memories.append(memory)

        return memories
    else:
        stmt = select(Memory).where(Memory.user_id == current_user.id)
        if memory_type:
            stmt = stmt.where(Memory.memory_type == memory_type)
        stmt = stmt.where(Memory.content.ilike(f"%{query}%")).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Memory).where(Memory.id == memory_id, Memory.user_id == current_user.id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int,
    memory_data: MemoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Memory).where(Memory.id == memory_id, Memory.user_id == current_user.id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    update_data = memory_data.model_dump(exclude_unset=True)

    # Regenerate embedding if content changed
    if "content" in update_data:
        memory.embedding = await ai_service.get_embedding(update_data["content"])

    for field, value in update_data.items():
        setattr(memory, field, value)

    await db.commit()
    await db.refresh(memory)
    return memory


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Memory).where(Memory.id == memory_id, Memory.user_id == current_user.id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    await db.delete(memory)
    await db.commit()
    return {"message": "Memory deleted successfully"}