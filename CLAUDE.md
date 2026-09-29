# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Dev server (port 8000, hot-reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev          # dev server on port 5173
npm run build        # tsc + vite build
npm run lint         # eslint
npx tsc -b           # type-check only
```

### Chrome Extension
```bash
cd chrome-extension
npm install
npm run build        # one-shot: popup + service-worker + content script
# No watch mode for all three targets simultaneously; use watch:popup or watch:content separately
```

### Database Migrations (Alembic)
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

### Docker (full stack)
```bash
docker-compose up --build   # PostgreSQL + backend + frontend
```

> **Note:** The README references MySQL 8.0, but `docker-compose.yml` uses PostgreSQL 14. The production deployment uses PostgreSQL via `postgresql+psycopg2://`. Ensure `DATABASE_URL` in `.env` matches the driver you're using.

There are no automated tests in this codebase.

---

## Architecture

### Stack
| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy 2.x (mapped_column style), Alembic, Uvicorn |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI, Recharts |
| Extension | Chrome MV3, React 18, Vite (three separate bundles) |
| Database | PostgreSQL 14 (Docker) |
| Auth | JWT via `python-jose`, bcrypt via `passlib` |
| Documents | `python-docx` (DOCX), LibreOffice CLI (PDF conversion) |

---

### Backend: Request Lifecycle

1. `main.py` — FastAPI app with two middlewares: `CORSMiddleware` and `RequestLoggingMiddleware` (logs every non-health request to `SystemLog` via `log_service`).
2. All routers are registered under `/api/*` prefix by convention (each router sets its own prefix).
3. Auth dependency chain: `get_current_user` (JWT decode only) → `get_approved_user` (checks status) → `require_role("admin", "bidder")` (checks role). Use `require_role()` on protected routes.
4. Generated files are written to `settings.upload_dir` (`./uploads/`) and served as static files at `/uploads/`.

### AI Provider System

`services/ai_service.py` is the central AI orchestration layer.

**Model config resolution** (`_get_active_model_config`):
- Reads `RoleModelAssignment` table to map a role name to an `AIModelConfig` row.
- Role names: `"resume"`, `"cover_letter"`, `"jd_parse"`, `"chat"`, `"utility"`.
- All non-`"resume"` roles fall back to the `"resume"` assignment if unconfigured.
- Per-profile override: if `Profile.foundry_api_key` is set and `role == "resume"`, that key/endpoint is used instead of the global config (billed to the profile's own Azure resource).

**API key pool** (`ApiKeyPool` model):
- Multiple keys can be registered per `AIModelConfig`. On each `_call_llm()` call, pool keys are randomly shuffled and tried in order, with the config's own key as a final fallback. On 401/429 the next key is tried automatically.

**LLM tiers** (pass as `tier=` to `_call_llm`):
- `"resume"` — high quality; also enables Anthropic web search tool (`web_search_20260209`)
- `"cover_letter"`, `"jd_parse"`, `"chat"`, `"utility"` — can be assigned different cheaper models

**In-memory extraction cache**: `_extraction_cache` (dict, max 200 entries) keyed by JD content hash. Call `ai_service.clear_extraction_cache()` after changing role-model assignments, otherwise stale results from the previous model are returned.

**Provider implementations** live in `services/providers/`: `openai_provider.py` (handles both OpenAI and Azure OpenAI), `anthropic_provider.py`, `google_provider.py`. All expose a `call_*` function consumed via `services/providers/__init__.py::call_provider`.

### Two Background Workers

Both are started in `main.py`'s `lifespan` context:

- **`batch_worker`** (`services/batch_worker.py`) — processes `BatchJob` rows (batch generate for multiple jobs). Runs one job at a time.
- **`queue_worker`** (`services/queue_worker.py`) — processes `QueueTask` rows (per-user sequential queue). Ticks every 3 seconds; picks one task per user where `user.queue_running = True`. Tasks stuck in `"processing"` on startup are reset to `"queued"` (crash recovery). Tasks with `status == "approved"` skip pre-checks (clearance, banned company, duplicate detection).

### Database Models

Key relationships:
- `User` → many `Profile` (owned) + many `Profile` (shared via `profile_shares` join table)
- `Profile` → many `Application`, `Education`, `Experience`
- `Application` → many `AIUsageEvent` (cost tracking per generation step)
- `AIModelConfig` → many `RoleModelAssignment` (many-to-many with roles), many `ApiKeyPool`
- `BatchJob` / `QueueTask` → belong to `User`
- `DocStyle` — seeded with 4 system styles on first startup (Classic, Modern, Minimal, Executive)
- `TokenPricing` — single-row default pricing, seeded on first startup

### Frontend

**Routing** (`src/App.tsx`): Role-based redirect at `/`; admin → `/admin/dashboard`, bidder → `/dashboard`, caller → `/history`. `ProtectedRoute` wraps role-checked subtrees.

**API layer** (`src/api/`): One module per domain (e.g., `admin.ts`, `generate.ts`, `queue.ts`). All use Axios with JWT from `localStorage` via `src/auth.ts`.

**UI components**: Radix UI primitives + `shadcn/ui`-style wrappers. Icons from `lucide-react`. Drag-and-drop (profile sections) via `@dnd-kit`.

### Chrome Extension

Three separate Vite bundles built sequentially:
1. **Popup** (`vite.config.ts`) — React UI rendered in `popup.html`
2. **Service worker** (`vite.sw.config.ts`) — background script
3. **Content script** (`vite.content.config.ts`) — injected into pages

Output goes to `chrome-extension/dist/`. Load the `dist/` folder as an unpacked extension in Chrome.

### Environment Configuration

`backend/config.py` uses `pydantic-settings`. It reads `.env` from the working directory or the project root. The key settings:
- `DATABASE_URL` — full SQLAlchemy connection string
- `JWT_SECRET_KEY` — change in production
- `DEFAULT_ADMIN_USERNAME` — first user registering with this username becomes admin
- Azure OpenAI env vars are a legacy fallback when no `AIModelConfig` row is configured in the DB
