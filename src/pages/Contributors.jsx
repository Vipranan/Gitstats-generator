import { useState } from "react";
import ContributorsTable from "../components/Tables/ContributorsTable";
import ContributorModal from "../components/ContributorModal";
import Loader from "../components/Loader";
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
import { useStats } from "../hooks/useStats";
import { fetchContributors } from "../services/api";

export default function Contributors({ repo }) {
  const { data, loading, error, isMock, refetch } = useStats(fetchContributors, repo);
  const [selected, setSelected] = useState(null);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={refetch} />}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Contributors
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data?.length ?? 0} contributors found. Click a row for details.
          </p>
        </div>
      </div>

      <ContributorsTable data={data} onRowClick={setSelected} />

      {selected && (
        <ContributorModal
          contributor={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {isMock && <MockDataNote />}
    </div>
  );
}
