# Phase 1 Improvements — Design Spec

**Date:** 2026-04-01  
**Approach:** Fix + Light Refactor (targeted fixes with shared utilities extracted naturally)  
**Scope:** Backend performance + correctness, frontend error handling + UX

---

## Overview

Eight targeted fixes across backend and frontend. No structural rewrites — changes land exactly where the problem lives, with shared utilities extracted only where fixes naturally create them.

---

## Backend Fixes

### 1. N+1 Queries → GROUP BY Aggregation

**File:** `backend/app/services/analytics_service.py`

**Problem:** Three analytics functions run queries inside loops:
- `get_contributor_stats()`: 4 queries per contributor (`lines`, `lang_rows`, `weekly_rows`, `_compute_streak`)
- `get_language_stats()`: 1 query per language (`contrib_rows`)
- `get_leaderboard()`: 2 queries per contributor (`lines`, `_compute_streak`)

Additionally, all three build `commit_ids = [c.id for c in ...]` and pass it as `.in_(commit_ids)` — pulling all IDs into Python memory.

**Fix:**
- Pre-fetch all per-contributor aggregations with single `GROUP BY` queries before the loop:
  - Lines added/deleted: single `GROUP BY contributor_id` JOIN query
  - Language breakdown: single `GROUP BY (contributor_id, language)` query
  - Weekly activity: single `GROUP BY (contributor_id, week)` query
- Replace `.in_(commit_ids)` with SQLAlchemy subqueries (`commit_q.with_entities(Commit.id).subquery()`)
- `_compute_streak()` remains per-contributor (cannot be efficiently batched) but is acceptable once other N+1s are eliminated
- Apply same subquery + GROUP BY pattern to `get_language_stats()` and `get_leaderboard()`

**Result:** O(n) queries → O(1) per analytics endpoint.

---

### 2. Serial Commit Detail Fetching → ThreadPoolExecutor

**File:** `backend/app/services/processing_service.py`

**Problem:** `fetch_commit_detail()` is called synchronously inside a `for raw in raw_commits:` loop. Fetching 1000 new commits = 1000 sequential GitHub API calls.

**Fix:**
- Collect all new commit SHAs and their metadata first (the existing loop, minus the `fetch_commit_detail` call)
- Batch-fetch details using `concurrent.futures.ThreadPoolExecutor(max_workers=5)`
- Process file changes from the batched results
- Keep existing `_handle_rate_limit` logic — the worker threads each call it as needed
- No change to `github_service.py` — `fetch_commit_detail` stays synchronous

**Result:** ~5× faster repo loading without adding async/httpx complexity.

---

### 3. Input Validation

**Files:** `backend/app/routes/repo_routes.py`, `src/components/Sidebar.jsx`

**Problem:** Backend only checks `len(parts) != 2`. Frontend only checks for presence of `/`. Both accept malformed inputs like `foo//bar` or `/repo`.

**Fix:**
- Backend: validate against regex `^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$` before processing. Return HTTP 400 with a clear message on failure.
- Frontend: same regex check in `Sidebar.jsx` before submitting. Show an inline error message below the input field (e.g. "Use format: owner/repo").

---

### 4. Composite Database Indexes

**Files:** `backend/app/models/commit.py`, `backend/app/models/file_change.py`

**Problem:** Individual indexes exist on `repo_id`, `date`, `commit_id`, and `language`, but no composite indexes for the common filter combinations used in every analytics query.

**Fix:**
- `Commit` model: add `Index('ix_commits_repo_date', 'repo_id', 'date')`
- `FileChange` model: add `Index('ix_file_changes_commit_lang', 'commit_id', 'language')`

SQLAlchemy will emit these via `__table_args__`. No migration needed for SQLite (indexes are additive).

---

## Frontend Fixes

### 5. Inline Error Banner

**Files:** `src/pages/Overview.jsx`, `src/pages/Contributors.jsx`, `src/pages/Languages.jsx`, `src/pages/Leaderboard.jsx`

**Problem:** `useStats` returns an `error` value but no page renders it. Errors fail silently.

**Fix:** Add a shared `ErrorBanner` component (`src/components/ErrorBanner.jsx`):
- Displays above existing page content when `error` is set and `data` is already loaded
- Shows the error message + a "Retry" button (calls `refetch`)
- When `error` is set and `data` is null (first load failed), shows the banner with the existing `EmptyState` component below it

Each page adds: `{error && <ErrorBanner message={error} onRetry={refetch} />}`

---

### 6. Mock Data Footer Note

**Files:** `src/services/api.js`, `src/hooks/useStats.js`, page components

**Problem:** `fetchWithFallback` silently returns mock data when the backend is unreachable. Users see realistic-looking fake data with no indication.

**Fix:**
- `fetchWithFallback` returns `{ data, isMock: false }` on success and `{ data: MOCK[mockKey], isMock: true }` on fallback
- All fetch functions (`fetchDailyStats`, etc.) propagate the `isMock` flag
- `useStats` exposes `isMock` in its return value
- Pages pass `isMock` down; a shared `MockDataNote` component renders a subtle amber dot + "Sample data — connect backend for live stats" footer note when `isMock` is true

---

### 7. Numbered Pagination

**Files:** `src/hooks/usePagination.js` (new), `src/components/Pagination.jsx` (new), `src/components/Tables/ContributorsTable.jsx`, `src/pages/Languages.jsx`, `src/pages/Leaderboard.jsx`

**Problem:** All tables render the full dataset at once. With 100+ contributors this causes layout and performance issues.

**Fix:**
- `usePagination(data, pageSize = 10)` hook: returns `{ page, setPage, totalPages, paginatedData }`
- `Pagination` component: renders "Showing X–Y of Z", prev/next buttons, and numbered page buttons (show up to 5 page numbers with ellipsis for large sets)
- Applied to: Contributors table, Languages table, Leaderboard table
- Page resets to 1 when the selected repo changes

---

### 8. Pause Polling on Hidden Tab

**File:** `src/hooks/useStats.js`

**Problem:** `setInterval(load, 60_000)` runs unconditionally regardless of tab visibility. All 4 stats on Overview poll independently — 4 requests every 60s even when the user has switched away.

**Fix:**
- Add `document.addEventListener('visibilitychange', handler)` inside the `useEffect`
- When `document.hidden` becomes true: `clearInterval(intervalRef.current)`
- When `document.hidden` becomes false: immediately call `load()`, then restart the 60s interval
- Clean up the visibility listener on unmount

No change to the 60s poll frequency.

---

## Shared Utilities Created

| Utility | Type | Used by |
|---------|------|---------|
| `ErrorBanner` | Component | All 4 pages |
| `MockDataNote` | Component | All 4 pages |
| `usePagination` | Hook | Contributors, Languages, Leaderboard |
| `Pagination` | Component | Contributors, Languages, Leaderboard |

---

## What This Does NOT Change

- No changes to routing, theming, or Sidebar
- No changes to chart components
- No changes to the APScheduler background job
- No changes to the GitHub API fetching logic beyond batching commit details
- No database schema changes beyond adding indexes (additive, no migration)
- Poll frequency stays at 60s

---

## Phase 2 (Future)

Search/filter, chart deduplication, Sidebar refactor, date range picker, CORS tightening, Vite code splitting.
