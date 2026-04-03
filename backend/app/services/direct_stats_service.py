"""
Direct (ephemeral) stats service — fetches from GitHub API, no DB writes.

All data is computed in memory and returned immediately. Nothing is persisted.
"""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone

from app.services.github_service import (
    fetch_stats_contributors,
    fetch_stats_commit_activity,
    fetch_repo_languages,
    fetch_commits,
)

logger = logging.getLogger(__name__)

LANG_COLORS: dict[str, str] = {
    "JavaScript": "#f7df1e", "TypeScript": "#3178c6", "Python": "#3572a5",
    "Go": "#00add8", "Rust": "#dea584", "CSS": "#563d7c", "HTML": "#e34c26",
    "Shell": "#89e051", "Ruby": "#701516", "Java": "#b07219", "C": "#555555",
    "C++": "#f34b7d", "C#": "#178600", "Swift": "#fa7343", "Kotlin": "#a97bff",
    "Scala": "#c22d40", "PHP": "#4f5d95", "Dockerfile": "#384d54",
    "Vue": "#41b883", "SCSS": "#c6538c",
}

DEFAULT_COLOR = "#8b949e"


def _build_daily(commits_raw: list[dict]) -> list[dict]:
    """Build daily commit counts for the last 30 days from raw GitHub commit list."""
    today = date.today()
    cutoff = today - timedelta(days=29)

    counts: dict[str, int] = {}
    for c in commits_raw:
        date_str = c.get("commit", {}).get("author", {}).get("date", "")[:10]
        if date_str >= cutoff.isoformat():
            counts[date_str] = counts.get(date_str, 0) + 1

    result = []
    for i in range(30):
        d = (cutoff + timedelta(days=i)).isoformat()
        result.append({"date": d, "commits": counts.get(d, 0)})
    return result


def _build_weekly(activity_raw: list[dict]) -> list[dict]:
    """
    Build last-12-weeks commit counts from GitHub's commit_activity response.
    Each activity item: {"week": unix_ts, "total": N, "days": [...]}
    Returns: [{"week": "2026-W01", "commits": 42}, ...]
    """
    tail = activity_raw[-12:] if len(activity_raw) >= 12 else activity_raw
    result = []
    for item in tail:
        ts = item.get("week", 0)
        week_date = datetime.fromtimestamp(ts, tz=timezone.utc).date()
        iso_week = week_date.strftime("%G-W%V")
        result.append({"week": iso_week, "commits": item.get("total", 0)})
    return result


def _build_contributors(
    contrib_raw: list[dict],
    lang_bytes: dict[str, int],
) -> list[dict]:
    """
    Build contributor list from GitHub's stats/contributors response.
    lang_bytes: {"Python": 12345, ...} — used as approximate language breakdown for all contributors.
    """
    total_bytes = sum(lang_bytes.values()) or 1
    lang_breakdown_template = []
    for lang, b in sorted(lang_bytes.items(), key=lambda x: -x[1])[:6]:
        pct = round(b / total_bytes * 100)
        if pct > 0:
            lang_breakdown_template.append({
                "language": lang,
                "percentage": pct,
                "color": LANG_COLORS.get(lang, DEFAULT_COLOR),
            })

    top_lang = lang_breakdown_template[0]["language"] if lang_breakdown_template else "Unknown"

    contributors = []
    for c in contrib_raw:
        author = c.get("author") or {}
        name = author.get("login", "unknown")
        avatar = author.get("avatar_url", f"https://api.dicebear.com/7.x/initials/svg?seed={name}")
        total_commits = c.get("total", 0)

        lines_added = sum(w.get("a", 0) for w in c.get("weeks", []))
        lines_deleted = sum(w.get("d", 0) for w in c.get("weeks", []))

        weeks = c.get("weeks", [])
        tail_weeks = weeks[-12:] if len(weeks) >= 12 else weeks
        weekly_activity = []
        for w in tail_weeks:
            ts = w.get("w", 0)
            week_date = datetime.fromtimestamp(ts, tz=timezone.utc).date()
            iso_week = week_date.strftime("%G-W%V")
            weekly_activity.append({"week": iso_week, "commits": w.get("c", 0)})

        streak = 0
        for w in reversed(tail_weeks):
            if w.get("c", 0) > 0:
                streak += 1
            else:
                break

        contributors.append({
            "name": name,
            "avatar": avatar,
            "totalCommits": total_commits,
            "linesAdded": lines_added,
            "linesDeleted": lines_deleted,
            "topLanguage": top_lang,
            "languageBreakdown": [dict(entry) for entry in lang_breakdown_template],
            "weeklyActivity": weekly_activity,
            "streak": streak,
        })

    contributors.sort(key=lambda x: -x["totalCommits"])
    return contributors


