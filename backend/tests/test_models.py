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
