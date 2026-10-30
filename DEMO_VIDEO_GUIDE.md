# LifeOS Demo Video Guide (3 Minutes)

## 🎬 Recording Setup

**Tools:** OBS Studio (free), Windows Game Bar (Win+G), or QuickTime
**Resolution:** 1920x1080 minimum
**Audio:** Clear narration, no background noise

---

## 📋 Demo Script (3 Minutes)

### 0:00-0:15 — **Intro & Problem**
> *"LifeOS is a Personal AI Operating System built for the Nebius × NVIDIA Hackathon. It gives you persistent memory, document intelligence, task management, and real AI tool execution — all powered by NVIDIA Nemotron 70B via Nebius AI Cloud."*

**Show:** GitHub repo (https://github.com/VG31OP/lifeos), README highlights

### 0:15-0:45 — **Architecture & Stack**
> *"Full-stack: FastAPI backend with PostgreSQL + pgvector for semantic search, Next.js 14 frontend with Tailwind. Docker Compose for one-command deployment."*

**Show:** Terminal running `docker-compose up --build` (speed up 2x), browser opening localhost:3000

### 0:45-1:15 — **Authentication & Dashboard**
> *"JWT-based auth with secure password hashing. Clean dark-first responsive dashboard with 5 views."*

**Show:** Register → Login → Dashboard with sidebar navigation (Chat, Tasks, Documents, Memories, Activity)

### 1:15-1:45 — **AI Chat with Tool Execution** ⭐ KEY FEATURE
> *"The AI can execute backend operations when the configured provider requests supported tools. This demo shows the actual returned outcome."*

**Show:** 
1. Type: *"Create a high-priority task to prepare hackathon demo video due tomorrow"*
2. Show the returned `create_task` result and confirm it appears in the task list
3. Type: *"Save this as a memory: I prefer dark mode and use vim keybindings"*
4. Save only after explicitly checking the consent box; confirm it appears in Memories
5. Type: *"Search my memories for vim"*
6. Watch: `search_memories` → semantic results

### 1:45-2:15 — **Task Management**
> *"Full CRUD with priorities, due dates, filtering — all synced with AI."*

**Show:** Tasks view → Filter by status/priority → Edit task → Mark complete → AI creates task via chat → appears instantly

### 2:15-2:45 — **Document Intelligence**
> *"Upload any document — PDF, Word, Markdown — it chunks, embeds, and makes it searchable."*

**Show:** Documents view → Upload a PDF/MD file → Show chunks with embeddings → Search: *"What does the doc say about architecture?"* → Semantic results with citations

### 2:45-3:00 — **Activity Logs & Verification**
> *"Tool calls are recorded with their request, arguments, result, and success or failure status."*

**Show:** Activity view → Expand entries → Show tool name, input JSON, output JSON, verification details

### 3:00 — **Close**
> *"LifeOS — your AI that remembers, acts, and verifies. Built with NVIDIA on Nebius. Try it: github.com/VG31OP/lifeos"*

---

## 🎯 Key Moments to Emphasize

| Time | Feature | Why It Matters |
|------|---------|----------------|
| 1:15 | Tool execution | **Core differentiator** — AI does real work |
| 1:30 | Memory consent | **Privacy-first** — explicit user consent |
| 2:00 | Semantic search | **pgvector** — not keyword matching |
| 2:30 | Document chunks | **RAG pipeline** — chunk→embed→search |
| 2:45 | Execution logs | **Verification** — trust but verify |

---

## 🛠 Pre-Recording Checklist

```bash
# 1. Start services
cd "E:\Project\life os"
cp backend/.env.example backend/.env
# Edit backend/.env with your NEBIUS_API_KEY
docker-compose up --build

# 2. Prepare test data
# - Register test user
# - Have a sample PDF/MD file ready for upload
# - Plan 3-4 chat messages that trigger different tools
```

## 📝 Sample Chat Commands for Demo

```
1. "Create a high-priority task to record demo video due tomorrow"
2. "Save this as a memory: I prefer dark mode and use vim keybindings" 
3. "Search my memories for vim"
4. "List all my pending tasks"
5. "What documents do I have?"
```

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| AI not calling tools | Check NEBIUS_API_KEY in .env |
| Database errors | `docker-compose down -v && docker-compose up --build` |
| Frontend not loading | Check port 3000, clear browser cache |
| Slow response | Nebius API latency — mention in demo |

---

## 📤 Post-Recording

1. **Trim** to exactly 3:00 (YouTube Studio, DaVinci Resolve, Clipchamp)
2. **Add captions** for accessibility
3. **Upload** to YouTube (unlisted) or GitHub release
4. **Link** in repo README and hackathon submission

---

## 🎤 Narration Tips

- Speak clearly, ~150 words/min
- Pause 1s after each feature demo
- Show, don't just tell — let UI speak
- Mention "NVIDIA Nemotron 70B via Nebius" 2-3 times
- End with repo URL clearly visible