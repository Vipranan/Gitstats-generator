import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Flame } from "lucide-react";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
import { useStats } from "../hooks/useStats";
import { fetchLeaderboard } from "../services/api";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function RankBadge({ rank }) {
  if (rank === 1)
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
        <Trophy size={16} />
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
        <Medal size={16} />
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400">
        <Medal size={16} />
      </span>
    );
  return (
    <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500">
      #{rank}
    </span>
  );
}

export default function Leaderboard({ repo }) {
  const [period, setPeriod] = useState("weekly");
  const { data, loading, error, isMock, refetch } = useStats(fetchLeaderboard, repo, period);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leaderboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Top contributors ranked by contribution score</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                period === p.key
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data?.length ? (
        <EmptyState message="No leaderboard data" />
      ) : (
        <div className="space-y-3">
          {data.map((entry, i) => (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900 ${
                entry.rank <= 3
                  ? "border-primary-200 dark:border-primary-500/20"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <RankBadge rank={entry.rank} />
              <img src={entry.avatar} alt={entry.name} className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900 dark:text-white">{entry.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.commits} commits &middot; +{entry.linesAdded.toLocaleString()} / -{entry.linesDeleted.toLocaleString()} lines
                </p>
              </div>
              {entry.streak > 7 && (
                <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 sm:inline-flex">
                  <Flame size={12} />
                  {entry.streak}d streak
                </span>
              )}
              <div className="text-right">
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{entry.score.toLocaleString()}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Score</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {isMock && <MockDataNote />}
    </div>
  );
}
