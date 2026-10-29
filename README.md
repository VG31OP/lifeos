# LifeOS - Personal AI Operating System

> Built for the **Nebius × NVIDIA Global AI Hackathon 2026**

LifeOS is a personal AI operating system that gives you persistent memory, document intelligence, task management, and real AI tool execution — all powered by NVIDIA models through Nebius AI Cloud.

## ✨ Features

- **🤖 AI Command Center** - Streaming chat with NVIDIA Nemotron 70B via Nebius
- **🧠 Persistent Memory** - Semantic memory with pgvector, explicit consent flow
- **📋 Task Management** - Full CRUD with priorities, due dates, filtering
- **📄 Document Intelligence** - Upload, chunk, embed, and search documents
- **🔧 Real Tool Execution** - AI executes actual backend operations with verification
- **📊 Activity Logs** - Complete audit trail of every AI action
- **🎨 Dark-first UI** - Accessible, responsive design with Tailwind CSS

## 🏗 Architecture

```
life os/
├── backend/                 # FastAPI + SQLAlchemy + pgvector
│   ├── app/
│   │   ├── models.py       # 7 SQLAlchemy models
│   │   ├── ai_service.py   # Nebius/NVIDIA integration + 7 tools
│   │   ├── routes/         # REST endpoints
│   │   └── main.py         # FastAPI app
│   ├── alembic/            # Database migrations
│   └── requirements.txt
├── frontend/                # Next.js 14 + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   ├── store/          # Zustand stores
│   │   └── lib/            # API client, utils
│   └── package.json
└── docker-compose.yml       # Local development stack
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended)
- OR: PostgreSQL 16 + pgvector, Python 3.12+, Node.js 20+

### 1. Clone & Configure

```bash
cd "E:\Project\life os"

# Copy environment template
cp backend/.env.example backend/.env

# Edit .env with your Nebius API key
# NEBIUS_API_KEY=your_key_here
```

### 2. Get Nebius API Key

1. Sign up at [Nebius AI Studio](https://studio.nebius.ai/)
2. Create an API key
3. Add to `backend/.env`

### 3. Start with Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 4. Manual Setup (Alternative)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start PostgreSQL with pgvector
# Update DATABASE_URL in .env

alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | JWT signing key (32+ chars) | Yes |
| `NEBIUS_API_KEY` | Nebius AI Studio API key | Yes |
| `NEBIUS_BASE_URL` | `https://api.studio.nebius.ai/v1` | Yes |
| `NEBIUS_MODEL` | `nvidia/Llama-3.1-Nemotron-70B-Instruct` | Yes |
| `EMBEDDING_MODEL` | `nvidia/NV-Embed-v2` | Yes |
| `CORS_ORIGINS` | Frontend URL (comma-separated) | Yes |

## 🛠 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (returns JWT)
- `GET /api/auth/me` - Get current user

### Tasks
- `GET /api/tasks` - List tasks (filter: status, priority)
- `POST /api/tasks` - Create task
- `GET /api/tasks/{id}` - Get task
- `PATCH /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task

### Memories
- `GET /api/memories` - List memories
- `POST /api/memories` - Create memory (requires consent)
- `POST /api/memories/search` - Semantic search
- `PATCH /api/memories/{id}` - Update memory
- `DELETE /api/memories/{id}` - Delete memory
- `POST /api/memories/consent` - Grant memory consent

### Documents
- `POST /api/documents/upload` - Upload & process document
- `GET /api/documents` - List documents
- `GET /api/documents/{id}` - Get document with chunks
- `POST /api/documents/search` - Semantic search chunks
- `DELETE /api/documents/{id}` - Delete document

### Chat
- `POST /api/chat` - Send message (supports tool calls)

### Activity
- `GET /api/execution-logs` - List execution logs

## 🧰 AI Tools (Function Calling)

The AI can execute these real backend operations:

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task |
| `update_task` | Update task fields |
| `delete_task` | Delete a task |
| `list_tasks` | List/filter tasks |
| `save_memory` | Save long-term memory |
| `search_memories` | Semantic memory search |
| `search_documents` | Semantic document search |

## 📸 Screenshots

*Add screenshots of the 5 views: Chat, Tasks, Documents, Memories, Activity*

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest -v

# Frontend tests
cd frontend
npm test
```

## 🚢 Deployment

### Backend (Railway/Render/Fly.io)
1. Set environment variables
2. Run migrations: `alembic upgrade head`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel)
1. Connect repository
2. Set `NEXT_PUBLIC_API_URL` to backend URL
3. Deploy

## 🏆 Hackathon Submission Checklist

- [x] Functional application (not prototype)
- [x] Persistent memory with pgvector
- [x] Document intelligence (upload, chunk, embed, search)
- [x] Task management with full CRUD
- [x] Real AI tool execution with verification
- [x] NVIDIA model via Nebius (Nemotron 70B)
- [x] Public repository with MIT license
- [x] 3-minute demo video
- [x] README with setup instructions

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Nebius AI Cloud](https://nebius.com/) for hosting NVIDIA models
- [NVIDIA](https://www.nvidia.com/) for Nemotron and NV-Embed models
- [pgvector](https://github.com/pgvector/pgvector) for vector similarity search
- [FastAPI](https://fastapi.tiangolo.com/) & [Next.js](https://nextjs.org/) for the frameworks

---

**Built with ❤️ for the Nebius × NVIDIA Global AI Hackathon 2026**