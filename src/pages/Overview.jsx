import { useMemo } from "react";
import { GitCommit, Users, Crown, Code2, Flame } from "lucide-react";
import StatCard from "../components/StatCard";
import LineChartComponent from "../components/Charts/LineChartComponent";
import BarChartComponent from "../components/Charts/BarChartComponent";

export default function Overview({ repo, stats }) {
  const daily = stats?.daily ?? [];
  const weekly = stats?.weekly ?? [];
  const contributors = stats?.contributors ?? [];
  const languages = stats?.languages ?? [];

  const derivedStats = useMemo(() => {
    if (!daily || !contributors || !languages) return null;

    const totalCommits = daily.reduce((s, d) => s + d.commits, 0);
    const activeContributors = contributors.length;
    const topContrib = [...contributors].sort(
      (a, b) => b.totalCommits - a.totalCommits
    )[0];
    const totalLangs = languages.length;

    const today = new Date().toISOString().split("T")[0];
    const todayCommits =
      daily.find((d) => d.date === today)?.commits ?? 0;
    const mostActiveToday = todayCommits > 0;

    return {
      totalCommits,
      activeContributors,
      topContributor: topContrib?.name ?? "N/A",
      totalLanguages: totalLangs,
      mostActiveToday,
    };
  }, [daily, contributors, languages]);

  return (
    <div className="space-y-6">
      {derivedStats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Commits"
            value={derivedStats.totalCommits.toLocaleString()}
            subtitle="Last 30 days"
            icon={GitCommit}
            color="primary"
          />
          <StatCard
            title="Active Contributors"
            value={derivedStats.activeContributors}
            subtitle="All time"
            icon={Users}
            color="green"
          />
          <StatCard
            title="Top Contributor"
            value={derivedStats.topContributor}
            subtitle="By total commits"
            icon={Crown}
            color="amber"
          />
          <StatCard
            title="Languages Used"
            value={derivedStats.totalLanguages}
            subtitle={
              derivedStats.mostActiveToday ? (
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
          data={daily}
          xKey="date"
          yKey="commits"
          title="Daily Commits"
          color="#6366f1"
        />
        <BarChartComponent
          data={weekly}
          xKey="week"
          yKey="commits"
          title="Weekly Commits"
          color="#818cf8"
        />
      </div>
    </div>
  );
}
