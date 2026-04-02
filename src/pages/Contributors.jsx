import { useState } from "react";
import ContributorsTable from "../components/Tables/ContributorsTable";
import ContributorModal from "../components/ContributorModal";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

export default function Contributors({ repo, stats }) {
  const data = stats?.contributors ?? [];
  const loading = false;
  const error = null;
  const [selected, setSelected] = useState(null);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
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
    </div>
  );
}
