from datetime import date, datetime


def parse_github_date(date_str: str) -> date:
    """Parse ISO-8601 date string from GitHub API into a date object."""
    return datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()


def iso_week_string(d: date) -> str:
    """Return ISO week string like '2026-W10'."""
    iso_year, iso_week, _ = d.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"
