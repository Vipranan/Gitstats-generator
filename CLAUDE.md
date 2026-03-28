# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (React + Vite)
```bash
npm install          # install dependencies
npm run dev          # dev server (localhost:5173)
npm run build        # production build to /dist
npm run lint         # ESLint
npm run preview      # preview production build
```

### Backend (FastAPI)
```bash
cd backend
conda activate py12
pip install -r requirements.txt
uvicorn app.main:app --reload   # dev server (localhost:8000)
```

Swagger docs: http://localhost:8000/docs

### Loading repos
```bash
# CLI helper
python backend/load_repo.py owner/repo

# Or via API
curl -X POST http://localhost:8000/repo/load -H "Content-Type: application/json" -d '{"repo": "owner/repo"}'
```

Repos can also be added from the frontend sidebar (+) button.

## Architecture

Full-stack app: React frontend + FastAPI backend + SQLite database.

### Frontend → Backend connection
- Axios client in `src/services/api.js` with `BASE_URL=http://localhost:8000`
- All API calls have **mock data fallback** — frontend works standalone without backend
- Custom `useStats` hook (`src/hooks/useStats.js`) handles loading/error states and **60-second auto-refresh polling**
- Backend CORS allows ports 5173, 5174, 3000

### Frontend patterns
- **Routing:** React Router v7 — 4 routes: `/`, `/contributors`, `/languages`, `/leaderboard`
- **State:** React hooks only (`useState`, `useEffect`) + Context API for theme. No Redux/Zustand.
- **Styling:** Tailwind CSS 4 via `@tailwindcss/vite` plugin. Custom theme tokens defined in `@theme` block in `src/index.css`. Dark mode via `.dark` class on `<html>`.
- **Charts:** Recharts — reusable wrappers in `src/components/Charts/`
- **Animations:** Framer Motion on cards, table rows, leaderboard entries
- **Icons:** `lucide-react`

### Backend patterns
- **Database:** SQLAlchemy 2.0 ORM with SQLite (WAL mode). 4 models: `Repo`, `Commit`, `Contributor`, `FileChange`. All FK and query columns indexed. Auto-creates tables on startup via `init_db()`.
- **Services layer:** `github_service.py` (GitHub API with pagination + rate-limit sleep), `processing_service.py` (fetch + store pipeline with incremental updates), `analytics_service.py` (on-the-fly query engine for all stats)
- **Background jobs:** APScheduler refreshes all tracked repos every 30 minutes
- **Incremental fetches:** Only pulls commits newer than `repo.last_fetched_at`

### API contract
Stats endpoints return JSON shaped for direct frontend consumption. Key: contributor stats use **camelCase** field names (`totalCommits`, `linesAdded`, `topLanguage`, `languageBreakdown`, `weeklyActivity`) to match frontend expectations. All `/stats/*` endpoints accept optional `?repo=owner/repo&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` query params.

## Environment

- `GITHUB_TOKEN` in `backend/.env` — optional but gives 5000 req/hr vs 60
- `DATABASE_URL` — defaults to `sqlite:///./gitstats.db`, supports PostgreSQL
- `.env` is gitignored; copy from `.env.example`
