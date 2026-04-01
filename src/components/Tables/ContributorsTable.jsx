import { motion } from "framer-motion";
import EmptyState from "../EmptyState";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../Pagination";

export default function ContributorsTable({ data, onRowClick }) {
  const { page, setPage, totalPages, paginatedData } = usePagination(data, 10);

  if (!data?.length) return <EmptyState message="No contributors found" />;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Contributor</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Commits</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 sm:table-cell">Lines Added</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 sm:table-cell">Lines Deleted</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 md:table-cell">Top Language</th>
              <th className="hidden px-5 py-3 font-medium text-gray-500 dark:text-gray-400 md:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((c, i) => (
              <motion.tr
                key={c.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onRowClick?.(c)}
                className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <img src={c.avatar} alt={c.name} className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800" />
                    <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-semibold text-gray-700 dark:text-gray-300">{c.totalCommits.toLocaleString()}</td>
                <td className="hidden px-5 py-3.5 text-emerald-600 dark:text-emerald-400 sm:table-cell">+{c.linesAdded.toLocaleString()}</td>
                <td className="hidden px-5 py-3.5 text-red-500 dark:text-red-400 sm:table-cell">-{c.linesDeleted.toLocaleString()}</td>
                <td className="hidden px-5 py-3.5 md:table-cell">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {c.topLanguage}
                  </span>
                </td>
                <td className="hidden px-5 py-3.5 md:table-cell">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{c.streak}d</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 pb-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          totalItems={data.length}
          pageSize={10}
        />
      </div>
    </div>
  );
}
