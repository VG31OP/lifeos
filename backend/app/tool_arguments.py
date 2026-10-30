from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr


class ToolArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateTaskArguments(ToolArguments):
    title: StrictStr = Field(min_length=1, max_length=500)
    description: Optional[StrictStr] = Field(default=None, max_length=5000)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    due_date: Optional[datetime] = None


class UpdateTaskArguments(ToolArguments):
    task_id: StrictInt = Field(gt=0)
    title: Optional[StrictStr] = Field(default=None, min_length=1, max_length=500)
    description: Optional[StrictStr] = Field(default=None, max_length=5000)
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    status: Optional[Literal["pending", "in_progress", "completed", "cancelled"]] = None
    due_date: Optional[datetime] = None


class DeleteTaskArguments(ToolArguments):
    task_id: StrictInt = Field(gt=0)


class ListTasksArguments(ToolArguments):
    status: Optional[Literal["pending", "in_progress", "completed", "cancelled"]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    limit: StrictInt = Field(default=50, ge=1, le=100)


class SaveMemoryArguments(ToolArguments):
    content: StrictStr = Field(min_length=1, max_length=5000)
    memory_type: Literal["preference", "fact", "goal", "note"] = "preference"
    consented: StrictBool


class SearchMemoriesArguments(ToolArguments):
    query: StrictStr = Field(min_length=1, max_length=2000)
    memory_type: Optional[Literal["preference", "fact", "goal", "note"]] = None
    limit: StrictInt = Field(default=10, ge=1, le=50)


class SearchDocumentsArguments(ToolArguments):
    query: StrictStr = Field(min_length=1, max_length=2000)
    document_id: Optional[StrictInt] = Field(default=None, gt=0)
    limit: StrictInt = Field(default=5, ge=1, le=20)


TOOL_ARGUMENT_SCHEMAS = {
    "create_task": CreateTaskArguments,
    "update_task": UpdateTaskArguments,
    "delete_task": DeleteTaskArguments,
    "list_tasks": ListTasksArguments,
    "save_memory": SaveMemoryArguments,
    "search_memories": SearchMemoriesArguments,
    "search_documents": SearchDocumentsArguments,
}
