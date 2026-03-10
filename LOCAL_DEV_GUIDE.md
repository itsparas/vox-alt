# VoxReception — Local Development Guide (Docker)

> Run the entire VoxReception stack locally with one command using Docker Compose.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Docker Desktop** | ≥ 24.x | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | ≥ 18 | [nodejs.org](https://nodejs.org/) (only needed for `prisma` CLI outside Docker) |
| **Git** | any | [git-scm.com](https://git-scm.com/) |

Make sure **Docker Desktop is running** before proceeding (whale icon in system tray should be steady, not animating).

---

## 1. Clone & Install

```bash
git clone <repo-url> VoxReception
cd VoxReception
npm install          # installs workspace dependencies + sub-packages
```

---

## 2. Configure Environment Variables

### Root `.env` (AI API keys — read by Docker Compose)

Create `.env` in the project root with your API keys:

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```dotenv
OPENAI_API_KEY=sk-proj-...       # Optional if using Gemini
GEMINI_API_KEY=AIzaSy...         # Free tier available
DEEPGRAM_API_KEY=...             # Speech-to-Text
ELEVENLABS_API_KEY=sk_...        # Text-to-Speech
```

### Backend `.env` (full config — used by Prisma CLI on host)

```bash
cp packages/backend/.env.example packages/backend/.env
```

The defaults work out of the box for Docker. Key values:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://voxreception:voxreception_dev@localhost:5432/voxreception` | Points to Docker Postgres |
| `REDIS_URL` | `redis://localhost:6379` | Points to Docker Redis |
| `LIVEKIT_URL` | `ws://localhost:7880` | Points to Docker LiveKit |
| `JWT_SECRET` | `dev-jwt-secret-...` | Change in production |
| `PORT` | `3001` | Backend API port |

### Frontend `.env.local`

Create `packages/frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

---

## 3. Start Everything

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

This builds and starts **6 containers**:

| Container | Service | Port | URL |
|-----------|---------|------|-----|
| `vox-postgres` | PostgreSQL 15 | 5432 | `postgresql://localhost:5432` |
| `vox-redis` | Redis 7 | 6379 | `redis://localhost:6379` |
| `vox-livekit` | LiveKit Server | 7880–7882 | `ws://localhost:7880` |
| `vox-backend` | Express API (nodemon) | **3001** | http://localhost:3001 |
| `vox-frontend` | Next.js (dev) | **3000** | http://localhost:3000 |
| `vox-prisma-studio` | Prisma Studio | **5555** | http://localhost:5555 |

---

## 4. Run Database Migrations (first time only)

After the containers are up and Postgres is healthy:

```bash
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate deploy
```

This applies all migrations in `packages/backend/prisma/migrations/`.

---

## 5. Verify

```bash
# Health check
curl http://localhost:3001/health
# → {"status":"healthy","timestamp":"...","uptime":...}

# Check all containers
docker compose -f docker-compose.dev.yml ps
```

Then open:
- **Frontend**: http://localhost:3000
- **API Health**: http://localhost:3001/health
- **Prisma Studio** (DB browser): http://localhost:5555

---

## 6. Create Your First Account

1. Go to http://localhost:3000/register
2. Fill in your details (name, email, password, business name)
3. You'll be redirected to the dashboard

---

## Daily Development Workflow

### Start

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Stop

```bash
docker compose -f docker-compose.dev.yml down
```

### Stop + delete data (full reset)

```bash
docker compose -f docker-compose.dev.yml down -v
```

### View logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Backend only
docker compose -f docker-compose.dev.yml logs -f backend

# Frontend only
docker compose -f docker-compose.dev.yml logs -f frontend
```

### Rebuild after dependency changes

If you add/remove npm packages in `packages/backend/package.json` or `packages/frontend/package.json`:

```bash
docker compose -f docker-compose.dev.yml up -d --build backend
# or for frontend:
docker compose -f docker-compose.dev.yml up -d --build frontend
```

### Restart a single service

```bash
docker compose -f docker-compose.dev.yml restart backend
```

---

## Database Operations

### Run a new migration

```bash
# From your host machine (uses packages/backend/.env DATABASE_URL)
cd packages/backend
npx prisma migrate dev --name describe_your_change

# Or from inside the container
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate dev --name describe_your_change
```

### Reset database (drops all data)

```bash
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate reset --force
```

### Open Prisma Studio

Already running at http://localhost:5555, or manually:

```bash
cd packages/backend
npx prisma studio
```

### Direct database access

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U voxreception -d voxreception
```

---

## Hot Reload

| Component | How | Trigger |
|-----------|-----|---------|
| **Backend** | `nodemon` watches `src/` | Save any `.js` file in `packages/backend/src/` |
| **Frontend** | Next.js Fast Refresh | Save any file in `packages/frontend/src/` |
| **Schema** | Requires migration | After editing `schema.prisma`, run `prisma migrate dev` then restart backend |

Both `packages/backend/src` and `packages/frontend/src` are volume-mounted into the containers, so changes on your host are reflected immediately.

> **Windows note**: If nodemon doesn't detect changes, restart the container: `docker compose -f docker-compose.dev.yml restart backend`

---

## Key API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/health/detailed` | GET | No | Detailed health with DB/Redis status |
| `/api/auth/register` | POST | No | Register new account |
| `/api/auth/login` | POST | No | Login |
| `/api/auth/me` | GET | Yes | Current user |
| `/api/tenants/me` | GET | Yes | Current tenant |
| `/api/calls` | GET | Yes | List calls |
| `/api/bookings` | GET | Yes | List bookings |
| `/api/knowledge/faqs` | GET | Yes | List FAQs |
| `/api/knowledge/documents` | GET | Yes | List KB documents |
| `/api/voicemails` | GET | Yes | List voicemails |
| `/api/messages` | GET | Yes | List SMS messages |

---

## Troubleshooting

### "Cannot find package 'xyz'"
The Docker image is stale. Rebuild:
```bash
docker compose -f docker-compose.dev.yml up -d --build backend
```

### "Database connection refused"
Postgres isn't ready yet. Wait a few seconds or check:
```bash
docker compose -f docker-compose.dev.yml ps postgres
# Should say "healthy"
```

### "Port already in use"
Another process is using the port. Find and kill it:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :3001
kill -9 <pid>
```

### Frontend shows network error
Check that the backend is running and the frontend `.env.local` has the correct `NEXT_PUBLIC_API_URL`:
```bash
docker compose -f docker-compose.dev.yml logs backend --tail 20
```

### Reset everything from scratch
```bash
docker compose -f docker-compose.dev.yml down -v   # stop + delete volumes
docker compose -f docker-compose.dev.yml up -d --build  # rebuild + start
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate deploy  # re-run migrations
```

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Frontend    │────▶│   Backend    │
│  :3000       │     │  Next.js     │     │  Express.js  │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                    ┌───────────────────────────┼───────────────┐
                    │                           │               │
              ┌─────▼─────┐  ┌─────────┐  ┌───▼──────┐  ┌────▼────┐
              │ PostgreSQL │  │  Redis   │  │ LiveKit  │  │ AI APIs │
              │   :5432    │  │  :6379   │  │  :7880   │  │ Gemini  │
              └────────────┘  └─────────┘  └──────────┘  │ OpenAI  │
                                                          │Deepgram │
                                                          │11Labs   │
                                                          └─────────┘
```
