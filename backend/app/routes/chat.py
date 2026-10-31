import json
import logging
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import bindparam, select
from pgvector.sqlalchemy import Vector
from app.database import get_db
from app.schemas import ChatRequest, ChatResponse, ToolCall, ToolResult, ExecutionLogCreate, ExecutionLogResponse
from app.models import EMBEDDING_DIMENSION, Conversation, Message, Task, Memory, Document, ExecutionLog, User
from app.routes.auth import get_current_active_user
from app.ai_service import ai_service, ToolCall as AIToolCall
from app.tool_arguments import TOOL_ARGUMENT_SCHEMAS

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

# Input sanitization utilities
MAX_STRING_LENGTH = 10000
MAX_TITLE_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000
MAX_MEMORY_CONTENT_LENGTH = 5000
MAX_SEARCH_QUERY_LENGTH = 500

# Dangerous patterns to block (SQL injection, XSS, etc.)
DANGEROUS_PATTERNS = [
    r"(?i)(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table|create\s+table|alter\s+table)",
    r"(?i)(script\s*>|javascript:|onerror\s*=|onload\s*=|onclick\s*=|eval\s*\()",
    r"(--|\|\||;|`|\$\()",
]


def sanitize_string(value: str, max_length: int = MAX_STRING_LENGTH, field_name: str = "value") -> str:
    """Sanitize a string input."""
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    
    # Trim whitespace
    value = value.strip()
    
    # Check length
    if len(value) > max_length:
        raise ValueError(f"{field_name} exceeds maximum length of {max_length}")
    
    # Check for dangerous patterns
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, value):
            raise ValueError(f"{field_name} contains potentially dangerous content")
    
    return value


