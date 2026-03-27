# Git Analytics Dashboard

A full-stack Git contribution analytics platform that visualizes GitHub repository data — daily/weekly commits, contributor stats, language usage, and leaderboard rankings.

![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

---

## Features

- **Dashboard Overview** — Total commits, active contributors, top contributor, and language count at a glance
- **Commit Trends** — Daily line chart and weekly bar chart with 30-day / 12-week windows
- **Contributor Insights** — Per-contributor commits, lines added/deleted, language breakdown, weekly activity, and streak tracking
- **Language Distribution** — Pie chart of repo-wide language usage and per-contributor breakdown table
- **Leaderboard** — Ranked contributors by score with daily/weekly/monthly period filters and streak badges
- **Multi-Repo Support** — Track multiple GitHub repositories, switch between them from the sidebar
- **Dark / Light Mode** — Theme toggle with system preference detection and localStorage persistence
- **Auto-Refresh** — Frontend polls every 60 seconds; backend scheduler refreshes all repos every 24 hours
- **Mock Data Fallback** — Frontend works standalone with realistic mock data when the backend is unavailable
- **Responsive Design** — Mobile-friendly with collapsible sidebar

---

## Tech Stack

### Frontend

| Tool | Purpose |
|------|---------|
| React 19 | UI framework |
| Vite 8 | Build tool + dev server |
| Tailwind CSS 4 | Utility-first styling |
| Recharts | Line, bar, and pie charts |
| Framer Motion | Animations and transitions |
| Axios | HTTP client with error handling |
| React Router DOM 7 | Client-side routing |
| Lucide React | Icon library |

### Backend

| Tool | Purpose |
|------|---------|
| FastAPI | REST API framework |
| SQLAlchemy 2.0 | ORM + database layer |
| SQLite | Default database (PostgreSQL-ready) |
| Pydantic 2 | Request/response validation |
| APScheduler | Background job scheduler |
| Requests | GitHub API client |

---

## Project Structure

```
Gitstats-generator/
├── index.html                    # HTML entry point (Inter font, favicon)
├── package.json                  # Node deps + scripts (dev, build, lint)
├── vite.config.js                # Vite + React + Tailwind plugins
├── eslint.config.js              # ESLint configuration
├── requirements.txt              # Root-level Python deps (mirrors backend/)
├── .gitignore
├── QUICKSTART.md                 # Quick setup guide
├── README.md
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/                          # React frontend
│   ├── App.jsx                   # Layout + routing
│   ├── main.jsx                  # Entry point + ThemeProvider
│   ├── index.css                 # Tailwind + theme tokens
│   ├── components/
│   │   ├── Sidebar.jsx           # Nav + repo selector + add-repo form
│   │   ├── Navbar.jsx            # Header + dark/light toggle
│   │   ├── StatCard.jsx          # Animated metric cards
│   │   ├── Loader.jsx            # Loading spinner
│   │   ├── EmptyState.jsx        # Empty data placeholder
│   │   ├── ContributorModal.jsx  # Contributor detail modal
│   │   ├── Charts/
│   │   │   ├── LineChartComponent.jsx
│   │   │   ├── BarChartComponent.jsx
│   │   │   └── PieChartComponent.jsx
│   │   └── Tables/
│   │       └── ContributorsTable.jsx
│   ├── pages/
│   │   ├── Overview.jsx          # / route
│   │   ├── Contributors.jsx      # /contributors
│   │   ├── Languages.jsx         # /languages
│   │   └── Leaderboard.jsx       # /leaderboard
│   ├── services/
│   │   └── api.js                # Axios client + mock fallback
│   ├── hooks/
│   │   └── useStats.js           # Data fetching + 60s auto-refresh
│   └── context/
│       └── ThemeContext.jsx       # Dark/light mode + localStorage
│
└── backend/                      # FastAPI backend
    ├── requirements.txt          # Python dependencies (pinned)
    ├── .env.example              # Environment config template
    ├── load_repo.py              # CLI helper to load repos
    └── app/
        ├── __init__.py
        ├── main.py               # App, CORS, APScheduler lifespan
        ├── database.py           # SQLAlchemy engine + session factory
        ├── models/
        │   ├── repo.py            # Repo model
        │   ├── commit.py          # Commit model
        │   ├── contributor.py     # Contributor model
        │   └── file_change.py     # FileChange model
        ├── schemas/
        │   └── schemas.py         # Pydantic request/response models
        ├── services/
        │   ├── github_service.py      # GitHub API client (pagination + rate-limit)
        │   ├── processing_service.py  # Fetch + store + incremental update pipeline
        │   └── analytics_service.py   # Query engine (daily, weekly, contributors, languages, leaderboard)
        ├── routes/
        │   ├── repo_routes.py     # POST /repo/load, GET /repo/list, DELETE /repo/{id}
        │   └── stats_routes.py    # GET /stats/daily|weekly|contributors|languages|leaderboard
        └── utils/
            ├── language_map.py    # File extension → language mapping + colors
            └── date_utils.py     # ISO date parsing + week string helpers
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+ (conda environment `py12`)
- GitHub personal access token (optional, for higher API rate limits)

### 1. Clone the repository

```bash
git clone https://github.com/Vipranan/Gitstats-generator.git
cd Gitstats-generator
```

### 2. Start the backend

```bash
cd backend
conda activate py12
pip install -r requirements.txt

# Optional: configure GitHub token
cp .env.example .env
# Edit .env and set GITHUB_TOKEN=ghp_...

uvicorn app.main:app --reload
```

The API will be available at **http://localhost:8000**. Visit http://localhost:8000/docs for the interactive Swagger UI.

### 3. Start the frontend

```bash
# From project root
npm install
npm run dev
```

The dashboard will be available at **http://localhost:5173**.

> The frontend works without the backend using built-in mock data. When the backend is running, it automatically switches to real data.

### 4. Load a repository

You have **three ways** to add a GitHub repository:

**Option A: From the Dashboard UI** ⭐ *(Recommended)*

Click the **+** button next to "Repository" in the sidebar, type `owner/repo`, and click **Add**.

**Option B: CLI Helper Script**

```bash
cd backend
python load_repo.py owner/repo-name

# Load multiple repos at once
python load_repo.py owner/repo1 owner/repo2
```

**Option C: Using `curl`**

```bash
curl -X POST http://localhost:8000/repo/load \
  -H "Content-Type: application/json" \
  -d '{"repo": "owner/repo-name"}'  
```

---

## API Endpoints

### Repository Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/repo/load` | Fetch and store a GitHub repo's commits |
| `GET` | `/repo/list` | List all tracked repositories |
| `DELETE` | `/repo/{id}` | Remove a tracked repository |

### Analytics (consumed by frontend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats/daily` | Daily commit counts (last 30 days) |
| `GET` | `/stats/weekly` | Weekly commit counts (last 12 weeks) |
| `GET` | `/stats/contributors` | Per-contributor stats with language breakdown |
| `GET` | `/stats/languages` | Language distribution with contributor details |
| `GET` | `/stats/leaderboard` | Ranked contributors by score |

All stats endpoints accept optional query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `repo` | string | Filter by repository (`owner/repo`) |
| `start_date` | date | Start of date range (`YYYY-MM-DD`) |
| `end_date` | date | End of date range (`YYYY-MM-DD`) |
| `period` | string | Leaderboard only: `daily`, `weekly`, or `monthly` |

---

## Database Schema

```
repos             contributors         commits              file_changes
─────────         ────────────         ───────              ────────────
id (PK)           id (PK)              id (PK)              id (PK)
name              name                 sha (unique)         commit_id (FK)
full_name (UQ)    email (unique)       repo_id (FK)         filename
url                                    contributor_id (FK)  language
last_fetched_at                        date                 additions
created_at                             week                 deletions
                                       message
```

All foreign key columns and `date`, `week`, `language` are indexed for fast analytics queries.

---

## Scoring System

The leaderboard ranks contributors using:

```
score = (commits × 2) + (lines_added ÷ 100)
```

Top 3 contributors get gold, silver, and bronze badges. Contributors with streaks longer than 7 days get a streak indicator.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | *(empty)* | GitHub PAT for higher rate limits (5000 req/hr vs 60) |
| `DATABASE_URL` | `sqlite:///./gitstats.db` | Database connection string (PostgreSQL supported) |

### Switching to PostgreSQL

```bash
# In .env
DATABASE_URL=postgresql://user:password@localhost:5432/gitstats
```

No code changes required — SQLAlchemy handles the rest.

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   React Frontend    │  HTTP   │   FastAPI Backend     │
│                     │ ◄─────► │                       │
│  Recharts + Tailwind│  :8000  │  SQLAlchemy + SQLite  │
│  :5173              │         │                       │
└─────────────────────┘         └──────────┬───────────┘
                                           │
                                           │ GitHub REST API
                                           ▼
                                ┌──────────────────────┐
                                │   GitHub Repos        │
                                │   /repos/{owner}/...  │
                                └──────────────────────┘
```

**Data flow:**
1. User adds a repo via the **sidebar UI**, the **CLI helper** (`load_repo.py`), or `curl`
2. Backend fetches commits + file changes from GitHub API (with pagination + rate-limit handling)
3. Data is normalized into 4 tables: repos, contributors, commits, file_changes
4. Frontend queries `/stats/*` endpoints and renders charts/tables
5. APScheduler refreshes all repos every 24 hours automatically
6. Frontend auto-refreshes data every 60 seconds via the `useStats` hook

---

## License

MIT
