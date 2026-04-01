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
