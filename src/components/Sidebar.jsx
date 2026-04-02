import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Code2,
  Trophy,
  GitBranch,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { fetchEphemeralStats } from "../services/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/contributors", label: "Contributors", icon: Users },
  { to: "/languages", label: "Languages", icon: Code2 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const REPO_NAME_RE = /^[a-zA-Z0-9._-]{1,39}\/[a-zA-Z0-9._-]{1,100}$/;

export default function Sidebar({ repo, onStatsLoaded, open, onClose }) {
  const [adding, setAdding] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAddRepo(e) {
    e.preventDefault();
    const value = newRepo.trim();
    if (!value || !REPO_NAME_RE.test(value)) {
      setError("Use format: owner/repo (letters, numbers, . _ - only)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const stats = await fetchEphemeralStats(value);
      setNewRepo("");
      setAdding(false);
      onStatsLoaded(value, stats);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? "Failed to fetch repo stats");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-64 border-r
          border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950
          flex flex-col transition-transform duration-200
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <GitBranch size={18} />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Git Analytics
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pb-4">
          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
            Repository
            <button
              onClick={() => setAdding((a) => !a)}
              className="rounded p-0.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              title="Look up repository"
            >
              <Plus size={14} />
            </button>
          </label>

          {repo && !adding && (
            <p className="truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
              {repo}
            </p>
          )}

          {adding && (
            <form onSubmit={handleAddRepo} className="mb-2">
              <input
                type="text"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="owner/repo"
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                  {loading ? "Fetching..." : "View Stats"}
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setError(""); }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
              )}
            </form>
          )}

          {!repo && !adding && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Click + to view any GitHub repo.
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Stats fetched live from GitHub
          </p>
        </div>
      </aside>
    </>
  );
}
