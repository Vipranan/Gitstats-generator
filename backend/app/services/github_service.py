import os
import logging
import time
import requests

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _headers() -> dict[str, str]:
    token = os.getenv("GITHUB_TOKEN", "")
    h = {"Accept": "application/vnd.github+json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _handle_rate_limit(response: requests.Response) -> None:
    """Sleep until the rate-limit window resets if we hit the limit."""
    remaining = response.headers.get("X-RateLimit-Remaining")
    if remaining is not None and int(remaining) == 0:
        reset_ts = int(response.headers.get("X-RateLimit-Reset", 0))
        sleep_for = max(reset_ts - int(time.time()), 1)
        logger.warning("GitHub rate limit hit — sleeping %ds", sleep_for)
        time.sleep(sleep_for)


def fetch_commits(owner: str, repo: str, since: str | None = None, per_page: int = 100) -> list[dict]:
    """
    Fetch all commits for a repo, handling pagination.
    `since` is an ISO-8601 date string for incremental fetches.
    Returns list of raw GitHub commit objects.
    """
    url = f"{GITHUB_API}/repos/{owner}/{repo}/commits"
    params: dict = {"per_page": per_page}
    if since:
        params["since"] = since

    all_commits: list[dict] = []
    page = 1

    while True:
        params["page"] = page
        logger.info("Fetching commits page %d for %s/%s", page, owner, repo)
        resp = requests.get(url, headers=_headers(), params=params, timeout=30)

        if resp.status_code == 404:
            raise ValueError(f"Repository {owner}/{repo} not found")
        if resp.status_code == 403:
            _handle_rate_limit(resp)
            continue  # retry same page after sleeping
        resp.raise_for_status()

        commits = resp.json()
        if not commits:
            break

        all_commits.extend(commits)
        page += 1

        # Respect rate limit proactively
        _handle_rate_limit(resp)

    logger.info("Fetched %d commits for %s/%s", len(all_commits), owner, repo)
    return all_commits


def fetch_commit_detail(owner: str, repo: str, sha: str) -> dict:
    """Fetch detailed commit info including file changes."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}"
    resp = requests.get(url, headers=_headers(), timeout=30)

    if resp.status_code == 403:
        _handle_rate_limit(resp)
        resp = requests.get(url, headers=_headers(), timeout=30)

    resp.raise_for_status()
    return resp.json()


def fetch_repo_info(owner: str, repo: str) -> dict:
    """Fetch basic repository metadata."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}"
    resp = requests.get(url, headers=_headers(), timeout=30)

    if resp.status_code == 404:
        raise ValueError(f"Repository {owner}/{repo} not found")
    resp.raise_for_status()
    return resp.json()
