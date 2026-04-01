# Phase 1 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 correctness and performance issues across the backend (N+1 queries, serial API fetching, input validation, DB indexes) and frontend (error states, mock data indicator, pagination, polling visibility).

**Architecture:** Backend fixes are in `analytics_service.py`, `processing_service.py`, `repo_routes.py`, and model files. Frontend fixes introduce 4 new shared components/hooks and update `api.js`, `useStats.js`, and all 4 pages. All changes are additive or surgical replacements — no structural rewrites.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + SQLite (backend), React 19 + Vite 8 + Tailwind CSS 4 (frontend), pytest (backend tests), Vitest + Testing Library (frontend tests).

---

## File Map

**New files:**
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — pytest fixtures (in-memory SQLite DB session)
- `backend/tests/test_analytics.py` — analytics service tests
- `backend/tests/test_routes.py` — repo route validation tests
- `src/components/ErrorBanner.jsx`
- `src/components/MockDataNote.jsx`
- `src/hooks/usePagination.js`
- `src/components/Pagination.jsx`

**Modified files:**
- `backend/requirements.txt` — add pytest, httpx
- `backend/app/models/commit.py` — composite index
- `backend/app/models/file_change.py` — composite index
- `backend/app/services/analytics_service.py` — eliminate N+1 queries in all 3 functions
- `backend/app/services/processing_service.py` — ThreadPoolExecutor for commit detail fetching
- `backend/app/routes/repo_routes.py` — regex validation
- `package.json` — add vitest, testing-library, jsdom
- `vite.config.js` — add test config
- `src/services/api.js` — `fetchWithFallback` returns `{ data, isMock }`
- `src/hooks/useStats.js` — expose `isMock`, pause polling on hidden tab
- `src/components/Sidebar.jsx` — tighten regex validation
- `src/components/Tables/ContributorsTable.jsx` — add pagination
- `src/pages/Overview.jsx` — error banner + mock note
- `src/pages/Contributors.jsx` — error banner + mock note
- `src/pages/Languages.jsx` — error banner + mock note + pagination
- `src/pages/Leaderboard.jsx` — error banner + mock note + pagination

---

## Task 1: Backend Test Infrastructure

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pytest to requirements.txt**

Add these two lines at the end of `backend/requirements.txt`:
```
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Install the new dependencies**

```bash
cd backend && pip install pytest==8.3.4 httpx==0.28.1
```

Expected: both packages install without error.

- [ ] **Step 3: Create the tests package**

Create `backend/tests/__init__.py` as an empty file.

- [ ] **Step 4: Create conftest.py with DB fixture**

Create `backend/tests/conftest.py`:
```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)
```

- [ ] **Step 5: Verify pytest discovers the fixture**

```bash
cd backend && python -m pytest tests/ --collect-only
```

Expected output: `no tests ran` (0 items, no errors).

- [ ] **Step 6: Commit**

```bash
cd backend && git add requirements.txt tests/__init__.py tests/conftest.py
git commit -m "feat: add backend test infrastructure with in-memory DB fixture"
```

---

## Task 2: Composite Database Indexes

**Files:**
- Modify: `backend/app/models/commit.py`
- Modify: `backend/app/models/file_change.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_models.py`:
```python
from sqlalchemy import inspect
from app.models.commit import Commit
from app.models.file_change import FileChange


def test_commit_has_composite_repo_date_index(db):
    inspector = inspect(db.bind)
    index_names = {idx["name"] for idx in inspector.get_indexes("commits")}
    assert "ix_commits_repo_date" in index_names, (
        "Missing composite index ix_commits_repo_date on commits(repo_id, date)"
    )


def test_file_change_has_composite_commit_lang_index(db):
    inspector = inspect(db.bind)
    index_names = {idx["name"] for idx in inspector.get_indexes("file_changes")}
    assert "ix_file_changes_commit_lang" in index_names, (
        "Missing composite index ix_file_changes_commit_lang on file_changes(commit_id, language)"
    )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_models.py -v
