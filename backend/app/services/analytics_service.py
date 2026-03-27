import logging
from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.models.repo import Repo
from app.models.commit import Commit
from app.models.contributor import Contributor
from app.models.file_change import FileChange
from app.utils.language_map import LANGUAGE_COLORS

logger = logging.getLogger(__name__)


def _resolve_repo(db: Session, repo_full_name: str | None) -> int | None:
    """Return repo ID if specified, else None (= all repos)."""
    if not repo_full_name:
        return None
    repo = db.query(Repo).filter(Repo.full_name == repo_full_name).first()
    return repo.id if repo else None


def _base_commit_query(db: Session, repo_id: int | None, start_date: date | None, end_date: date | None):
    q = db.query(Commit)
    if repo_id is not None:
        q = q.filter(Commit.repo_id == repo_id)
    if start_date:
        q = q.filter(Commit.date >= start_date)
    if end_date:
        q = q.filter(Commit.date <= end_date)
    return q


# ── Daily Stats ────────────────────────────────────────────────────────

def get_daily_stats(
    db: Session,
    repo_full_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)

    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()

    rows = (
        _base_commit_query(db, repo_id, start_date, end_date)
        .with_entities(Commit.date, func.count(Commit.id).label("cnt"))
        .group_by(Commit.date)
        .order_by(Commit.date)
        .all()
    )

    result_map = {r.date: r.cnt for r in rows}

    # Fill in missing days with 0
    result = []
    current = start_date
    while current <= end_date:
        result.append({
            "date": current.isoformat(),
            "commits": result_map.get(current, 0),
        })
        current += timedelta(days=1)

    return result


# ── Weekly Stats ───────────────────────────────────────────────────────

def get_weekly_stats(
    db: Session,
    repo_full_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)

    if not start_date:
        start_date = date.today() - timedelta(weeks=12)
    if not end_date:
        end_date = date.today()

    rows = (
        _base_commit_query(db, repo_id, start_date, end_date)
        .with_entities(Commit.week, func.count(Commit.id).label("cnt"))
        .group_by(Commit.week)
        .order_by(Commit.week)
        .all()
    )

    return [{"week": r.week, "commits": r.cnt} for r in rows]


# ── Contributor Stats ──────────────────────────────────────────────────

def _compute_streak(db: Session, contributor_id: int, repo_id: int | None) -> int:
    """Compute current consecutive-day commit streak."""
    q = db.query(Commit.date).filter(Commit.contributor_id == contributor_id)
    if repo_id is not None:
        q = q.filter(Commit.repo_id == repo_id)
    dates = sorted({r.date for r in q.all()}, reverse=True)

    if not dates:
        return 0

    streak = 0
    expected = date.today()
    for d in dates:
        if d == expected or d == expected - timedelta(days=1):
            streak += 1
            expected = d - timedelta(days=1)
        else:
            break
    return streak


def get_contributor_stats(
    db: Session,
    repo_full_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)

    # Base query for commits
    commit_q = _base_commit_query(db, repo_id, start_date, end_date)
    commit_ids = [c.id for c in commit_q.with_entities(Commit.id).all()]

    if not commit_ids:
        return []

    # Aggregate per contributor
    contrib_rows = (
        commit_q
        .join(Contributor)
        .with_entities(
            Contributor.id,
            Contributor.name,
            Contributor.email,
            func.count(Commit.id).label("total_commits"),
        )
        .group_by(Contributor.id, Contributor.name, Contributor.email)
        .order_by(desc("total_commits"))
        .all()
    )

    results = []
    for row in contrib_rows:
        cid = row.id

        # Lines added/deleted
        lines = (
            db.query(
                func.coalesce(func.sum(FileChange.additions), 0).label("added"),
                func.coalesce(func.sum(FileChange.deletions), 0).label("deleted"),
            )
            .join(Commit)
            .filter(Commit.contributor_id == cid, Commit.id.in_(commit_ids))
            .first()
        )

        # Language breakdown for this contributor
        lang_rows = (
            db.query(
                FileChange.language,
                func.sum(FileChange.additions + FileChange.deletions).label("total_lines"),
            )
            .join(Commit)
            .filter(
                Commit.contributor_id == cid,
                Commit.id.in_(commit_ids),
                FileChange.language.isnot(None),
            )
            .group_by(FileChange.language)
            .order_by(desc("total_lines"))
            .all()
        )

        total_lang_lines = sum(r.total_lines for r in lang_rows) or 1
        lang_breakdown = []
        top_language = "Unknown"
        for i, lr in enumerate(lang_rows):
            pct = round((lr.total_lines / total_lang_lines) * 100)
            if i == 0:
                top_language = lr.language
            lang_breakdown.append({
                "language": lr.language,
                "percentage": pct,
                "color": LANGUAGE_COLORS.get(lr.language),
            })

        # Weekly activity
        weekly_rows = (
            commit_q
            .filter(Commit.contributor_id == cid)
            .with_entities(Commit.week, func.count(Commit.id).label("cnt"))
            .group_by(Commit.week)
            .order_by(Commit.week)
            .all()
        )
        weekly_activity = [{"week": w.week, "commits": w.cnt} for w in weekly_rows]

        streak = _compute_streak(db, cid, repo_id)

        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={row.name.replace(' ', '+')}"

        results.append({
            "name": row.name,
            "avatar": avatar,
            "totalCommits": row.total_commits,
            "linesAdded": lines.added if lines else 0,
            "linesDeleted": lines.deleted if lines else 0,
            "topLanguage": top_language,
            "languageBreakdown": lang_breakdown,
            "weeklyActivity": weekly_activity,
            "streak": streak,
        })

    return results


