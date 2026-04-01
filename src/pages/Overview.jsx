import { useMemo } from "react";
import { GitCommit, Users, Crown, Code2, Flame } from "lucide-react";
import StatCard from "../components/StatCard";
import LineChartComponent from "../components/Charts/LineChartComponent";
import BarChartComponent from "../components/Charts/BarChartComponent";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import MockDataNote from "../components/MockDataNote";
import { useStats } from "../hooks/useStats";
import {
  fetchDailyStats,
  fetchWeeklyStats,
  fetchContributors,
  fetchLanguages,
} from "../services/api";

export default function Overview({ repo }) {
  const daily = useStats(fetchDailyStats, repo);
  const weekly = useStats(fetchWeeklyStats, repo);
  const contributors = useStats(fetchContributors, repo);
  const languages = useStats(fetchLanguages, repo);

  const loading =
    daily.loading || weekly.loading || contributors.loading || languages.loading;

  const anyError = daily.error || weekly.error || contributors.error || languages.error;
  const anyRefetch = daily.refetch;
  const showMock = daily.isMock;

  const stats = useMemo(() => {
    if (!daily.data || !contributors.data || !languages.data) return null;

    const totalCommits = daily.data.reduce((s, d) => s + d.commits, 0);
    const activeContributors = contributors.data.length;
    const topContrib = [...contributors.data].sort(
      (a, b) => b.totalCommits - a.totalCommits
    )[0];
    const totalLangs = languages.data.length;

    const today = new Date().toISOString().split("T")[0];
    const todayCommits =
      daily.data.find((d) => d.date === today)?.commits ?? 0;
    const mostActiveToday = todayCommits > 0;

    return {
      totalCommits,
      activeContributors,
      topContributor: topContrib?.name ?? "N/A",
      totalLanguages: totalLangs,
      mostActiveToday,
    };
  }, [daily.data, contributors.data, languages.data]);

  if (loading) return <Loader />;

  if (anyError && !stats) return (
    <>
      <ErrorBanner message={anyError} onRetry={anyRefetch} />
      <EmptyState message="No data available" />
    </>
  );

  return (
    <div className="space-y-6">
      {anyError && <ErrorBanner message={anyError} onRetry={anyRefetch} />}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Commits"
            value={stats.totalCommits.toLocaleString()}
            subtitle="Last 30 days"
            icon={GitCommit}
            color="primary"
          />
          <StatCard
            title="Active Contributors"
            value={stats.activeContributors}
            subtitle="All time"
            icon={Users}
            color="green"
          />
          <StatCard
            title="Top Contributor"
            value={stats.topContributor}
            subtitle="By total commits"
            icon={Crown}
            color="amber"
          />
          <StatCard
            title="Languages Used"
            value={stats.totalLanguages}
            subtitle={
              stats.mostActiveToday ? (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <Flame size={12} /> Most active today
                </span>
              ) : (
                "Across all files"
              )
            }
            icon={Code2}
            color="violet"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChartComponent
          data={daily.data}
          xKey="date"
          yKey="commits"
          title="Daily Commits"
          color="#6366f1"
        />
        <BarChartComponent
          data={weekly.data}
          xKey="week"
          yKey="commits"
          title="Weekly Commits"
          color="#818cf8"
        />
      </div>
      {showMock && <MockDataNote />}
    </div>
  );
}