def sanitize_tool_arguments(arguments: Dict[str, Any], tool_name: str) -> Dict[str, Any]:
    """Sanitize tool arguments based on tool type."""
    sanitized = {}
    
    if tool_name == "create_task":
        sanitized["title"] = sanitize_string(arguments.get("title", ""), MAX_TITLE_LENGTH, "title")
        if "description" in arguments and arguments["description"] is not None:
            sanitized["description"] = sanitize_string(arguments["description"], MAX_DESCRIPTION_LENGTH, "description")
        if "priority" in arguments:
            priority = arguments["priority"]
            if priority not in ["low", "medium", "high"]:
                raise ValueError("Invalid priority value")
            sanitized["priority"] = priority
        if "status" in arguments:
            status = arguments["status"]
            if status not in ["pending", "in_progress", "completed"]:
                raise ValueError("Invalid status value")
            sanitized["status"] = status
        if "due_date" in arguments and arguments["due_date"] is not None:
            # Validate ISO format
            try:
                datetime.fromisoformat(arguments["due_date"].replace("Z", "+00:00"))
                sanitized["due_date"] = arguments["due_date"]
            except (ValueError, AttributeError):
                raise ValueError("Invalid due_date format. Use ISO 8601 format")
    
    elif tool_name == "update_task":
        if "task_id" not in arguments:
            raise ValueError("task_id is required")
        try:
            sanitized["task_id"] = int(arguments["task_id"])
        except (ValueError, TypeError):
            raise ValueError("task_id must be an integer")
        
        for field in ["title", "description", "priority", "status", "due_date"]:
            if field in arguments and arguments[field] is not None:
                if field == "title":
                    sanitized[field] = sanitize_string(arguments[field], MAX_TITLE_LENGTH, "title")
                elif field == "description":
                    sanitized[field] = sanitize_string(arguments[field], MAX_DESCRIPTION_LENGTH, "description")
                elif field == "priority":
                    priority = arguments[field]
                    if priority not in ["low", "medium", "high"]:
                        raise ValueError("Invalid priority value")
                    sanitized[field] = priority
                elif field == "status":
                    status = arguments[field]
                    if status not in ["pending", "in_progress", "completed"]:
                        raise ValueError("Invalid status value")
                    sanitized[field] = status
                elif field == "due_date":
                    try:
                        datetime.fromisoformat(arguments[field].replace("Z", "+00:00"))
                        sanitized[field] = arguments[field]
                    except (ValueError, AttributeError):
                        raise ValueError("Invalid due_date format. Use ISO 8601 format")
    
    elif tool_name == "delete_task":
        if "task_id" not in arguments:
            raise ValueError("task_id is required")
        try:
            sanitized["task_id"] = int(arguments["task_id"])
        except (ValueError, TypeError):
            raise ValueError("task_id must be an integer")
    
    elif tool_name == "list_tasks":
        if "status" in arguments and arguments["status"] is not None:
            status = arguments["status"]
            if status not in ["pending", "in_progress", "completed"]:
                raise ValueError("Invalid status value")
            sanitized["status"] = status
        if "priority" in arguments and arguments["priority"] is not None:
            priority = arguments["priority"]
            if priority not in ["low", "medium", "high"]:
                raise ValueError("Invalid priority value")
            sanitized["priority"] = priority
        if "limit" in arguments and arguments["limit"] is not None:
            try:
                limit = int(arguments["limit"])
                if limit < 1 or limit > 100:
                    raise ValueError("limit must be between 1 and 100")
                sanitized["limit"] = limit
            except (ValueError, TypeError):
                raise ValueError("limit must be an integer")
    
    elif tool_name == "save_memory":
        sanitized["content"] = sanitize_string(arguments.get("content", ""), MAX_MEMORY_CONTENT_LENGTH, "content")
        if "memory_type" in arguments and arguments["memory_type"] is not None:
            memory_type = arguments["memory_type"]
            if memory_type not in ["preference", "fact", "skill", "note"]:
                raise ValueError("Invalid memory_type value")
            sanitized["memory_type"] = memory_type
    
    elif tool_name == "search_memories":
        sanitized["query"] = sanitize_string(arguments.get("query", ""), MAX_SEARCH_QUERY_LENGTH, "query")
        if "memory_type" in arguments and arguments["memory_type"] is not None:
            memory_type = arguments["memory_type"]
            if memory_type not in ["preference", "fact", "skill", "note"]:
                raise ValueError("Invalid memory_type value")
            sanitized["memory_type"] = memory_type
        if "limit" in arguments and arguments["limit"] is not None:
            try:
                limit = int(arguments["limit"])
                if limit < 1 or limit > 50:
                    raise ValueError("limit must be between 1 and 50")
                sanitized["limit"] = limit
            except (ValueError, TypeError):
                raise ValueError("limit must be an integer")
    
    elif tool_name == "search_documents":
        sanitized["query"] = sanitize_string(arguments.get("query", ""), MAX_SEARCH_QUERY_LENGTH, "query")
        if "document_id" in arguments and arguments["document_id"] is not None:
            try:
                sanitized["document_id"] = int(arguments["document_id"])
            except (ValueError, TypeError):
                raise ValueError("document_id must be an integer")
        if "limit" in arguments and arguments["limit"] is not None:
            try:
                limit = int(arguments["limit"])
                if limit < 1 or limit > 20:
                    raise ValueError("limit must be between 1 and 20")
                sanitized["limit"] = limit
            except (ValueError, TypeError):
                raise ValueError("limit must be an integer")
    
    else:
        raise ValueError(f"Unknown tool: {tool_name}")
    
    return sanitized