def _build_languages(
    lang_bytes: dict[str, int],
    contributors: list[dict],
) -> list[dict]:
    """Build language stats from GitHub's languages response."""
    total_bytes = sum(lang_bytes.values()) or 1
    langs = []
    for lang, b in sorted(lang_bytes.items(), key=lambda x: -x[1]):
        pct = round(b / total_bytes * 100)
        if pct == 0:
            continue
        contrib_list = [
            {"name": c["name"], "percentage": round(100 / len(contributors))}
            for c in contributors[:5]
        ] if contributors else []
        langs.append({
            "language": lang,
            "percentage": pct,
            "color": LANG_COLORS.get(lang, DEFAULT_COLOR),
            "contributors": contrib_list,
        })
    return langs


def _build_leaderboard(contributors: list[dict]) -> list[dict]:
    """Build ranked leaderboard from already-sorted contributor list."""
    return [
        {
            "rank": i + 1,
            "name": c["name"],
            "avatar": c["avatar"],
            "commits": c["totalCommits"],
            "linesAdded": c["linesAdded"],
            "linesDeleted": c["linesDeleted"],
            "score": c["totalCommits"] * 2 + round(c["linesAdded"] / 100),
            "streak": c["streak"],
        }
        for i, c in enumerate(contributors)
    ]


def compute_ephemeral_stats(owner: str, repo: str) -> dict:
    """
    Fetch all stats from GitHub in parallel and return combined dict.
    Raises ValueError if repo not found.
    No DB access. Nothing is persisted.
    """
    since_30d = (date.today() - timedelta(days=30)).isoformat() + "T00:00:00Z"

    results: dict = {}
    _lock = threading.Lock()

    def _fetch(key, fn, *args, **kwargs):
        try:
            value = fn(*args, **kwargs)
        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", key, exc)
            value = None
        with _lock:
            results[key] = value

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(_fetch, "contributors_raw", fetch_stats_contributors, owner, repo, 3),
            pool.submit(_fetch, "activity_raw",     fetch_stats_commit_activity, owner, repo, 3),
            pool.submit(_fetch, "lang_bytes",        fetch_repo_languages, owner, repo),
            pool.submit(_fetch, "commits_raw",       fetch_commits, owner, repo, since_30d, 100, 1),
        ]
        for f in as_completed(futures):
            f.result()

    contributors_raw = results.get("contributors_raw") or []
    activity_raw     = results.get("activity_raw")     or []
    lang_bytes       = results.get("lang_bytes")       or {}
    commits_raw      = results.get("commits_raw")      or []

    if not contributors_raw and not activity_raw and not lang_bytes and not commits_raw:
        raise ValueError(f"Could not fetch any data for {owner}/{repo}")

    contributors = _build_contributors(contributors_raw, lang_bytes)

    return {
        "daily":        _build_daily(commits_raw),
        "weekly":       _build_weekly(activity_raw),
        "contributors": contributors,
        "languages":    _build_languages(lang_bytes, contributors),
        "leaderboard":  _build_leaderboard(contributors),
    }
