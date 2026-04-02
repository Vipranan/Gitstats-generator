import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Overview from "./pages/Overview";
import Contributors from "./pages/Contributors";
import Languages from "./pages/Languages";
import Leaderboard from "./pages/Leaderboard";

const PAGE_TITLES = {
  "/": "Overview",
  "/contributors": "Contributors",
  "/languages": "Languages",
  "/leaderboard": "Leaderboard",
};

export default function App() {
  const [repo, setRepo] = useState("");
  const [stats, setStats] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = PAGE_TITLES[location.pathname] ?? "Git Analytics";

  function handleStatsLoaded(repoName, newStats) {
    setRepo(repoName);
    setStats(newStats);
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        repo={repo}
        onStatsLoaded={handleStatsLoaded}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          title={title}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {repo && stats ? (
            <Routes>
              <Route path="/" element={<Overview repo={repo} stats={stats} />} />
              <Route path="/contributors" element={<Contributors repo={repo} stats={stats} />} />
              <Route path="/languages" element={<Languages repo={repo} stats={stats} />} />
              <Route path="/leaderboard" element={<Leaderboard repo={repo} stats={stats} />} />
            </Routes>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">No repository selected</p>
              <p className="text-sm">Click the + in the sidebar and enter a GitHub repository.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
