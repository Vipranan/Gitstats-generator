import { useMemo } from "react";
import PieChartComponent from "../components/Charts/PieChartComponent";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";

export default function Languages({ repo, stats }) {
  const data = stats?.languages ?? [];
  const loading = false;
  const error = null;

  const perContributor = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.forEach((lang) => {
      lang.contributors?.forEach((c) => {
        if (!map[c.name]) map[c.name] = {};
        map[c.name][lang.language] = c.percentage;
      });
    });
    return Object.entries(map).map(([name, langs]) => ({ name, ...langs }));
  }, [data]);

  const { page, setPage, totalPages, paginatedData: pagedContributors } = usePagination(perContributor, 10);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Languages
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Language distribution across the repository
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PieChartComponent
          data={data}
          title="Overall Language Distribution"
          height={320}
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Language Breakdown
          </h3>
          <div className="space-y-3">
            {data?.map((lang) => (
              <div key={lang.language} className="flex items-center gap-3">
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: lang.color }} />
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{lang.language}</span>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full" style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }} />
                </div>
                <span className="w-10 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {perContributor.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Language Usage per Contributor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Contributor</th>
                  {data?.map((l) => (
                    <th key={l.language} className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">{l.language}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedContributors.map((row) => (
                  <tr key={row.name} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.name}</td>
                    {data?.map((l) => (
                      <td key={l.language} className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {row[l.language] ? `${row[l.language]}%` : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              totalItems={perContributor.length}
              pageSize={10}
            />
          </div>
        </div>
      )}
    </div>
  );
}
