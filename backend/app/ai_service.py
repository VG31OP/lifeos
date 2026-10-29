import json
import httpx
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import AsyncOpenAI, OpenAIError
from app.config import settings
from app.schemas import ToolCall, ToolResult


class EmbeddingError(Exception):
    """Raised when embedding generation fails"""
    pass


class AIService:
    def __init__(self):
        # Create custom httpx client without proxies to avoid version conflicts
        http_client = httpx.AsyncClient(timeout=60.0)
        self.client = AsyncOpenAI(
            api_key=settings.NEBIUS_API_KEY,
            base_url=settings.NEBIUS_BASE_URL,
            http_client=http_client,
        )
        self.chat_model = settings.NVIDIA_CHAT_MODEL
        self.embedding_model = settings.NVIDIA_EMBEDDING_MODEL
        self.embedding_dimension = 1024  # NV-Embed-v2 outputs 1024 dimensions

    # Tool definitions for the AI
    TOOLS = [
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Create a new task for the user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Task title"},
                        "description": {"type": "string", "description": "Task description"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"], "default": "medium"},
                        "due_date": {"type": "string", "format": "date-time", "description": "Due date in ISO format"},
                    },
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_task",
                "description": "Update an existing task",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "integer", "description": "Task ID"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                        "status": {"type": "string", "enum": ["pending", "in_progress", "completed", "cancelled"]},
                        "due_date": {"type": "string", "format": "date-time"},
                    },
                    "required": ["task_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_task",
                "description": "Delete a task",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "integer"},
                    },
                    "required": ["task_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_tasks",
                "description": "List user tasks with optional filters",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string", "enum": ["pending", "in_progress", "completed", "cancelled"]},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                        "limit": {"type": "integer", "default": 50},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "save_memory",
                "description": "Save a long-term memory/preference for the user (requires user consent)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Memory content"},
                        "memory_type": {"type": "string", "enum": ["preference", "fact", "goal", "note"], "default": "preference"},
                        "consented": {"type": "boolean", "description": "Whether user has given explicit consent", "default": False},
                    },
                    "required": ["content", "consented"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_memories",
                "description": "Search user's long-term memories",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "memory_type": {"type": "string", "enum": ["preference", "fact", "goal", "note"]},
                        "limit": {"type": "integer", "default": 10},
                    },
                    "required": ["query"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_documents",
                "description": "Search user's uploaded documents",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "document_id": {"type": "integer"},
                        "limit": {"type": "integer", "default": 5},
                    },
                    "required": ["query"],
                },
            },
        },
    ]

    SYSTEM_PROMPT = """You are LifeOS, a personal AI operating system. You help users manage tasks, remember preferences, and work with their documents.

CORE PRINCIPLES:
1. ALWAYS ask for explicit consent before saving long-term memories
2. Use tools to perform actions - never just describe what you would do
3. Verify tool results by reading back data when appropriate
4. Be transparent about what you're doing and why
5. If a tool fails, explain the failure and suggest alternatives

MEMORY MANAGEMENT:
- Before saving any preference, fact, or goal as a long-term memory, you MUST ask: "May I save this as a long-term memory so I remember it in future sessions?"
- Only save if the user explicitly says yes/confirms
- The save_memory tool requires the 'consented' parameter to be true

TASK MANAGEMENT:
- Create tasks with clear titles, descriptions, priorities, and due dates
- When users ask for plans, break them into specific, actionable tasks
- Verify task creation by listing tasks after creating them

DOCUMENT INTELLIGENCE:
- When users upload documents, help them extract insights and create actionable plans
- Always cite sources when answering questions from documents
- If information isn't in the document, say so clearly

EXECUTION VERIFICATION:
- After using tools, report what actually happened (success/failure)
- If creating tasks, list them back to confirm
- If searching memories/documents, show what was found

Be helpful, precise, and transparent."""

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        stream: bool = False,
    ) -> Any:
        """Get chat completion from the model"""
        all_messages = [{"role": "system", "content": self.SYSTEM_PROMPT}] + messages

        if tools is None:
            tools = self.TOOLS

        try:
            response = await self.client.chat.completions.create(
                model=self.chat_model,
                messages=all_messages,
                tools=tools,
                tool_choice="auto",
                stream=stream,
                temperature=0.3,
                max_tokens=4000,
            )
            return response
        except OpenAIError as e:
            raise RuntimeError(f"AI provider error: {str(e)}") from e
        except Exception as e:
            raise RuntimeError(f"Unexpected error during chat completion: {str(e)}") from e

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion"""
        all_messages = [{"role": "system", "content": self.SYSTEM_PROMPT}] + messages

        if tools is None:
            tools = self.TOOLS

        try:
            stream = await self.client.chat.completions.create(
                model=self.chat_model,
                messages=all_messages,
                tools=tools,
                tool_choice="auto",
                stream=True,
                temperature=0.3,
                max_tokens=4000,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except OpenAIError as e:
            raise RuntimeError(f"AI provider error: {str(e)}") from e
        except Exception as e:
            raise RuntimeError(f"Unexpected error during streaming: {str(e)}") from e

    def parse_tool_calls(self, response) -> List[ToolCall]:
        """Parse tool calls from response"""
        tool_calls = []
        if response.choices[0].message.tool_calls:
            for tc in response.choices[0].message.tool_calls:
                tool_calls.append(
                    ToolCall(
                        name=tc.function.name,
                        arguments=json.loads(tc.function.arguments),
                        id=tc.id,
                    )
                )
        return tool_calls

    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for text using the configured model.
        
        Raises:
            EmbeddingError: If embedding generation fails or returns invalid dimensions
            ValueError: If input text is empty or invalid
        """
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty")
        
        # Truncate if too long (most embedding models have token limits)
        max_chars = 8000  # Conservative limit for NV-Embed-v2
        if len(text) > max_chars:
            text = text[:max_chars]

        try:
            response = await self.client.embeddings.create(
                model=self.embedding_model,
                input=text,
            )
            
            if not response.data or not response.data[0].embedding:
                raise EmbeddingError("Empty embedding returned from provider")
            
            embedding = response.data[0].embedding
            
            # Validate dimension
            if len(embedding) != self.embedding_dimension:
                raise EmbeddingError(
                    f"Embedding dimension mismatch: expected {self.embedding_dimension}, got {len(embedding)}. "
                    f"Check NVIDIA_EMBEDDING_MODEL config matches database schema."
                )
            
            return embedding
            
        except OpenAIError as e:
            raise EmbeddingError(f"Embedding API error: {str(e)}") from e
        except ValueError:
            raise
        except Exception as e:
            raise EmbeddingError(f"Unexpected embedding error: {str(e)}") from e

    async def verify_embedding_dimension(self) -> bool:
        """Verify embedding model returns expected dimensions.
        
        Useful for startup health checks.
        """
        try:
            test_embedding = await self.get_embedding("test")
            return len(test_embedding) == self.embedding_dimension
        except Exception:
            return False


ai_service = AIService()