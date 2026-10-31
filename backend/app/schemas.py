from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, Field


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    memory_consent: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    memory_consent: Optional[bool] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# Conversation schemas
class ConversationBase(BaseModel):
    title: Optional[str] = None


class ConversationCreate(ConversationBase):
    pass


class ConversationResponse(ConversationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Message schemas
class MessageBase(BaseModel):
    role: str
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


class MessageCreate(MessageBase):
    conversation_id: int


class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Task schemas
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    status: str = Field(default="pending", pattern="^(pending|in_progress|completed|cancelled)$")
    due_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|urgent)$")
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|cancelled)$")
    due_date: Optional[datetime] = None


class TaskResponse(TaskBase):
    id: int
    user_id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Memory schemas
class MemoryBase(BaseModel):
    content: str = Field(..., min_length=1)
    memory_type: str = Field(default="preference", pattern="^(preference|fact|goal|note)$")


class MemoryCreate(MemoryBase):
    consented: bool = False


class MemoryUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    memory_type: Optional[str] = Field(None, pattern="^(preference|fact|goal|note)$")
    consented: Optional[bool] = None


class MemoryResponse(MemoryBase):
    id: int
    user_id: int
    consented: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Document schemas
class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_type: str
    file_size: int


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    id: int
    user_id: int
    chunk_count: int
    processing_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Document Chunk schemas
class DocumentChunkResponse(BaseModel):
    id: int
    document_id: int
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Execution Log schemas
class ExecutionLogBase(BaseModel):
    request: str
    planned_steps: Optional[List[Dict[str, Any]]] = None
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[Dict[str, Any]] = None
    success: bool = False
    error_message: Optional[str] = None
    verification_result: Optional[Dict[str, Any]] = None


class ExecutionLogCreate(ExecutionLogBase):
    conversation_id: Optional[int] = None


class ExecutionLogResponse(ExecutionLogBase):
    id: int
    user_id: int
    conversation_id: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# AI Chat schemas
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: int
    tool_calls: Optional[List[Dict[str, Any]]] = None
    execution_logs: Optional[List[ExecutionLogResponse]] = None


# Tool schemas
class ToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any]
    id: str


class ToolResult(BaseModel):
    tool_call_id: str
    name: str
    result: Any
    success: bool
    error: Optional[str] = None