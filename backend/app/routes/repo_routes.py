import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.repo import Repo
from app.models.commit import Commit
from app.schemas.schemas import RepoLoadRequest, RepoResponse, StatusResponse
from app.services.processing_service import load_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/repo", tags=["Repository"])


@router.post("/load", response_model=StatusResponse)
def load_repository(request: RepoLoadRequest, db: Session = Depends(get_db)):
    """Fetch commits from GitHub and store in the database."""
    try:
        repo = load_repo(db, request.repo)
        total = db.query(Commit).filter(Commit.repo_id == repo.id).count()
        return StatusResponse(
            status="success",
            message=f"Loaded {total} commits for {repo.full_name}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to load repo %s: %s", request.repo, e)
        raise HTTPException(status_code=500, detail=f"Failed to load repository: {e}")


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
