import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PieChartComponent from "./Charts/PieChartComponent";
import BarChartComponent from "./Charts/BarChartComponent";

export default function ContributorModal({ contributor, onClose }) {
  if (!contributor) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={contributor.avatar}
                alt={contributor.name}
                className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800"
              />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {contributor.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {contributor.totalCommits} commits &middot;{" "}
                  {contributor.streak}d streak
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Commits</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {contributor.totalCommits.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lines Added
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                +{contributor.linesAdded.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lines Deleted
              </p>
              <p className="text-xl font-bold text-red-500 dark:text-red-400">
                -{contributor.linesDeleted.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <PieChartComponent
              data={contributor.languageBreakdown}
              title="Language Breakdown"
              height={240}
            />
            <BarChartComponent
              data={contributor.weeklyActivity}
              xKey="week"
              yKey="commits"
              title="Weekly Activity"
              color="#6366f1"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