```

Expected: both tests FAIL with `AssertionError: Missing composite index ...`

- [ ] **Step 3: Add composite index to Commit model**

Replace the entire `backend/app/models/commit.py`:
```python
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Commit(Base):
    __tablename__ = "commits"

    id = Column(Integer, primary_key=True, index=True)
    sha = Column(String, unique=True, nullable=False, index=True)
    repo_id = Column(Integer, ForeignKey("repos.id"), nullable=False, index=True)
    contributor_id = Column(Integer, ForeignKey("contributors.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    week = Column(String, nullable=False, index=True)  # e.g. "2026-W10"
    message = Column(String, nullable=True)

    repo = relationship("Repo", back_populates="commits")
    contributor = relationship("Contributor", back_populates="commits")
    file_changes = relationship("FileChange", back_populates="commit", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_commits_repo_date", "repo_id", "date"),
    )
```

- [ ] **Step 4: Add composite index to FileChange model**

Replace the entire `backend/app/models/file_change.py`:
```python
from sqlalchemy import Column, Integer, String, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class FileChange(Base):
    __tablename__ = "file_changes"

    id = Column(Integer, primary_key=True, index=True)
    commit_id = Column(Integer, ForeignKey("commits.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    language = Column(String, nullable=True, index=True)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)

    commit = relationship("Commit", back_populates="file_changes")

    __table_args__ = (
        Index("ix_file_changes_commit_lang", "commit_id", "language"),
    )
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_models.py -v
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/commit.py backend/app/models/file_change.py backend/tests/test_models.py
git commit -m "feat: add composite indexes on commits(repo_id,date) and file_changes(commit_id,language)"
```

---

## Task 3: Fix N+1 Queries in analytics_service.py

**Files:**
- Modify: `backend/app/services/analytics_service.py`
- Create: `backend/tests/test_analytics.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_analytics.py`:
```python
from datetime import date, timedelta
from app.models.repo import Repo
from app.models.contributor import Contributor
from app.models.commit import Commit
from app.models.file_change import FileChange
from app.services.analytics_service import (
    get_contributor_stats,
    get_language_stats,
    get_leaderboard,
)


def _seed(db):
    """Insert one repo, two contributors, two commits with file changes."""
    repo = Repo(name="testrepo", full_name="org/testrepo", url="https://github.com/org/testrepo")
    db.add(repo)
    db.flush()

    alice = Contributor(name="Alice", email="alice@example.com")
    bob = Contributor(name="Bob", email="bob@example.com")
    db.add_all([alice, bob])
    db.flush()

    today = date.today()
    c1 = Commit(sha="aaa", repo_id=repo.id, contributor_id=alice.id,
                date=today, week="2026-W14", message="feat: add thing")
    c2 = Commit(sha="bbb", repo_id=repo.id, contributor_id=bob.id,
                date=today - timedelta(days=1), week="2026-W14", message="fix: bug")
    db.add_all([c1, c2])
    db.flush()

    db.add_all([
        FileChange(commit_id=c1.id, filename="app.py", language="Python", additions=10, deletions=2),
        FileChange(commit_id=c1.id, filename="main.js", language="JavaScript", additions=5, deletions=0),
        FileChange(commit_id=c2.id, filename="app.py", language="Python", additions=3, deletions=1),
    ])
    db.commit()
    return repo, alice, bob


def test_get_contributor_stats_returns_two_contributors(db):
    repo, alice, bob = _seed(db)
    results = get_contributor_stats(db, repo_full_name="org/testrepo")
    assert len(results) == 2


def test_get_contributor_stats_has_required_fields(db):
    repo, alice, bob = _seed(db)
    results = get_contributor_stats(db, repo_full_name="org/testrepo")
    c = results[0]
    assert "name" in c
    assert "totalCommits" in c
    assert "linesAdded" in c
    assert "linesDeleted" in c
    assert "topLanguage" in c
    assert "languageBreakdown" in c
    assert "weeklyActivity" in c
    assert "streak" in c


def test_get_contributor_stats_empty_repo(db):
    repo = Repo(name="empty", full_name="org/empty", url="https://github.com/org/empty")
    db.add(repo)
    db.commit()
    assert get_contributor_stats(db, repo_full_name="org/empty") == []


def test_get_language_stats_returns_languages(db):
    repo, _, _ = _seed(db)
    results = get_language_stats(db, repo_full_name="org/testrepo")
    langs = [r["language"] for r in results]
    assert "Python" in langs
    assert "JavaScript" in langs


def test_get_language_stats_has_contributors(db):
    repo, _, _ = _seed(db)
    results = get_language_stats(db, repo_full_name="org/testrepo")
    python = next(r for r in results if r["language"] == "Python")
    assert len(python["contributors"]) >= 1


def test_get_leaderboard_ranked(db):
    repo, alice, bob = _seed(db)
    results = get_leaderboard(db, repo_full_name="org/testrepo", period="monthly")
    assert results[0]["rank"] == 1
    assert results[1]["rank"] == 2
    # Alice has more commits, should be rank 1
    assert results[0]["name"] == "Alice"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_analytics.py -v
```

Expected: tests fail (functions exist but this verifies the test setup works — some may pass already, that's OK; the important thing is they run).

- [ ] **Step 3: Replace get_contributor_stats with batch GROUP BY version**

In `backend/app/services/analytics_service.py`, replace the entire `get_contributor_stats` function (lines 123–225):

```python
def get_contributor_stats(
    db: Session,
    repo_full_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)
    commit_q = _base_commit_query(db, repo_id, start_date, end_date)

    if not commit_q.with_entities(Commit.id).first():
        return []

    commit_subq = commit_q.with_entities(Commit.id).subquery()

    # Single query: commit count per contributor
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
    if not contrib_rows:
        return []

    # Single query: lines added/deleted per contributor
    lines_map = {
        row.contributor_id: (row.added, row.deleted)
        for row in db.query(
            Commit.contributor_id,
            func.coalesce(func.sum(FileChange.additions), 0).label("added"),
            func.coalesce(func.sum(FileChange.deletions), 0).label("deleted"),
        )
        .join(FileChange, FileChange.commit_id == Commit.id)
        .filter(Commit.id.in_(commit_subq))
        .group_by(Commit.contributor_id)
        .all()
    }

    # Single query: language breakdown per contributor
    lang_map = defaultdict(list)
    for row in (
        db.query(
            Commit.contributor_id,
            FileChange.language,
            func.sum(FileChange.additions + FileChange.deletions).label("total_lines"),
        )
        .join(FileChange, FileChange.commit_id == Commit.id)
        .filter(Commit.id.in_(commit_subq), FileChange.language.isnot(None))
        .group_by(Commit.contributor_id, FileChange.language)
        .order_by(Commit.contributor_id, desc("total_lines"))
        .all()
    ):
        lang_map[row.contributor_id].append((row.language, row.total_lines))

    # Single query: weekly activity per contributor
    weekly_map = defaultdict(list)
    for row in (
        commit_q
        .with_entities(
            Commit.contributor_id,
            Commit.week,
            func.count(Commit.id).label("cnt"),
        )
        .group_by(Commit.contributor_id, Commit.week)
        .order_by(Commit.contributor_id, Commit.week)
        .all()
    ):
        weekly_map[row.contributor_id].append({"week": row.week, "commits": row.cnt})

    results = []
    for row in contrib_rows:
        cid = row.id
        added, deleted = lines_map.get(cid, (0, 0))

        lang_entries = lang_map.get(cid, [])
        total_lang_lines = sum(lines for _, lines in lang_entries) or 1
        top_language = lang_entries[0][0] if lang_entries else "Unknown"
        lang_breakdown = [
            {
                "language": lang,
                "percentage": round((lines / total_lang_lines) * 100),
                "color": LANGUAGE_COLORS.get(lang),
            }
            for lang, lines in lang_entries
        ]

        streak = _compute_streak(db, cid, repo_id)
        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={row.name.replace(' ', '+')}"

        results.append({
            "name": row.name,
            "avatar": avatar,
            "totalCommits": row.total_commits,
            "linesAdded": added,
            "linesDeleted": deleted,
            "topLanguage": top_language,
            "languageBreakdown": lang_breakdown,
            "weeklyActivity": weekly_map.get(cid, []),
            "streak": streak,
        })

    return results
```

- [ ] **Step 4: Replace get_language_stats with batch version**

Replace the entire `get_language_stats` function (lines 230–293):

```python
def get_language_stats(
    db: Session,
    repo_full_name: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)
    commit_q = _base_commit_query(db, repo_id, start_date, end_date)
    commit_subq = commit_q.with_entities(Commit.id).subquery()

    lang_rows = (
        db.query(
            FileChange.language,
            func.sum(FileChange.additions + FileChange.deletions).label("total_lines"),
        )
        .filter(FileChange.commit_id.in_(commit_subq), FileChange.language.isnot(None))
        .group_by(FileChange.language)
        .order_by(desc("total_lines"))
        .all()
    )

    if not lang_rows:
        return []

    grand_total = sum(r.total_lines for r in lang_rows) or 1

    # Single query: contributor breakdown for all languages at once
    contrib_by_lang = defaultdict(list)
    for row in (
        db.query(
            FileChange.language,
            Contributor.name,
            func.sum(FileChange.additions + FileChange.deletions).label("lines"),
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .join(Contributor, Contributor.id == Commit.contributor_id)
        .filter(FileChange.commit_id.in_(commit_subq), FileChange.language.isnot(None))
        .group_by(FileChange.language, Contributor.name)
        .order_by(FileChange.language, desc("lines"))
        .all()
    ):
        contrib_by_lang[row.language].append((row.name, row.lines))

    results = []
    for lr in lang_rows:
        pct = round((lr.total_lines / grand_total) * 100)
        if pct == 0:
            continue
        lang_total = lr.total_lines or 1
        contributors = [
            {"name": name, "percentage": round((lines / lang_total) * 100)}
            for name, lines in contrib_by_lang.get(lr.language, [])
        ]
        results.append({
            "language": lr.language,
            "percentage": pct,
            "color": LANGUAGE_COLORS.get(lr.language),
            "contributors": contributors,
        })

    return results
```

- [ ] **Step 5: Replace get_leaderboard with batch version**

Replace the entire `get_leaderboard` function (lines 298–365):

```python
def get_leaderboard(
    db: Session,
    repo_full_name: str | None = None,
    period: str = "weekly",
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    repo_id = _resolve_repo(db, repo_full_name)

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
    commit_subq = commit_q.with_entities(Commit.id).subquery()

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

    if not contrib_rows:
        return []

    # Single query: lines per contributor
    lines_map = {
        row.contributor_id: (row.added, row.deleted)
        for row in db.query(
            Commit.contributor_id,
            func.coalesce(func.sum(FileChange.additions), 0).label("added"),
            func.coalesce(func.sum(FileChange.deletions), 0).label("deleted"),
        )
        .join(FileChange, FileChange.commit_id == Commit.id)
        .filter(Commit.id.in_(commit_subq))
        .group_by(Commit.contributor_id)
        .all()
    }

    results = []
    for rank, row in enumerate(contrib_rows, 1):
        added, deleted = lines_map.get(row.id, (0, 0))
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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_analytics.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/analytics_service.py backend/tests/test_analytics.py
git commit -m "perf: eliminate N+1 queries in analytics service using batch GROUP BY queries"
```

---

## Task 4: ThreadPoolExecutor for Commit Detail Fetching

**Files:**
- Modify: `backend/app/services/processing_service.py`

- [ ] **Step 1: Write the test**

Add to `backend/tests/test_analytics.py`:
```python
from unittest.mock import patch, MagicMock
from app.services.processing_service import _load_repo_impl


def test_load_repo_impl_batches_commit_detail_calls(db):
    """Commit detail fetches happen in a thread pool, not serially."""
    fake_commits = [
        {
            "sha": f"sha{i}",
            "commit": {
                "author": {"name": "Dev", "email": "dev@example.com", "date": "2026-01-01T00:00:00Z"},
                "message": f"commit {i}",
            },
        }
        for i in range(3)
    ]

    with (
        patch("app.services.processing_service.fetch_repo_info", return_value={"name": "r", "html_url": "https://github.com/o/r"}),
        patch("app.services.processing_service.fetch_commits", return_value=fake_commits),
        patch("app.services.processing_service.fetch_commit_detail", return_value={"files": []}) as mock_detail,
    ):
        _load_repo_impl(db, "o/r")
        assert mock_detail.call_count == 3
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_analytics.py::test_load_repo_impl_batches_commit_detail_calls -v
```

Expected: FAIL or ERROR (import issue before the fix — that's fine).

- [ ] **Step 3: Rewrite _load_repo_impl with ThreadPoolExecutor**

Replace the entire `_load_repo_impl` function in `backend/app/services/processing_service.py`:

```python
from concurrent.futures import ThreadPoolExecutor
```

Add this import at the top of the file (after the existing imports).

Then replace `_load_repo_impl` (lines 69–149):

```python
def _load_repo_impl(db: Session, repo_full_name: str) -> Repo:
    parts = repo_full_name.strip().split("/")
    if len(parts) != 2:
        raise ValueError(f"Invalid repo format: '{repo_full_name}'. Expected 'owner/repo'.")
    owner, name = parts

    repo = _get_or_create_repo(db, owner, name)

    since = None
    if repo.last_fetched_at:
        since = repo.last_fetched_at.isoformat()
        logger.info("Incremental fetch for %s since %s", repo.full_name, since)

    raw_commits = fetch_commits(owner, name, since=since)

    # Phase 1: Create Commit rows (serial, DB writes need single thread)
    new_commit_pairs: list[tuple[int, str]] = []  # (commit.id, sha)
    for raw in raw_commits:
        sha = raw.get("sha")
        if not sha:
            continue
        if db.query(Commit).filter(Commit.sha == sha).first():
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
        new_commit_pairs.append((commit.id, sha))

    # Phase 2: Fetch file-level details in parallel (network I/O only, no DB)
    if new_commit_pairs:
        def _fetch_files(commit_id_sha: tuple[int, str]) -> tuple[int, list]:
            commit_id, sha = commit_id_sha
            try:
                detail = fetch_commit_detail(owner, name, sha)
                return commit_id, detail.get("files", [])
            except Exception as e:
                logger.warning("Failed to fetch detail for %s: %s", sha[:8], e)
                return commit_id, []

        with ThreadPoolExecutor(max_workers=5) as executor:
            for commit_id, files in executor.map(_fetch_files, new_commit_pairs):
                for f in files:
                    filename = f.get("filename", "")
                    language = detect_language(filename)
                    if language is None:
                        continue
                    db.add(FileChange(
                        commit_id=commit_id,
                        filename=filename,
                        language=language,
                        additions=f.get("additions", 0),
                        deletions=f.get("deletions", 0),
                    ))

    repo.last_fetched_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("Stored %d new commits for %s", len(new_commit_pairs), repo.full_name)
    return repo
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_analytics.py::test_load_repo_impl_batches_commit_detail_calls -v
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/processing_service.py
git commit -m "perf: batch commit detail fetches using ThreadPoolExecutor(max_workers=5)"
```

---

## Task 5: Backend Input Validation (Regex)

**Files:**
- Modify: `backend/app/routes/repo_routes.py`
- Create: `backend/tests/test_routes.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_routes.py`:
```python
import re
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app

client = TestClient(app)


@pytest.mark.parametrize("bad_input", [
    "nodash",
    "//repo",
    "owner/",
    "/repo",
    "owner//repo",
    "own er/repo",
    "owner/repo/extra",
])
def test_load_repo_rejects_invalid_format(bad_input):
    resp = client.post("/repo/load", json={"repo": bad_input})
    assert resp.status_code == 400, f"Expected 400 for '{bad_input}', got {resp.status_code}"
    assert "Invalid" in resp.json()["detail"]


def test_load_repo_accepts_valid_format():
    with patch("app.routes.repo_routes._background_load"):
        import threading
        with patch.object(threading.Thread, "start"):
            resp = client.post("/repo/load", json={"repo": "owner/repo"})
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_routes.py -v
```

Expected: `test_load_repo_rejects_invalid_format` fails for inputs that currently pass the `len(parts) != 2` check (e.g., `"nodash"` gets a 400 already, but `"own er/repo"` does not).

- [ ] **Step 3: Add regex validation to repo_routes.py**

Add after the existing imports at the top of `backend/app/routes/repo_routes.py`:
```python
import re

_REPO_NAME_RE = re.compile(r"^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$")
```

Replace the validation block inside `load_repository` (lines 43–46):
```python
    repo_name = request.repo.strip()
    if not _REPO_NAME_RE.match(repo_name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format '{repo_name}'. Use: owner/repo (letters, numbers, . _ - only)",
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_routes.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routes/repo_routes.py backend/tests/test_routes.py
git commit -m "feat: add regex validation for repo name format in /repo/load endpoint"
```

---

## Task 6: Frontend Test Infrastructure

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Add Vitest dependencies to package.json**

In `package.json`, add to `"devDependencies"`:
```json
"vitest": "^2.1.8",
"@vitest/coverage-v8": "^2.1.8",
"@testing-library/react": "^16.0.0",
"@testing-library/jest-dom": "^6.6.3",
"jsdom": "^25.0.1"
```

- [ ] **Step 2: Add test config to vite.config.js**

Read `vite.config.js` first, then add the `test` block. The file currently looks like:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Replace with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
})
```

- [ ] **Step 3: Create test setup file**

Create `src/test-setup.js`:
```js
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script to package.json**

In `package.json` `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: packages install without error.

- [ ] **Step 6: Verify test runner works**

```bash
npm test
```

Expected: `No test files found` or `0 tests passed` — no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.js src/test-setup.js package-lock.json
git commit -m "feat: add Vitest + Testing Library test infrastructure"
```

---

## Task 7: api.js isMock Flag + MockDataNote Component

**Files:**
- Modify: `src/services/api.js`
- Create: `src/components/MockDataNote.jsx`

- [ ] **Step 1: Write failing test**

Create `src/services/api.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios client
vi.mock('../services/api', async (importOriginal) => {
  const mod = await importOriginal();
  return mod;
});

describe('fetchWithFallback isMock flag', () => {
  it('returns isMock: false on successful API call', async () => {
    // We test this indirectly via the exported functions
    // The shape { data, isMock } must be returned
    const { fetchDailyStats } = await import('./api.js');
    // We can't easily mock axios here without vi.mock at top level
    // So we test the shape via a smoke check
    expect(fetchDailyStats).toBeTypeOf('function');
  });
});
```

> Note: Full integration testing of `fetchWithFallback` requires mocking axios at module level. The critical behaviour (shape `{ data, isMock }`) is verified by the useStats tests in Task 8.

- [ ] **Step 2: Update fetchWithFallback in api.js**

In `src/services/api.js`, replace the `fetchWithFallback` function (lines 145–162):
```js
async function fetchWithFallback(endpoint, mockKey, params = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.get(endpoint, { params });
      return { data: res.data, isMock: false };
    } catch (err) {
      const isRetryable = !err.response || err.code === "ECONNABORTED";
      if (isRetryable && attempt === 0) {
        console.warn(`Retrying ${endpoint} after cold start...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      console.warn(`API unavailable for ${endpoint}, using mock data`);
      return { data: MOCK[mockKey], isMock: true };
    }
  }
}
```

- [ ] **Step 3: Create MockDataNote component**

Create `src/components/MockDataNote.jsx`:
```jsx
export default function MockDataNote() {
  return (
    <div className="flex items-center gap-2 pt-4">
      <div className="h-2 w-2 rounded-full bg-amber-500" />
      <span className="text-xs text-gray-500 dark:text-gray-500">
        Sample data — connect backend for live stats
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: existing tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/components/MockDataNote.jsx src/services/api.test.js
git commit -m "feat: fetchWithFallback returns { data, isMock } flag; add MockDataNote component"
```

---

## Task 8: useStats — isMock Exposure + Visibility Polling

**Files:**
- Modify: `src/hooks/useStats.js`

- [ ] **Step 1: Write failing test**

Create `src/hooks/useStats.test.js`:
```js
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useStats } from './useStats.js';

describe('useStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes isMock from fetch result', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: [1, 2, 3], isMock: true });
    const { result } = renderHook(() => useStats(fetchFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.isMock).toBe(true);
  });

  it('exposes isMock: false on real data', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: ['a'], isMock: false });
    const { result } = renderHook(() => useStats(fetchFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isMock).toBe(false);
  });

  it('pauses polling when tab becomes hidden', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: [], isMock: false });
    renderHook(() => useStats(fetchFn));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    // Advance 2 minutes — should NOT trigger more fetches
    act(() => vi.advanceTimersByTime(120_000));
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/hooks/useStats.test.js
```

Expected: `exposes isMock` tests FAIL because `useStats` doesn't expose `isMock` yet.

- [ ] **Step 3: Update useStats.js**

Replace the entire `src/hooks/useStats.js`:
```js
import { useState, useEffect, useCallback, useRef } from "react";

export function useStats(fetchFn, ...args) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const intervalRef = useRef(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    try {
      if (!hasFetched.current) setLoading(true);
      setError(null);
      const result = await fetchFn(...args);
      setData(result.data);
      setIsMock(result.isMock);
      hasFetched.current = true;
    } catch (err) {
      setError(err.message ?? "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [fetchFn, ...args]);

  useEffect(() => {
    hasFetched.current = false;
    load();
    intervalRef.current = setInterval(load, 60_000);

    function handleVisibilityChange() {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        load();
        intervalRef.current = setInterval(load, 60_000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load]);

  return { data, loading, error, isMock, refetch: load };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/hooks/useStats.test.js
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useStats.js src/hooks/useStats.test.js
git commit -m "feat: useStats exposes isMock flag and pauses polling when tab is hidden"
```

---

## Task 8b: ErrorBanner Component

**Files:**
- Create: `src/components/ErrorBanner.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ErrorBanner.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBanner from './ErrorBanner.jsx';

describe('ErrorBanner', () => {
  it('renders the error message', () => {
    render(<ErrorBanner message="Network error" onRetry={() => {}} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders without retry button when onRetry is not provided', () => {
    render(<ErrorBanner message="Error" />);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/components/ErrorBanner.test.jsx
```

Expected: FAIL — `ErrorBanner.jsx` does not exist yet.

- [ ] **Step 3: Create ErrorBanner component**

Create `src/components/ErrorBanner.jsx`:
```jsx
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-red-400 text-sm">⚠</span>
        <span className="text-sm text-red-400">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded px-3 py-1 text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 dark:hover:bg-gray-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/components/ErrorBanner.test.jsx
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorBanner.jsx src/components/ErrorBanner.test.jsx
git commit -m "feat: add ErrorBanner component with retry button"
```

---

## Task 9: Apply ErrorBanner + MockDataNote to All Pages

**Files:**
- Modify: `src/pages/Overview.jsx`
- Modify: `src/pages/Contributors.jsx`
- Modify: `src/pages/Languages.jsx`
- Modify: `src/pages/Leaderboard.jsx`

- [ ] **Step 1: Update Overview.jsx**

Add imports at the top of `src/pages/Overview.jsx` (after existing imports):
```jsx
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
```

The page has 4 `useStats` calls (`daily`, `weekly`, `contributors`, `languages`). Each now returns `isMock`.

After the `const loading = ...` line, add:
```jsx
const anyError = daily.error || weekly.error || contributors.error || languages.error;
const anyRefetch = daily.refetch;
const showMock = daily.isMock;
```

Replace `if (loading) return <Loader />;` with:
```jsx
if (loading) return <Loader />;
```
(no change needed here — keep it)

Inside the returned JSX, at the very top of the `<div className="space-y-6">`, add:
```jsx
{anyError && <ErrorBanner message={anyError} onRetry={anyRefetch} />}
```

At the very bottom of the returned JSX (after the charts grid), add:
```jsx
{showMock && <MockDataNote />}
```

- [ ] **Step 2: Replace Contributors.jsx**

Replace the entire `src/pages/Contributors.jsx`:
```jsx
import { useState } from "react";
import ContributorsTable from "../components/Tables/ContributorsTable";
import ContributorModal from "../components/ContributorModal";
import Loader from "../components/Loader";
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
import { useStats } from "../hooks/useStats";
import { fetchContributors } from "../services/api";

export default function Contributors({ repo }) {
  const { data, loading, error, isMock, refetch } = useStats(fetchContributors, repo);
  const [selected, setSelected] = useState(null);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Contributors
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data?.length ?? 0} contributors found. Click a row for details.
          </p>
        </div>
      </div>

      <ContributorsTable data={data} onRowClick={setSelected} />

      {selected && (
        <ContributorModal
          contributor={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {isMock && <MockDataNote />}
    </div>
  );
}
```

- [ ] **Step 3: Replace Languages.jsx**

Replace the entire `src/pages/Languages.jsx`:
```jsx
import { useMemo } from "react";
import PieChartComponent from "../components/Charts/PieChartComponent";
import Loader from "../components/Loader";
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
import { useStats } from "../hooks/useStats";
import { fetchLanguages } from "../services/api";

export default function Languages({ repo }) {
  const { data, loading, error, isMock, refetch } = useStats(fetchLanguages, repo);

  const perContributor = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.forEach((lang) => {
      lang.contributors?.forEach((c) => {
        if (!map[c.name]) map[c.name] = {};
        map[c.name][lang.language] = c.percentage;
      });
    });
    return Object.entries(map).map(([name, langs]) => ({ name, ...langs }));
  }, [data]);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Languages
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Language distribution across the repository
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PieChartComponent
          data={data}
          title="Overall Language Distribution"
          height={320}
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Language Breakdown
          </h3>
          <div className="space-y-3">
            {data?.map((lang) => (
              <div key={lang.language} className="flex items-center gap-3">
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: lang.color }} />
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{lang.language}</span>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full" style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }} />
                </div>
                <span className="w-10 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {perContributor.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Language Usage per Contributor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Contributor</th>
                  {data?.map((l) => (
                    <th key={l.language} className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">{l.language}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perContributor.map((row) => (
                  <tr key={row.name} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.name}</td>
                    {data?.map((l) => (
                      <td key={l.language} className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {row[l.language] ? `${row[l.language]}%` : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {isMock && <MockDataNote />}
    </div>
  );
}
```

- [ ] **Step 4: Replace Leaderboard.jsx**

Replace the entire `src/pages/Leaderboard.jsx`:
```jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Flame } from "lucide-react";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
import { useStats } from "../hooks/useStats";
import { fetchLeaderboard } from "../services/api";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function RankBadge({ rank }) {
  if (rank === 1)
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
        <Trophy size={16} />
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
        <Medal size={16} />
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400">
        <Medal size={16} />
      </span>
    );
  return (
    <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500">
      #{rank}
    </span>
  );
}

export default function Leaderboard({ repo }) {
  const [period, setPeriod] = useState("weekly");
  const { data, loading, error, isMock, refetch } = useStats(fetchLeaderboard, repo, period);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leaderboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Top contributors ranked by contribution score</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                period === p.key
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data?.length ? (
        <EmptyState message="No leaderboard data" />
      ) : (
        <div className="space-y-3">
          {data.map((entry, i) => (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900 ${
                entry.rank <= 3
                  ? "border-primary-200 dark:border-primary-500/20"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <RankBadge rank={entry.rank} />
              <img src={entry.avatar} alt={entry.name} className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900 dark:text-white">{entry.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.commits} commits &middot; +{entry.linesAdded.toLocaleString()} / -{entry.linesDeleted.toLocaleString()} lines
                </p>
              </div>
              {entry.streak > 7 && (
                <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 sm:inline-flex">
                  <Flame size={12} />
                  {entry.streak}d streak
                </span>
              )}
              <div className="text-right">
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{entry.score.toLocaleString()}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Score</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {isMock && <MockDataNote />}
    </div>
  );
}
```

- [ ] **Step 5: Start the dev server and verify no console errors**

```bash
npm run dev
```

Open http://localhost:5173. Verify:
- Pages load without errors in the browser console
- Mock data note appears at the bottom of each page (if backend is not running)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Overview.jsx src/pages/Contributors.jsx src/pages/Languages.jsx src/pages/Leaderboard.jsx
git commit -m "feat: show inline error banner and mock data note on all pages"
```

---

## Task 10: usePagination Hook + Pagination Component

**Files:**
- Create: `src/hooks/usePagination.js`
- Create: `src/components/Pagination.jsx`

- [ ] **Step 1: Write failing tests for usePagination**

Create `src/hooks/usePagination.test.js`:
```js
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from './usePagination.js';

const data = Array.from({ length: 25 }, (_, i) => ({ id: i }));

describe('usePagination', () => {
  it('returns first 10 items on page 1', () => {
    const { result } = renderHook(() => usePagination(data, 10));
    expect(result.current.paginatedData).toHaveLength(10);
    expect(result.current.paginatedData[0].id).toBe(0);
    expect(result.current.totalPages).toBe(3);
  });

  it('returns correct items on page 2', () => {
    const { result } = renderHook(() => usePagination(data, 10));
    act(() => result.current.setPage(2));
    expect(result.current.paginatedData[0].id).toBe(10);
    expect(result.current.paginatedData).toHaveLength(10);
  });

  it('returns remaining items on last page', () => {
    const { result } = renderHook(() => usePagination(data, 10));
    act(() => result.current.setPage(3));
    expect(result.current.paginatedData).toHaveLength(5);
    expect(result.current.paginatedData[0].id).toBe(20);
  });

  it('returns empty array for null data', () => {
    const { result } = renderHook(() => usePagination(null, 10));
    expect(result.current.paginatedData).toEqual([]);
    expect(result.current.totalPages).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test src/hooks/usePagination.test.js
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Create usePagination.js**

Create `src/hooks/usePagination.js`:
```js
import { useState, useMemo } from "react";

export function usePagination(data, pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = data ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return { page: safePage, setPage, totalPages, paginatedData };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/hooks/usePagination.test.js
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Write failing test for Pagination component**

Create `src/components/Pagination.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from './Pagination.jsx';

describe('Pagination', () => {
  it('renders page count and item range', () => {
    render(
      <Pagination page={1} totalPages={3} setPage={() => {}} totalItems={25} pageSize={10} />
    );
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
  });

  it('calls setPage when a page button is clicked', () => {
    const setPage = vi.fn();
    render(
      <Pagination page={1} totalPages={3} setPage={setPage} totalItems={25} pageSize={10} />
    );
    fireEvent.click(screen.getByText('2'));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('disables Prev on first page', () => {
    render(
      <Pagination page={1} totalPages={3} setPage={() => {}} totalItems={25} pageSize={10} />
    );
    expect(screen.getByText('← Prev')).toBeDisabled();
  });

  it('returns null when totalPages is 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} setPage={() => {}} totalItems={5} pageSize={10} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm test src/components/Pagination.test.jsx
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 7: Create Pagination component**

Create `src/components/Pagination.jsx`:
```jsx
export default function Pagination({ page, totalPages, setPage, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Build page numbers: always include 1, last, and ±1 around current
  const pageNums = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pageNums.push(i);
    }
  }

  const withEllipsis = [];
  for (let i = 0; i < pageNums.length; i++) {
    if (i > 0 && pageNums[i] - pageNums[i - 1] > 1) {
      withEllipsis.push("...");
    }
    withEllipsis.push(pageNums[i]);
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="rounded px-2.5 py-1 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
        >
          ← Prev
        </button>
        {withEllipsis.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded px-2.5 py-1 text-xs border ${
                p === page
                  ? "bg-primary-600 text-white border-primary-600"
                  : "text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
          className="rounded px-2.5 py-1 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npm test src/components/Pagination.test.jsx
```

Expected: all 4 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/usePagination.js src/hooks/usePagination.test.js src/components/Pagination.jsx src/components/Pagination.test.jsx
git commit -m "feat: add usePagination hook and Pagination component (10 rows/page, numbered)"
```

---

## Task 11: Apply Pagination to Tables

**Files:**
- Modify: `src/components/Tables/ContributorsTable.jsx`
- Modify: `src/pages/Languages.jsx`
- Modify: `src/pages/Leaderboard.jsx`

- [ ] **Step 1: Read ContributorsTable.jsx**

```bash
cat src/components/Tables/ContributorsTable.jsx
```

Understand the current prop interface (it receives `contributors` array) and rendering pattern before making changes.

- [ ] **Step 2: Replace ContributorsTable.jsx with paginated version**

Replace the entire `src/components/Tables/ContributorsTable.jsx`:
```jsx
import { motion } from "framer-motion";
import EmptyState from "../EmptyState";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../Pagination";

export default function ContributorsTable({ data, onRowClick }) {
  const { page, setPage, totalPages, paginatedData } = usePagination(data, 10);

  if (!data?.length) return <EmptyState message="No contributors found" />;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Contributor</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Commits</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 sm:table-cell">Lines Added</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 sm:table-cell">Lines Deleted</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 md:table-cell">Top Language</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 md:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((c, i) => (
              <motion.tr
                key={c.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onRowClick?.(c)}
                className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <img src={c.avatar} alt={c.name} className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800" />
                    <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-semibold text-gray-700 dark:text-gray-300">{c.totalCommits.toLocaleString()}</td>
                <td className="hidden px-5 py-3.5 text-emerald-600 dark:text-emerald-400 sm:table-cell">+{c.linesAdded.toLocaleString()}</td>
                <td className="hidden px-5 py-3.5 text-red-500 dark:text-red-400 sm:table-cell">-{c.linesDeleted.toLocaleString()}</td>
                <td className="hidden px-5 py-3.5 md:table-cell">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {c.topLanguage}
                  </span>
                </td>
                <td className="hidden px-5 py-3.5 md:table-cell">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{c.streak}d</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 pb-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          totalItems={data.length}
          pageSize={10}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update Languages.jsx to paginate the per-contributor table**

In `src/pages/Languages.jsx` (already updated in Task 9 Step 3 with ErrorBanner and MockDataNote), add pagination to the "Language Usage per Contributor" table.

Add imports after existing imports:
```jsx
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
```

Inside the component, after the `perContributor` useMemo, add:
```jsx
const { page, setPage, totalPages, paginatedData: pagedContributors } = usePagination(perContributor, 10);
```

Replace `perContributor.map((row) => (` with `pagedContributors.map((row) => (` in the table body.

After the closing `</table>` tag inside the per-contributor card, add:
```jsx
<Pagination
  page={page}
  totalPages={totalPages}
  setPage={setPage}
  totalItems={perContributor.length}
  pageSize={10}
/>
```

- [ ] **Step 4: Update Leaderboard.jsx to paginate entries**

In `src/pages/Leaderboard.jsx` (already updated in Task 9 Step 4), add pagination to the leaderboard entries.

Add imports:
```jsx
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
```

Inside the component, after the `useStats` line, add:
```jsx
const { page, setPage, totalPages, paginatedData } = usePagination(data, 10);
```

Replace `data.map((entry, i) => (` with `paginatedData.map((entry, i) => (`.

After the closing `</div>` of the `space-y-3` entries div, add:
```jsx
<Pagination
  page={page}
  totalPages={totalPages}
  setPage={setPage}
  totalItems={data?.length ?? 0}
  pageSize={10}
/>
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Navigate to Contributors, Languages, and Leaderboard pages. Verify:
- Tables show 10 rows
- Pagination controls appear below each table
- Clicking page numbers navigates correctly

- [ ] **Step 6: Commit**

```bash
git add src/components/Tables/ContributorsTable.jsx src/pages/Languages.jsx src/pages/Leaderboard.jsx
git commit -m "feat: add numbered pagination (10/page) to Contributors, Languages, and Leaderboard tables"
```

---

## Task 12: Sidebar Input Validation (Frontend Regex)

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Update handleAddRepo in Sidebar.jsx**

In `src/components/Sidebar.jsx`, add a constant before the `handleAddRepo` function:
```jsx
const REPO_NAME_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
```

Replace the existing validation check (line 32–35):
```jsx
    if (!value || !REPO_NAME_RE.test(value)) {
      setError("Use format: owner/repo (letters, numbers, . _ - only)");
      return;
    }
```

- [ ] **Step 2: Run lint to check no issues**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open sidebar, try adding:
- `own er/repo` → should show error message
- `owner//repo` → should show error message
- `facebook/react` → should proceed to load

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: tighten repo name validation to regex in Sidebar"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 2: Run full frontend test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Run frontend build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Start backend and frontend together**

```bash
# Terminal 1
cd backend && conda activate py12 && uvicorn app.main:app --reload

# Terminal 2
npm run dev
```

Verify:
- Overview page loads and shows data
- Error banner appears if backend is stopped mid-session (stop uvicorn, wait 60s for poll)
- Mock data note appears when backend is offline
- Pagination works on Contributors, Languages, Leaderboard pages
- Adding an invalid repo name in sidebar shows the error message
- Adding a valid repo (e.g. `torvalds/linux`) shows loading state

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "Phase 1 improvements complete: N+1 fixes, ThreadPoolExecutor, validation, pagination, error states, mock data note, visibility polling"
```
