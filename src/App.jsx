import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Overview from "./pages/Overview";
import Contributors from "./pages/Contributors";
import Languages from "./pages/Languages";
import Leaderboard from "./pages/Leaderboard";
import { fetchRepos } from "./services/api";

const PAGE_TITLES = {
  "/": "Overview",
  "/contributors": "Contributors",
  "/languages": "Languages",
  "/leaderboard": "Leaderboard",
};

export default function App() {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = PAGE_TITLES[location.pathname] ?? "Git Analytics";

  useEffect(() => {
    fetchRepos().then((list) => {
      setRepos(list);
      if (list.length > 0 && !repo) {
        setRepo(list[0]);
      }
    });
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        repos={repos}
        repo={repo}
        onRepoChange={setRepo}
        onReposRefresh={() =>
          fetchRepos().then((list) => {
            setRepos(list);
            if (list.length > 0 && !list.includes(repo)) {
              setRepo(list[0]);
            }
          })
        }
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          title={title}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {repo ? (
            <Routes>
              <Route path="/" element={<Overview repo={repo} />} />
              <Route path="/contributors" element={<Contributors repo={repo} />} />
              <Route path="/languages" element={<Languages repo={repo} />} />
              <Route path="/leaderboard" element={<Leaderboard repo={repo} />} />
            </Routes>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">No repositories loaded</p>
              <p className="text-sm">
                Use the sidebar to add a GitHub repository, or run:
              </p>
              <code className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800">
                curl -X POST http://localhost:8000/repo/load -H "Content-Type: application/json" -d '{'"repo": "owner/repo"'}'
              </code>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
