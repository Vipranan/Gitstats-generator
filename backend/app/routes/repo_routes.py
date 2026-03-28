import logging
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.repo import Repo
from app.models.commit import Commit
from app.schemas.schemas import RepoLoadRequest, RepoResponse, StatusResponse
from app.services.processing_service import load_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/repo", tags=["Repository"])

# Track background loading status per repo
_loading_status: dict[str, dict] = {}


def _background_load(repo_full_name: str):
    """Run load_repo in a background thread so the API returns immediately."""
    _loading_status[repo_full_name] = {"status": "loading", "message": "Fetching commits..."}
    db = SessionLocal()
    try:
        repo = load_repo(db, repo_full_name)
        total = db.query(Commit).filter(Commit.repo_id == repo.id).count()
        _loading_status[repo_full_name] = {
            "status": "success",
            "message": f"Loaded {total} commits for {repo.full_name}",
        }
    except Exception as e:
        logger.error("Background load failed for %s: %s", repo_full_name, e)
        _loading_status[repo_full_name] = {
            "status": "error",
            "message": str(e),
        }
    finally:
        db.close()


@router.post("/load", response_model=StatusResponse)
def load_repository(request: RepoLoadRequest):
    """Kick off background fetch and return immediately."""
    repo_name = request.repo.strip()
    parts = repo_name.split("/")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail=f"Invalid repo format: '{repo_name}'. Expected 'owner/repo'.")

    # If already loading, just report status
    current = _loading_status.get(repo_name)
    if current and current["status"] == "loading":
        return StatusResponse(status="loading", message="Already loading this repository...")

    # Start background thread
    thread = threading.Thread(target=_background_load, args=(repo_name,), daemon=True)
    thread.start()
    return StatusResponse(status="loading", message=f"Started loading {repo_name} in background...")


@router.get("/status/{owner}/{name}", response_model=StatusResponse)
def repo_load_status(owner: str, name: str):
    """Check the loading status of a repo."""
    repo_name = f"{owner}/{name}"
    current = _loading_status.get(repo_name)
    if not current:
        return StatusResponse(status="idle", message="No loading in progress")
    return StatusResponse(status=current["status"], message=current["message"])


@router.get("/list", response_model=list[RepoResponse])
def list_repos(db: Session = Depends(get_db)):
    """List all tracked repositories."""
    repos = db.query(Repo).all()
    results = []
    for r in repos:
        total = db.query(Commit).filter(Commit.repo_id == r.id).count()
        results.append(
            RepoResponse(
                id=r.id,
                name=r.name,
                full_name=r.full_name,
                url=r.url,
                total_commits=total,
            )
        )
    return results


@router.delete("/{repo_id}", response_model=StatusResponse)
def delete_repo(repo_id: int, db: Session = Depends(get_db)):
    """Remove a tracked repository and all its data."""
    repo = db.query(Repo).filter(Repo.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    name = repo.full_name
    db.delete(repo)
    db.commit()
    return StatusResponse(status="success", message=f"Deleted {name}")
