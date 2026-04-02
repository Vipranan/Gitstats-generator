from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.analytics_service import (
    get_daily_stats,
    get_weekly_stats,
    get_contributor_stats,
    get_language_stats,
    get_leaderboard,
)
from app.services.direct_stats_service import compute_ephemeral_stats

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/daily")
def daily_stats(
    repo: Optional[str] = Query(None, description="Repository full name (owner/repo)"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return get_daily_stats(db, repo, start_date, end_date)


@router.get("/weekly")
def weekly_stats(
    repo: Optional[str] = Query(None, description="Repository full name (owner/repo)"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return get_weekly_stats(db, repo, start_date, end_date)


@router.get("/contributors")
def contributor_stats(
    repo: Optional[str] = Query(None, description="Repository full name (owner/repo)"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return get_contributor_stats(db, repo, start_date, end_date)


@router.get("/languages")
def language_stats(
    repo: Optional[str] = Query(None, description="Repository full name (owner/repo)"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return get_language_stats(db, repo, start_date, end_date)


@router.get("/leaderboard")
def leaderboard(
    repo: Optional[str] = Query(None, description="Repository full name (owner/repo)"),
    period: str = Query("weekly", description="daily | weekly | monthly"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return get_leaderboard(db, repo, period, start_date, end_date)


@router.get("/ephemeral")
def ephemeral_stats(
    repo: str = Query(..., description="Repository full name (owner/repo)"),
):
    """
    Fetch all stats directly from GitHub API — no DB reads or writes.
    Returns combined JSON: {daily, weekly, contributors, languages, leaderboard}.
    Repo data is NOT stored anywhere.
    """
    from fastapi import HTTPException
    try:
        owner, name = repo.split("/", 1)
    except ValueError:
        raise HTTPException(status_code=422, detail="repo must be in owner/repo format")

    try:
        return compute_ephemeral_stats(owner, name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
