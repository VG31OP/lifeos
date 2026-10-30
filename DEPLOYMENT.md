# LifeOS Deployment Guide

This guide covers deploying LifeOS for the Nebius × NVIDIA Global AI Hackathon 2026.

## Prerequisites

- Docker 24+ and Docker Compose 2+
- Nebius AI Cloud API key (get from https://studio.nebius.ai)
- Git

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
git clone https://github.com/VG31OP/lifeos.git
cd lifeos

# Copy environment template
cp backend/.env.example backend/.env

# Edit backend/.env with your values
# Required: SECRET_KEY (32+ chars); NEBIUS_API_KEY is needed for live AI features
```

### 2. Set Required Environment Variables

Edit `backend/.env` and replace the example `SECRET_KEY` placeholder with a random value:

```bash
SECRET_KEY=replace-this-with-a-random-secret

# Your Nebius API key
NEBIUS_API_KEY=dev-nebius-api-key
```

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(32))"` and replace the example value. Set `NEBIUS_API_KEY` to a real key only when testing live AI features.

### 3. Start Services

```bash
docker compose --env-file backend/.env up -d --build
```

This starts:
- **PostgreSQL with pgvector** on port 5432
- **Backend API** on port 8000
- **Frontend** on port 3000

### 4. Verify Deployment

```bash
# Backend process check (does not imply database or AI health)
curl -i http://localhost:8000/health
curl -i http://localhost:8000/health/db
curl -i http://localhost:8000/health/ai
```

Open http://localhost:3000 in your browser.

## Manual Deployment (Development)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SECRET_KEY="your-secret-key-32-chars"
export NEBIUS_API_KEY="your-nebius-api-key"
export DATABASE_URL="postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Database

Use the Docker Compose PostgreSQL or install locally:

```bash
# With Docker (recommended)
docker run -d --name lifeos-postgres \
  -e POSTGRES_USER=lifeos \
  -e POSTGRES_PASSWORD=lifeos \
  -e POSTGRES_DB=lifeos \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

## Environment Variables Reference

### Backend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key (32+ chars) | `openssl rand -base64 32` |
| `NEBIUS_API_KEY` | Required for live AI features | Nebius AI Cloud API key; without it, live inference is unavailable |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/db` |

### Backend (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEBIUS_API_URL` | `https://api.studio.nebius.ai/v1` | Nebius API endpoint |
| `NVIDIA_CHAT_MODEL` | `nvidia/Llama-3.1-Nemotron-70B-Instruct` | Chat model ID |
| `NVIDIA_EMBEDDING_MODEL` | `nvidia/NV-Embed-v2` | Embedding model ID |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token expiry |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `MAX_FILE_SIZE_MB` | `10` | Not currently configurable; upload limit is 10 MiB |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g., `http://localhost:8000`) |

## Production Deployment

### Security Checklist

- [ ] Use strong `SECRET_KEY` (32+ random characters)
- [ ] Set `NEBIUS_API_KEY` from secure secret store
- [ ] Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- [ ] Enable TLS/SSL (reverse proxy with nginx/Traefik)
- [ ] Set `FRONTEND_URL` to production domain
- [ ] Configure shared rate limiting for multi-instance production deployments (auth endpoints currently use in-process IP limits)
- [ ] Enable audit logging
- [ ] Set up monitoring (Prometheus/Grafana)

### Production Deployment Status

The repository currently provides a local-development Docker Compose stack only; it does not include a production Compose override or a production deployment manifest. Do not deploy the development stack as-is. A production deployment still requires a hardened runtime configuration, managed PostgreSQL, TLS termination, restricted network exposure, and secrets supplied by a secret manager.

### Kubernetes (Optional)

For hackathon demo, Docker Compose is sufficient. For production:

```yaml
# Example k8s deployment structure
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lifeos-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: lifeos-backend
  template:
    spec:
      containers:
      - name: backend
        image: lifeos-backend:latest
        envFrom:
        - secretRef:
            name: lifeos-secrets
        ports:
        - containerPort: 8000
---
apiVersion: v1
kind: Secret
metadata:
  name: lifeos-secrets
type: Opaque
stringData:
  SECRET_KEY: "your-production-secret"
  NEBIUS_API_KEY: "your-production-key"
  DATABASE_URL: "postgresql+asyncpg://..."
```

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker compose logs postgres

# Verify pgvector extension
docker compose exec postgres psql -U lifeos -d lifeos -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

### AI Service Errors

```bash
# Check backend logs
docker compose logs backend

# Verify Nebius API key
curl -H "Authorization: Bearer $NEBIUS_API_KEY" \
  https://api.studio.nebius.ai/v1/models
```

### Frontend Build Fails

```bash
# Clear cache and rebuild
cd frontend
rm -rf .next node_modules
npm install
npm run build
```

### Port Conflicts

Change ports in `docker-compose.yml`:
```yaml
ports:
  - "8001:8000"  # Backend on 8001
  - "3001:3000"  # Frontend on 3001
```

## Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Database health (via backend)
curl http://localhost:8000/health/db

# AI provider health (via backend)
curl http://localhost:8000/health/ai
```

## Rollback

```bash
# Revert to previous image
docker compose down
docker compose pull  # If using registry
docker compose up -d

# Or restore database backup
docker compose exec postgres pg_restore -U lifeos -d lifeos backup.dump
```

## Support

- Check logs: `docker compose logs -f [service]`
- GitHub Issues: https://github.com/VG31OP/lifeos/issues
- Nebius Docs: https://docs.nebius.ai