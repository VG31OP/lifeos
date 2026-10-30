# LifeOS - Personal AI Operating System

> Built for the Nebius × NVIDIA Global AI Hackathon 2026

LifeOS is a personal AI operating system for planning, remembering, and acting across tasks, documents, and daily context. The project couples a FastAPI backend with a Next.js frontend and uses Nebius AI Studio plus NVIDIA open models for chat and embeddings.

## ✨ Core capabilities

- AI command center with tool-using chat
- Persistent memory with explicit consent
- Task management with CRUD and user-scoped ownership
- Document intelligence with upload, chunking, embedding, and search
- Execution logging for tool verification
- Local Docker-based setup for reproducible development

## 🏗 Architecture

```text
lifeos/
├── backend/                  # FastAPI + SQLAlchemy + pgvector
│   ├── app/
│   │   ├── ai_service.py     # Nebius/NVIDIA chat and embedding integration
│   │   ├── config.py        # environment validation and defaults
│   │   ├── database.py      # async PostgreSQL setup
│   │   ├── main.py          # FastAPI app and health endpoints
│   │   ├── models.py        # user, task, memory, document, log models
│   │   ├── routes/          # auth, task, memory, document, chat handlers
│   │   └── schemas.py       # request/response validation
│   ├── alembic/              # database migrations
│   ├── tests/                # backend regression tests
│   ├── .env.example          # backend env template
│   └── requirements.txt
├── frontend/                 # Next.js + TypeScript + Tailwind
│   ├── src/
│   ├── package.json
│   └── .env.example
├── docker-compose.yml        # local dev stack
├── README.md
├── DEPLOYMENT.md
├── AUDIT_REPORT.md
├── HACKATHON_CHECKLIST.md
├── DEMO_VIDEO_GUIDE.md
├── LICENSE
└── .gitignore
```

## 🚀 Quick start

### Prerequisites

- Docker + Docker Compose, or
- Python 3.12+, PostgreSQL 16 + pgvector, Node.js 20+

### 1) Configure environment

```bash
cp backend/.env.example backend/.env
```

Then set at minimum:

```bash
SECRET_KEY=replace-with-a-long-random-string
NEBIUS_API_KEY=your-nebius-api-key
DATABASE_URL=postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos
```

### 2) Start with Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

### 3) Manual local setup

Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## 🔐 Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `SECRET_KEY` | Yes | 32+ random characters |
| `NEBIUS_API_KEY` | Yes for live AI | Nebius AI Studio API key |
| `NEBIUS_API_URL` | Optional | Usually `https://api.studio.nebius.ai/v1` |
| `NEBIUS_BASE_URL` | Optional | OpenAI-compatible base URL |
| `NVIDIA_CHAT_MODEL` | Yes | Example: `nvidia/Llama-3.1-Nemotron-70B-Instruct` |
| `NVIDIA_EMBEDDING_MODEL` | Yes | Example: `nvidia/NV-Embed-v2` |
| `FRONTEND_URL` | Yes | Frontend origin for CORS |

## 🧪 Verification status

The project currently has a verified backend import-and-config smoke test in place:

```bash
cd backend
pytest -q
```

Observed result in this workspace:

- 2 tests passed

Runtime verification of real Nebius chat completions and embeddings remains blocked until a valid `NEBIUS_API_KEY` is supplied. The app has code paths ready for live provider use, but no successful live-provider response was observed in this environment.

## 📸 Screenshots and demo assets

The repository includes a demo script and hackathon guidance, but no real screenshot gallery or deployed demo URL is claimed here. Those remain pending until the application is run with valid credentials and the assets are captured.

## 🚢 Deployment notes

Production deployment guidance is covered in `DEPLOYMENT.md`. The current repo is configured for local Docker-based development, and it is not claiming a live public deployment without a real hosted environment and credentials.

## 🏆 Hackathon readiness summary

Verified in this workspace:

- backend configuration loads cleanly with safe defaults
- backend test suite runs successfully in the repo environment
- core docs and environment templates have been aligned

Outstanding external dependencies:

- valid Nebius API credentials for live AI verification
- optional production hosting and screenshots
- actual demo video recording and public link when prepared

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Nebius AI Cloud
- NVIDIA
- pgvector
- FastAPI
- Next.js

---

Built for the Nebius × NVIDIA Global AI Hackathon 2026.