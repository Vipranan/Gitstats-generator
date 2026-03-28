import logging
import threading
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.repo import Repo
from app.models.contributor import Contributor
from app.models.commit import Commit
from app.models.file_change import FileChange
from app.services.github_service import fetch_commits, fetch_commit_detail, fetch_repo_info
from app.utils.date_utils import parse_github_date, iso_week_string
from app.utils.language_map import detect_language

logger = logging.getLogger(__name__)

# Serialize all repo write operations so SQLite doesn't hit "database is locked"
_write_lock = threading.Lock()


def _get_or_create_repo(db: Session, owner: str, name: str) -> Repo:
    full_name = f"{owner}/{name}"
    repo = db.query(Repo).filter(Repo.full_name == full_name).first()
    if repo:
        return repo

    info = fetch_repo_info(owner, name)
    repo = Repo(
        name=info.get("name", name),
        full_name=full_name,
        url=info.get("html_url", f"https://github.com/{full_name}"),
    )
    db.add(repo)
    try:
        db.flush()
    except Exception:
        db.rollback()
        repo = db.query(Repo).filter(Repo.full_name == full_name).first()
        if repo:
            return repo
        raise
    return repo


def _get_or_create_contributor(db: Session, author_name: str, author_email: str) -> Contributor:
    contributor = db.query(Contributor).filter(Contributor.email == author_email).first()
    if contributor:
        # Update name if it changed
        if contributor.name != author_name:
            contributor.name = author_name
        return contributor

    contributor = Contributor(name=author_name, email=author_email)
    db.add(contributor)
    db.flush()
    return contributor


def load_repo(db: Session, repo_full_name: str) -> Repo:
    """
    Main entry point: fetch and store all commit data for a repo.
    Supports incremental updates — only fetches new commits.
    Uses a threading lock to prevent SQLite "database is locked" errors.
    """
    with _write_lock:
        return _load_repo_impl(db, repo_full_name)


def _load_repo_impl(db: Session, repo_full_name: str) -> Repo:
    parts = repo_full_name.strip().split("/")
    if len(parts) != 2:
        raise ValueError(f"Invalid repo format: '{repo_full_name}'. Expected 'owner/repo'.")
    owner, name = parts

    repo = _get_or_create_repo(db, owner, name)

    # Incremental: only fetch commits after the last known date
    since = None
    if repo.last_fetched_at:
        since = repo.last_fetched_at.isoformat()
        logger.info("Incremental fetch for %s since %s", repo.full_name, since)

    raw_commits = fetch_commits(owner, name, since=since)
    new_count = 0

    for raw in raw_commits:
        sha = raw.get("sha")
        if not sha:
            continue

        # Skip duplicates
        existing = db.query(Commit).filter(Commit.sha == sha).first()
        if existing:
            continue

        commit_data = raw.get("commit", {})
        author_info = commit_data.get("author", {})

        author_name = author_info.get("name", "Unknown")
        author_email = author_info.get("email", "unknown@unknown.com")
        date_str = author_info.get("date")
        message = commit_data.get("message", "")

        if not date_str:
            continue

        commit_date = parse_github_date(date_str)
        week = iso_week_string(commit_date)

        contributor = _get_or_create_contributor(db, author_name, author_email)

        commit = Commit(
            sha=sha,
            repo_id=repo.id,
            contributor_id=contributor.id,
            date=commit_date,
            week=week,
            message=message[:500] if message else "",
        )
        db.add(commit)
        db.flush()

        # Fetch file-level changes
        try:
            detail = fetch_commit_detail(owner, name, sha)
            files = detail.get("files", [])
            for f in files:
                filename = f.get("filename", "")
                language = detect_language(filename)
                # Skip files with no recognized language
                if language is None:
                    continue
                fc = FileChange(
                    commit_id=commit.id,
                    filename=filename,
                    language=language,
                    additions=f.get("additions", 0),
                    deletions=f.get("deletions", 0),
                )
                db.add(fc)
        except Exception as e:
            logger.warning("Failed to fetch detail for %s: %s", sha[:8], e)

        new_count += 1

    repo.last_fetched_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("Stored %d new commits for %s", new_count, repo.full_name)
    return repo


def refresh_all_repos(db: Session) -> None:
    """Re-fetch all tracked repos (used by the background scheduler)."""
    repos = db.query(Repo).all()
    for repo in repos:
        try:
            logger.info("Refreshing %s", repo.full_name)
            load_repo(db, repo.full_name)
        except Exception as e:
            logger.error("Failed to refresh %s: %s", repo.full_name, e)
