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


def fetch_commits(owner: str, repo: str, since: str | None = None, per_page: int = 100, max_pages: int | None = None) -> list[dict]:
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

        if max_pages is not None and page > max_pages:
            break

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


def fetch_stats_contributors(owner: str, repo: str, max_retries: int = 5) -> list[dict]:
    """
    Fetch GitHub's pre-computed contributor stats (weekly commits/additions/deletions).
    Returns 202 while GitHub is computing — retries up to max_retries times with 2s sleep.
    Returns list of contributor stat objects.
    """
    url = f"{GITHUB_API}/repos/{owner}/{repo}/stats/contributors"
    for attempt in range(max_retries):
        resp = requests.get(url, headers=_headers(), timeout=30)
        if resp.status_code == 202:
            logger.info("GitHub computing contributor stats, retry %d/%d", attempt + 1, max_retries)
            time.sleep(2)
            continue
        if resp.status_code == 404:
            raise ValueError(f"Repository {owner}/{repo} not found")
        resp.raise_for_status()
        data = resp.json()
        if data:
            return data
        time.sleep(2)
    logger.warning("Contributor stats still empty after %d retries for %s/%s", max_retries, owner, repo)
    return []


def fetch_stats_commit_activity(owner: str, repo: str, max_retries: int = 5) -> list[dict]:
    """
    Fetch GitHub's weekly commit counts for the past 52 weeks.
    Each item: {"days": [sun..sat counts], "total": N, "week": unix_timestamp}
    Returns 202 while computing — retries with 2s sleep.
    """
    url = f"{GITHUB_API}/repos/{owner}/{repo}/stats/commit_activity"
    for attempt in range(max_retries):
        resp = requests.get(url, headers=_headers(), timeout=30)
        if resp.status_code == 202:
            logger.info("GitHub computing commit activity, retry %d/%d", attempt + 1, max_retries)
            time.sleep(2)
            continue
        if resp.status_code == 404:
            raise ValueError(f"Repository {owner}/{repo} not found")
        resp.raise_for_status()
        data = resp.json()
        if data:
            return data
        time.sleep(2)
    logger.warning("Commit activity empty after %d retries for %s/%s", max_retries, owner, repo)
    return []


def fetch_repo_languages(owner: str, repo: str) -> dict[str, int]:
    """
    Fetch byte counts per language for the repository.
    Returns {"Python": 123456, "JavaScript": 78901, ...}
    This endpoint returns instantly (not cached like stats endpoints).
    """
    url = f"{GITHUB_API}/repos/{owner}/{repo}/languages"
    resp = requests.get(url, headers=_headers(), timeout=30)
    if resp.status_code == 404:
        raise ValueError(f"Repository {owner}/{repo} not found")
    resp.raise_for_status()
    return resp.json()