# Tool implementations
async def execute_create_task(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        task = Task(
            user_id=user_id,
            title=arguments.get("title", ""),
            description=arguments.get("description"),
            priority=arguments.get("priority", "medium"),
            status=arguments.get("status", "pending"),
        )
        if arguments.get("due_date"):
            task.due_date = datetime.fromisoformat(arguments["due_date"].replace("Z", "+00:00"))

        db.add(task)
        await db.commit()
        await db.refresh(task)

        return ToolResult(
            tool_call_id="",
            name="create_task",
            result={
                "id": task.id,
                "title": task.title,
                "status": task.status,
            },
            success=True,
        )
    except Exception:
        logger.exception("Create-task tool failed")
        return ToolResult(
            tool_call_id="",
            name="create_task",
            result=None,
            success=False,
            error="Task creation failed",
        )


async def execute_update_task(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        task_id = arguments.get("task_id")
        result = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user_id))
        task = result.scalar_one_or_none()
        if not task:
            return ToolResult(
                tool_call_id="",
                name="update_task",
                result=None,
                success=False,
                error="Task not found",
            )

        update_data = {k: v for k, v in arguments.items() if k != "task_id" and v is not None}
        if "due_date" in update_data:
            update_data["due_date"] = datetime.fromisoformat(update_data["due_date"].replace("Z", "+00:00"))

        for field, value in update_data.items():
            setattr(task, field, value)

        if arguments.get("status") == "completed" and task.completed_at is None:
            task.completed_at = datetime.utcnow()
        elif arguments.get("status") and arguments["status"] != "completed":
            task.completed_at = None

        await db.commit()
        await db.refresh(task)

        return ToolResult(
            tool_call_id="",
            name="update_task",
            result={
                "id": task.id,
                "title": task.title,
                "status": task.status,
            },
            success=True,
        )
    except Exception:
        logger.exception("Update-task tool failed")
        return ToolResult(
            tool_call_id="",
            name="update_task",
            result=None,
            success=False,
            error="Task update failed",
        )


async def execute_delete_task(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        task_id = arguments.get("task_id")
        result = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user_id))
        task = result.scalar_one_or_none()
        if not task:
            return ToolResult(
                tool_call_id="",
                name="delete_task",
                result=None,
                success=False,
                error="Task not found",
            )

        await db.delete(task)
        await db.commit()

        return ToolResult(
            tool_call_id="",
            name="delete_task",
            result={"deleted": True, "task_id": task_id},
            success=True,
        )
    except Exception:
        logger.exception("Delete-task tool failed")
        return ToolResult(
            tool_call_id="",
            name="delete_task",
            result=None,
            success=False,
            error="Task deletion failed",
        )


async def execute_list_tasks(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        query = select(Task).where(Task.user_id == user_id)
        if arguments.get("status"):
            query = query.where(Task.status == arguments["status"])
        if arguments.get("priority"):
            query = query.where(Task.priority == arguments["priority"])
        limit = arguments.get("limit", 50)
        query = query.order_by(Task.created_at.desc()).limit(limit)

        result = await db.execute(query)
        tasks = result.scalars().all()

        return ToolResult(
            tool_call_id="",
            name="list_tasks",
            result={
                "tasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "description": t.description,
                        "priority": t.priority,
                        "status": t.status,
                        "due_date": t.due_date.isoformat() if t.due_date else None,
                    }
                    for t in tasks
                ],
                "count": len(tasks),
            },
            success=True,
        )
    except Exception:
        logger.exception("List-tasks tool failed")
        return ToolResult(
            tool_call_id="",
            name="list_tasks",
            result=None,
            success=False,
            error="Task listing failed",
        )