# ── Language Stats ─────────────────────────────────────────────────────

def get_language_stats(
    db: Session,
    repo_full_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)

    commit_q = _base_commit_query(db, repo_id, start_date, end_date)
    commit_ids = [c.id for c in commit_q.with_entities(Commit.id).all()]

    if not commit_ids:
        return []

    # Aggregate by language
    lang_rows = (
        db.query(
            FileChange.language,
            func.sum(FileChange.additions + FileChange.deletions).label("total_lines"),
        )
        .filter(FileChange.commit_id.in_(commit_ids), FileChange.language.isnot(None))
        .group_by(FileChange.language)
        .order_by(desc("total_lines"))
        .all()
    )

    grand_total = sum(r.total_lines for r in lang_rows) or 1

    results = []
    for lr in lang_rows:
        pct = round((lr.total_lines / grand_total) * 100)
        if pct == 0:
            continue

        # Contributors for this language
        contrib_rows = (
            db.query(
                Contributor.name,
                func.sum(FileChange.additions + FileChange.deletions).label("lines"),
            )
            .join(Commit, Commit.contributor_id == Contributor.id)
            .join(FileChange, FileChange.commit_id == Commit.id)
            .filter(
                FileChange.language == lr.language,
                Commit.id.in_(commit_ids),
            )
            .group_by(Contributor.name)
            .order_by(desc("lines"))
            .all()
        )
        lang_total = lr.total_lines or 1
        contributors = [
            {"name": c.name, "percentage": round((c.lines / lang_total) * 100)}
            for c in contrib_rows
        ]

        results.append({
            "language": lr.language,
            "percentage": pct,
            "color": LANGUAGE_COLORS.get(lr.language),
            "contributors": contributors,
        })

    return results


# ── Leaderboard ────────────────────────────────────────────────────────

def get_leaderboard(
    db: Session,
    repo_full_name: str | None = None,
    period: str = "weekly",
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)

    # Default date ranges based on period
    if not end_date:
        end_date = date.today()
    if not start_date:
        if period == "daily":
            start_date = end_date
        elif period == "monthly":
            start_date = end_date - timedelta(days=30)
        else:  # weekly
            start_date = end_date - timedelta(weeks=1)

    commit_q = _base_commit_query(db, repo_id, start_date, end_date)
    commit_ids = [c.id for c in commit_q.with_entities(Commit.id).all()]

    if not commit_ids:
        return []

    contrib_rows = (
        commit_q
        .join(Contributor)
        .with_entities(
            Contributor.id,
            Contributor.name,
            func.count(Commit.id).label("total_commits"),
        )
        .group_by(Contributor.id, Contributor.name)
        .order_by(desc("total_commits"))
        .all()
    )

    results = []
    for rank, row in enumerate(contrib_rows, 1):
        lines = (
            db.query(
                func.coalesce(func.sum(FileChange.additions), 0).label("added"),
                func.coalesce(func.sum(FileChange.deletions), 0).label("deleted"),
            )
            .join(Commit)
            .filter(Commit.contributor_id == row.id, Commit.id.in_(commit_ids))
            .first()
        )
        added = lines.added if lines else 0
        deleted = lines.deleted if lines else 0
        score = row.total_commits * 2 + (added // 100)
        streak = _compute_streak(db, row.id, repo_id)
        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={row.name.replace(' ', '+')}"

        results.append({
            "rank": rank,
            "name": row.name,
            "avatar": avatar,
            "commits": row.total_commits,
            "linesAdded": added,
            "linesDeleted": deleted,
            "score": score,
            "streak": streak,
        })

    return results
