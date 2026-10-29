import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas import ChatRequest, ChatResponse, ToolCall, ToolResult, ExecutionLogCreate, ExecutionLogResponse
from app.models import Conversation, Message, Task, Memory, Document, ExecutionLog, User
from app.routes.auth import get_current_active_user
from app.ai_service import ai_service, ToolCall as AIToolCall

router = APIRouter(prefix="/chat", tags=["chat"])


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
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="create_task",
            result=None,
            success=False,
            error=str(e),
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
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="update_task",
            result=None,
            success=False,
            error=str(e),
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
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="delete_task",
            result=None,
            success=False,
            error=str(e),
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
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="list_tasks",
            result=None,
            success=False,
            error=str(e),
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
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="save_memory",
            result=None,
            success=False,
            error=str(e),
        )


async def execute_search_memories(arguments: Dict[str, Any], user_id: int, db: AsyncSession) -> ToolResult:
    try:
        query = arguments.get("query", "")
        query_embedding = await ai_service.get_embedding(query)

        from sqlalchemy import text
        memory_type = arguments.get("memory_type")
        limit = arguments.get("limit", 10)

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

        memories = []
        for row in result:
            memories.append({
                "id": row.id,
                "content": row.content,
                "memory_type": row.memory_type,
                "similarity": float(row.similarity) if row.similarity else 0.0,
            })

        return ToolResult(
            tool_call_id="",
            name="search_memories",
            result={"memories": memories, "count": len(memories)},
            success=True,
        )
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="search_memories",
            result=None,
            success=False,
            error=str(e),
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

        query_embedding = await ai_service.get_embedding(query)

        from sqlalchemy import text

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

        chunks = []
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

        return ToolResult(
            tool_call_id="",
            name="search_documents",
            result={"chunks": chunks, "count": len(chunks)},
            success=True,
        )
    except Exception as e:
        return ToolResult(
            tool_call_id="",
            name="search_documents",
            result=None,
            success=False,
            error=str(e),
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


async def execute_tool_call(tool_call: AIToolCall, user_id: int, db: AsyncSession) -> ToolResult:
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

    result = await func(tool_call.arguments, user_id, db)
    result.tool_call_id = tool_call.id
    return result


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
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    )
    messages = result.scalars().all()

    # Format messages for AI
    ai_messages = [
        {"role": m.role, "content": m.content}
        for m in messages
    ]

    # Get AI response
    response = await ai_service.chat_completion(ai_messages)
    tool_calls = ai_service.parse_tool_calls(response)

    # Execute tool calls
    execution_logs = []
    tool_results = []

    for tool_call in tool_calls:
        # Log execution start
        exec_log = ExecutionLog(
            user_id=current_user.id,
            conversation_id=conversation.id,
            request=request.message,
            tool_name=tool_call.name,
            tool_input=tool_call.arguments,
        )
        db.add(exec_log)
        await db.commit()

        # Execute tool
        tool_result = await execute_tool_call(tool_call, current_user.id, db)
        tool_results.append(tool_result)

        # Update execution log with result
        exec_log.tool_output = tool_result.result
        exec_log.success = tool_result.success
        exec_log.error_message = tool_result.error
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
        final_response = await ai_service.chat_completion(ai_messages)
        ai_content = final_response.choices[0].message.content or ""
    else:
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


@router.get("/conversations", response_model=List[Dict[str, Any]])
async def list_conversations(
    limit: int = 50,
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
    limit: int = 50,
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