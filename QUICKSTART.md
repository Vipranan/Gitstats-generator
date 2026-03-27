# Quick Start

Get the Git Analytics Dashboard running in under 2 minutes.

---

## 1. Start the Backend

```bash
cd backend
conda activate py12
pip install -r requirements.txt
```

Set up your GitHub token (optional but recommended):

```bash
cp .env.example .env
```

Edit `.env` and add your token:

```
GITHUB_TOKEN=ghp_your_token_here
```

> **Get a token:** GitHub → Profile → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → Select `repo` scope → Generate → Copy.

Start the server:

```bash
uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**

---

## 2. Start the Frontend

From the **project root** (not the backend folder):

```bash
cd /path/to/Gitstats-generator
npm install
npm run dev
```

Frontend runs at **http://localhost:5173** (or 5174 if 5173 is taken).

> The frontend works without the backend using built-in mock data. When the backend is running, it switches to real data automatically.

---

## 3. Load a Repository

You have **three ways** to add a GitHub repository:

### Option A: From the Dashboard UI ⭐ (Recommended)

Click the **+** button next to "Repository" in the sidebar, type `owner/repo` (e.g. `Vipranan/SQL-BUDDY`), and click **Add**. That's it!

### Option B: CLI Helper Script

Open a **new terminal** and run:

```bash
cd backend
python load_repo.py Vipranan/SQL-BUDDY
```

You can load multiple repos at once:

```bash
python load_repo.py Vipranan/SQL-BUDDY sickn33/antigravity-awesome-skills
```

### Option C: Using `curl` (Advanced)

```bash
curl -X POST http://localhost:8000/repo/load \
  -H "Content-Type: application/json" \
  -d '{"repo": "Vipranan/SQL-BUDDY"}'
```

> Replace `Vipranan/SQL-BUDDY` with any public GitHub repo (`owner/repo` format).

---

## 4. Use the Dashboard

- Select your loaded repo from the **sidebar dropdown**
- Click **+** in the sidebar to add more repos directly from the UI
- Navigate between **Overview**, **Contributors**, **Languages**, and **Leaderboard**
- Click any contributor row to see their detailed breakdown
- Toggle **dark/light mode** with the sun/moon icon (top-right)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No repos loaded" | Make sure the backend is running and you've loaded at least one repo |
| CORS errors in console | Ensure the backend includes your frontend port in CORS origins (`backend/app/main.py`) |
| Empty charts | The repo may have few commits — try a larger repo |
| GitHub rate limit | Add a `GITHUB_TOKEN` to `.env` (60 req/hr without → 5000 with) |
| Backend won't start | Check you're in the `py12` conda env and deps are installed |

---

## API at a Glance

```
POST   /repo/load              — Load a GitHub repo
GET    /repo/list              — List tracked repos
DELETE /repo/{id}              — Remove a tracked repo

GET    /stats/daily            — Daily commit counts
GET    /stats/weekly           — Weekly commit counts
GET    /stats/contributors     — Contributor stats
GET    /stats/languages        — Language distribution
GET    /stats/leaderboard      — Ranked leaderboard

All /stats endpoints accept: ?repo=owner/repo&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

Swagger docs: **http://localhost:8000/docs**
