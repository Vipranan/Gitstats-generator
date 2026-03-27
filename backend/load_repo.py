#!/usr/bin/env python3
"""
CLI helper to load GitHub repositories into the Git Analytics Dashboard.

Usage:
    python load_repo.py owner/repo
    python load_repo.py owner/repo1 owner/repo2   # load multiple repos
"""

import sys
import requests

API_URL = "http://localhost:8000"


def load_repo(repo: str) -> None:
    """Load a single repo via the backend API."""
    if "/" not in repo:
        print(f"  ✗ Invalid format: '{repo}' — use owner/repo (e.g. Vipranan/SQL-BUDDY)")
        return

    print(f"  ⏳ Loading {repo}...", end="", flush=True)
    try:
        resp = requests.post(
            f"{API_URL}/repo/load",
            json={"repo": repo},
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        print(f"\r  ✓ {data.get('message', 'Loaded successfully')}")
    except requests.ConnectionError:
        print(f"\r  ✗ Cannot connect to backend at {API_URL}")
        print("    Make sure the backend is running: uvicorn app.main:app --reload")
        sys.exit(1)
    except requests.HTTPError as e:
        detail = ""
        try:
            detail = e.response.json().get("detail", "")
        except Exception:
            pass
        print(f"\r  ✗ Failed to load {repo}: {detail or e}")
    except requests.Timeout:
        print(f"\r  ✗ Request timed out for {repo} (large repo? try again)")


def main() -> None:
    if len(sys.argv) < 2:
        print("Git Analytics — Repository Loader")
        print("──────────────────────────────────")
        print("Usage:  python load_repo.py <owner/repo> [owner/repo2 ...]")
        print()
        print("Examples:")
        print("  python load_repo.py Vipranan/SQL-BUDDY")
        print("  python load_repo.py facebook/react torvalds/linux")
        sys.exit(0)

    repos = sys.argv[1:]
    print(f"Loading {len(repos)} repo(s)...\n")
    for repo in repos:
        load_repo(repo)
    print("\nDone! Open http://localhost:5173 to view your dashboard.")


if __name__ == "__main__":
    main()