async def execute_save_memory(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        # Check user's memory consent from database (not from tool argument)
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.memory_consent:
            return ToolResult(
                tool_call_id="",
                name="save_memory",
                result=None,
                success=False,
                error="User consent required to save memory. Enable memory consent in your profile settings.",
            )

        embedding = await ai_service.get_embedding(arguments["content"])

        memory = Memory(
            user_id=user_id,
            content=arguments["content"],
            memory_type=arguments.get("memory_type", "preference"),
            embedding=embedding,
            consented=True,
        )
        db.add(memory)
        await db.commit()
        await db.refresh(memory)

        return ToolResult(
            tool_call_id="",
            name="save_memory",
            result={
                "id": memory.id,
                "content": memory.content,
                "memory_type": memory.memory_type,
            },
            success=True,
        )
    except Exception:
        logger.exception("Save-memory tool failed")
        return ToolResult(
            tool_call_id="",
            name="save_memory",
            result=None,
            success=False,
            error="Memory save failed",
        )


async def execute_search_memories(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        query = arguments.get("query", "")
        memory_type = arguments.get("memory_type")
        limit = arguments.get("limit", 10)

        from sqlalchemy import text, select
        from app.config import settings

        memories = []
        if "postgresql" in settings.DATABASE_URL:
            query_embedding = await ai_service.get_embedding(query)

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
                {"query_embedding": query_embedding, "user_id": user_id, "memory_type": memory_type, "limit": limit}
            )

            for row in result:
                memories.append({
                    "id": row.id,
                    "content": row.content,
                    "memory_type": row.memory_type,
                    "similarity": float(row.similarity) if row.similarity else 0.0,
                })
        else:
            stmt = select(Memory).where(Memory.user_id == user_id)
            if memory_type:
                stmt = stmt.where(Memory.memory_type == memory_type)
            stmt = stmt.where(Memory.content.ilike(f"%{query}%")).limit(limit)
            result = await db.execute(stmt)
            for m in result.scalars().all():
                memories.append({
                    "id": m.id,
                    "content": m.content,
                    "memory_type": m.memory_type,
                    "similarity": 1.0,
                })

        return ToolResult(
            tool_call_id="",
            name="search_memories",
            result={"memories": memories, "count": len(memories)},
            success=True,
        )
    except Exception:
        logger.exception("Search-memories tool failed")
        return ToolResult(
            tool_call_id="",
            name="search_memories",
            result=None,
            success=False,
            error="Memory search failed",
        )


async def execute_search_documents(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        query = arguments.get("query", "")
        document_id = arguments.get("document_id")
        limit = arguments.get("limit", 5)

        # Verify document ownership if specified
        if document_id:
            result = await db.execute(select(Document).where(Document.id == document_id, Document.user_id == user_id))
            doc = result.scalar_one_or_none()
            if not doc:
                return ToolResult(
                    tool_call_id="",
                    name="search_documents",
                    result=None,
                    success=False,
                    error="Document not found",
                )

        from sqlalchemy import text, select
        from app.config import settings

        chunks = []
        if "postgresql" in settings.DATABASE_URL:
            query_embedding = await ai_service.get_embedding(query)

            if document_id:
                sql = text("""
                    SELECT *, 1 - (embedding <=> :query_embedding) as similarity
                    FROM document_chunks
                    WHERE document_id = :document_id
                    ORDER BY embedding <=> :query_embedding
                    LIMIT :limit
                """)
                params = {"query_embedding": query_embedding, "document_id": document_id, "limit": limit}
            else:
                sql = text("""
                    SELECT dc.*, d.filename, 1 - (dc.embedding <=> :query_embedding) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE d.user_id = :user_id
                    ORDER BY dc.embedding <=> :query_embedding
                    LIMIT :limit
                """)
                params = {"query_embedding": query_embedding, "user_id": user_id, "limit": limit}

            result = await db.execute(sql, params)

            for row in result:
                chunks.append({
                    "id": row.id,
                    "document_id": row.document_id,
                    "chunk_index": row.chunk_index,
                    "content": row.content,
                    "page_number": row.page_number,
                    "similarity": float(row.similarity) if row.similarity else 0.0,
                    "document_filename": getattr(row, "filename", None),
                })
        else:
            if document_id:
                stmt = select(DocumentChunk).where(
                    DocumentChunk.document_id == document_id,
                    DocumentChunk.content.ilike(f"%{query}%")
                ).limit(limit)
                res = await db.execute(stmt)
                for c in res.scalars().all():
                    chunks.append({
                        "id": c.id,
                        "document_id": c.document_id,
                        "chunk_index": c.chunk_index,
                        "content": c.content,
                        "page_number": c.page_number,
                        "similarity": 1.0,
                        "document_filename": None,
                    })
            else:
                stmt = select(DocumentChunk, Document.filename).join(Document, DocumentChunk.document_id == Document.id).where(
                    Document.user_id == user_id,
                    DocumentChunk.content.ilike(f"%{query}%")
                ).limit(limit)
                res = await db.execute(stmt)
                for c, fname in res.all():
                    chunks.append({
                        "id": c.id,
                        "document_id": c.document_id,
                        "chunk_index": c.chunk_index,
                        "content": c.content,
                        "page_number": c.page_number,
                        "similarity": 1.0,
                        "document_filename": fname,
                    })

        return ToolResult(
            tool_call_id="",
            name="search_documents",
            result={"chunks": chunks, "count": len(chunks)},
            success=True,
        )
    except Exception:
        logger.exception("Search-documents tool failed")
        return ToolResult(
            tool_call_id="",
            name="search_documents",
            result=None,
            success=False,
            error="Document search failed",
        )


TOOL_FUNCTIONS = {
    "create_task": execute_create_task,
    "update_task": execute_update_task,
    "delete_task": execute_delete_task,
    "list_tasks": execute_list_tasks,
    "save_memory": execute_save_memory,
    "search_memories": execute_search_memories,
    "search_documents": execute_search_documents,
}


def validate_tool_arguments(tool_call: AIToolCall) -> Optional[Dict[str, Any]]:
    schema = TOOL_ARGUMENT_SCHEMAS.get(tool_call.name)
    if schema is None:
        return None
    try:
        return schema.model_validate(tool_call.arguments).model_dump(mode="json", exclude_none=True)
    except Exception:
        return None


async def execute_tool_call(
    tool_call: AIToolCall,
    user_id: int,
    db: AsyncSession,
    validated_arguments: Optional[Dict[str, Any]] = None,
) -> ToolResult:
    """Execute a single tool call"""
    func = TOOL_FUNCTIONS.get(tool_call.name)
    if not func:
        return ToolResult(
            tool_call_id=tool_call.id,
            name=tool_call.name,
            result=None,
            success=False,
            error=f"Unknown tool: {tool_call.name}",
        )

    # Sanitize arguments before execution
    try:
        sanitized_args = sanitize_tool_arguments(tool_call.arguments, tool_call.name)
    except ValueError as e:
        return ToolResult(
            tool_call_id=tool_call.id,
            name=tool_call.name,
            result=None,
            success=False,
            error=f"Input validation failed: {str(e)}",
        )

    result = await func(sanitized_args, user_id, db)
    result.tool_call_id = tool_call.id
    return result


async def verify_tool_result(tool_result: ToolResult, user_id: int, db: AsyncSession) -> Dict[str, Any]:
    if not tool_result.success:
        return {"verified": False, "reason": "tool_execution_failed"}

    result = tool_result.result or {}
    if tool_result.name in {"create_task", "update_task"}:
        task_result = await db.execute(
            select(Task).where(Task.id == result.get("id"), Task.user_id == user_id)
        )
        task = task_result.scalar_one_or_none()
        verified = bool(task and task.title == result.get("title") and task.status == result.get("status"))
        return {"verified": verified, "method": "database_readback"}

    if tool_result.name == "delete_task":
        task_result = await db.execute(
            select(Task).where(Task.id == result.get("task_id"), Task.user_id == user_id)
        )
        return {
            "verified": task_result.scalar_one_or_none() is None,
            "method": "database_readback",
        }

    if tool_result.name == "save_memory":
        memory_result = await db.execute(
            select(Memory).where(
                Memory.id == result.get("id"),
                Memory.user_id == user_id,
                Memory.consented.is_(True),
            )
        )
        memory = memory_result.scalar_one_or_none()
        verified = bool(
            memory
            and memory.content == result.get("content")
            and memory.memory_type == result.get("memory_type")
        )
        return {"verified": verified, "method": "database_readback"}

    return {"verified": True, "method": "query_result"}


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Get or create conversation
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == request.conversation_id, Conversation.user_id == current_user.id)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(user_id=current_user.id, title="New Conversation")
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.message,
    )
    db.add(user_message)
    await db.commit()

    # Get conversation history
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(40)
    )
    messages = list(reversed(result.scalars().all()))

    # Format messages for AI
    ai_messages = [
        {"role": m.role, "content": m.content}
        for m in messages
    ]

    # Get AI response
    try:
        response = await ai_service.chat_completion(ai_messages)
        tool_calls = ai_service.parse_tool_calls(response)
    except Exception as e:
        ai_content = f"Message received: \"{request.message}\". (Note: AI service response unavailable - please ensure NEBIUS_API_KEY is configured in backend/.env: {str(e)})"
        tool_calls = []
        response = None

    # Execute tool calls
    execution_logs = []
    tool_results = []

    for tool_call in tool_calls:
        validated_arguments = validate_tool_arguments(tool_call)
        # Log execution start
        exec_log = ExecutionLog(
            user_id=current_user.id,
            conversation_id=conversation.id,
            request=request.message,
            tool_name=tool_call.name,
            tool_input=validated_arguments if validated_arguments is not None else tool_call.arguments,
        )
        db.add(exec_log)
        await db.commit()

        # Execute tool
        tool_result = await execute_tool_call(
            tool_call,
            current_user.id,
            db,
            validated_arguments,
        )
        tool_results.append(tool_result)

        # Update execution log with result
        exec_log.tool_output = tool_result.result
        exec_log.success = tool_result.success
        exec_log.error_message = tool_result.error
        try:
            exec_log.verification_result = await verify_tool_result(
                tool_result,
                current_user.id,
                db,
            )
        except Exception:
            logger.exception("Tool result read-back verification failed")
            await db.rollback()
            exec_log = await db.get(ExecutionLog, exec_log.id)
            if exec_log is None:
                raise RuntimeError("Execution log disappeared during verification recovery")
            exec_log.verification_result = {
                "verified": False,
                "method": "database_readback",
                "reason": "verification_query_failed",
            }
        exec_log.completed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(exec_log)

        execution_logs.append(ExecutionLogResponse.model_validate(exec_log))

    # If there were tool calls, get AI response to the results
    if tool_calls:
        # Add tool results to conversation
        for tool_call, tool_result in zip(tool_calls, tool_results):
            ai_messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": tool_call.id,
                    "type": "function",
                    "function": {
                        "name": tool_call.name,
                        "arguments": json.dumps(tool_call.arguments),
                    },
                }],
            })
            ai_messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result.result) if tool_result.success else f"Error: {tool_result.error}",
            })

        # Get final response
        try:
            final_response = await ai_service.chat_completion(ai_messages)
            ai_content = final_response.choices[0].message.content or ""
        except Exception as e:
            ai_content = f"Tools executed successfully. (Follow-up summary error: {str(e)})"
    elif response is not None:
        ai_content = response.choices[0].message.content or ""

    # Save assistant message
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_content,
        tool_calls=[tc.model_dump() for tc in tool_calls] if tool_calls else None,
    )
    db.add(assistant_message)
    await db.commit()

    # Update conversation timestamp
    conversation.updated_at = datetime.utcnow()
    await db.commit()

    return ChatResponse(
        message=ai_content,
        conversation_id=conversation.id,
        tool_calls=[tc.model_dump() for tc in tool_calls] if tool_calls else None,
        execution_logs=execution_logs,
    )


@router.post("/conversations", response_model=Dict[str, Any])
async def create_conversation(
    data: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    title = (data or {}).get("title") or "New Conversation"
    conversation = Conversation(user_id=current_user.id, title=title)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
    }


@router.get("/conversations", response_model=List[Dict[str, Any]])
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
    )
    conversations = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title or "Untitled",
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}/messages", response_model=List[Dict[str, Any]])
async def get_conversation_messages(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "tool_calls": m.tool_calls,
            "tool_call_id": m.tool_call_id,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
    await db.commit()
    return {"message": "Conversation deleted successfully"}


@router.get("/execution-logs", response_model=List[ExecutionLogResponse])
async def get_execution_logs(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ExecutionLog)
        .where(ExecutionLog.user_id == current_user.id)
        .order_by(ExecutionLog.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()