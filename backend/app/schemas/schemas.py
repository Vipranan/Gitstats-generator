from pydantic import BaseModel
from typing import Optional


# ── Request Schemas ────────────────────────────────────────────────────

class RepoLoadRequest(BaseModel):
    repo: str  # "owner/repo"


# ── Response Schemas (match frontend expectations exactly) ─────────────

class DailyStat(BaseModel):
    date: str
    commits: int


class WeeklyStat(BaseModel):
    week: str
    commits: int


class LanguageBreakdown(BaseModel):
    language: str
    percentage: int
    color: Optional[str] = None


class WeeklyActivity(BaseModel):
    week: str
    commits: int


class ContributorStat(BaseModel):
    name: str
    avatar: str
    totalCommits: int
    linesAdded: int
    linesDeleted: int
    topLanguage: str
    languageBreakdown: list[LanguageBreakdown]
    weeklyActivity: list[WeeklyActivity]
    streak: int


class LanguageStat(BaseModel):
    language: str
    percentage: int
    color: Optional[str] = None
    contributors: list[dict]


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    avatar: str
    commits: int
    linesAdded: int
    linesDeleted: int
    score: int
    streak: int


class RepoResponse(BaseModel):
    id: int
    name: str
    full_name: str
    url: str
    total_commits: int

    class Config:
        from_attributes = True


class StatusResponse(BaseModel):
    status: str
    message: str
