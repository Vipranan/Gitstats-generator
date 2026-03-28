import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import init_db, SessionLocal
from app.routes.repo_routes import router as repo_router
from app.routes.stats_routes import router as stats_router
from app.services.processing_service import refresh_all_repos

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── Background Scheduler ───────────────────────────────────────────────

scheduler = BackgroundScheduler()


def _scheduled_refresh():
    """Run by APScheduler every 30 minutes to pull new commits."""
    logger.info("Scheduled refresh: updating all tracked repos")
    db = SessionLocal()
    try:
        refresh_all_repos(db)
    finally:
        db.close()


# ── Application Lifespan ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    logger.info("Database initialized")

    scheduler.add_job(_scheduled_refresh, "interval", minutes=30, id="repo_refresh")
    scheduler.start()
    logger.info("Background scheduler started (30m interval)")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info("Scheduler shut down")


# ── FastAPI App ────────────────────────────────────────────────────────

app = FastAPI(
    title="Git Analytics API",
    description="Backend for the Git Contribution Analytics Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the React dev server, Vercel production, and custom domains
_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
]

# Add production frontend URL from env (e.g. https://gitstats-generator.vercel.app)
_frontend_url = os.getenv("FRONTEND_URL")
if _frontend_url:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
)

# ── Routes ─────────────────────────────────────────────────────────────

app.include_router(repo_router)
app.include_router(stats_router)


@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Git Analytics API"}
