import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

// ── Mock Data ─────────────────────────────────────────────────────────

function generateDates(count, stepDays = 1) {
  const dates = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * stepDays);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const CONTRIBUTORS = [
  "Alice Chen",
  "Bob Kumar",
  "Carlos Rivera",
  "Diana Osei",
  "Ethan Park",
  "Fiona Walsh",
  "George Tanaka",
  "Hannah Müller",
];

const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "CSS",
  "HTML",
  "Shell",
];

const LANGUAGE_COLORS = {
  JavaScript: "#f7df1e",
  TypeScript: "#3178c6",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const dailyDates = generateDates(30);
const weeklyDates = generateDates(12, 7);

const mockDaily = dailyDates.map((date) => ({
  date,
  commits: randInt(3, 45),
}));

const mockWeekly = weeklyDates.map((date) => ({
  week: date,
  commits: randInt(20, 200),
}));

const mockContributors = CONTRIBUTORS.map((name, i) => {
  const totalCommits = randInt(30, 500);
  const linesAdded = randInt(2000, 50000);
  const linesDeleted = randInt(500, linesAdded);
  const topLang = LANGUAGES[i % LANGUAGES.length];
  const langBreakdown = LANGUAGES.slice(0, randInt(3, 6)).map((lang) => ({
    language: lang,
    percentage: randInt(5, 60),
    color: LANGUAGE_COLORS[lang],
  }));
  const total = langBreakdown.reduce((s, l) => s + l.percentage, 0);
  langBreakdown.forEach((l) => {
    l.percentage = Math.round((l.percentage / total) * 100);
  });
  const weeklyActivity = weeklyDates.map((week) => ({
    week,
    commits: randInt(1, 40),
  }));

  return {
    name,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    totalCommits,
    linesAdded,
    linesDeleted,
    topLanguage: topLang,
    languageBreakdown: langBreakdown,
    weeklyActivity,
    streak: randInt(0, 30),
  };
});

const mockLanguages = LANGUAGES.map((language) => ({
  language,
  percentage: randInt(3, 30),
  color: LANGUAGE_COLORS[language],
  contributors: CONTRIBUTORS.slice(0, randInt(2, 6)).map((name) => ({
    name,
    percentage: randInt(5, 50),
  })),
}));
const langTotal = mockLanguages.reduce((s, l) => s + l.percentage, 0);
mockLanguages.forEach((l) => {
  l.percentage = Math.round((l.percentage / langTotal) * 100);
});

const sortedContributors = [...mockContributors].sort(
  (a, b) => b.totalCommits - a.totalCommits
);

const mockLeaderboard = sortedContributors.map((c, i) => ({
  rank: i + 1,
  name: c.name,
  avatar: c.avatar,
  commits: c.totalCommits,
  linesAdded: c.linesAdded,
  linesDeleted: c.linesDeleted,
  score: c.totalCommits * 2 + Math.round(c.linesAdded / 100),
  streak: c.streak,
}));

const MOCK = {
  daily: mockDaily,
  weekly: mockWeekly,
  contributors: mockContributors,
  languages: mockLanguages,
  leaderboard: mockLeaderboard,
};

// ── API Functions ─────────────────────────────────────────────────────

async function fetchWithFallback(endpoint, mockKey, params = {}) {
  try {
    const res = await client.get(endpoint, { params });
    return res.data;
  } catch {
    console.warn(`API unavailable for ${endpoint}, using mock data`);
    return MOCK[mockKey];
  }
}

export function fetchDailyStats(repo) {
  return fetchWithFallback("/stats/daily", "daily", { repo });
}

export function fetchWeeklyStats(repo) {
  return fetchWithFallback("/stats/weekly", "weekly", { repo });
}

export function fetchContributors(repo) {
  return fetchWithFallback("/stats/contributors", "contributors", { repo });
}

export function fetchLanguages(repo) {
  return fetchWithFallback("/stats/languages", "languages", { repo });
}

export function fetchLeaderboard(repo, period) {
  return fetchWithFallback("/stats/leaderboard", "leaderboard", {
    repo,
    period,
  });
}

export async function fetchRepos() {
  try {
    const res = await client.get("/repo/list");
    return res.data.map((r) => r.full_name);
  } catch {
    console.warn("Could not fetch repos from backend");
    return [];
  }
}

export async function loadRepo(repoFullName) {
  const res = await client.post("/repo/load", { repo: repoFullName });
  return res.data;
}
