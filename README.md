# Dengue Early-Warning Dashboard (Dhaka, Chattogram, Gazipur, Narayanganj)

Forecasts ward-level dengue cases **2, 3 and 4 weeks ahead** from lagged weather, case history and ward vulnerability. It assigns each ward a **Low / Medium / High / Critical** risk tier and shows which factors drive the forecast, so health officers can send larvicide and fogging teams to the right wards before an outbreak peaks.

- **Backend:** FastAPI + scikit-learn (Random Forest for H2, HistGradientBoosting for H3/H4), SHAP drivers
- **Frontend:** React + Vite, Leaflet ward map, Recharts
- **Design, split and model rationale:** see [ARCHITECTURE.md](ARCHITECTURE.md)

## Run locally (about 2 minutes)

Prerequisites: **Python 3.12** and **Node 18+**.

**Terminal 1: backend**
```bash
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd backend
uvicorn main:app --port 8000
```
Check it at http://127.0.0.1:8000/api/health (expect `"status": "healthy"`). API docs are at http://127.0.0.1:8000/docs.

**Terminal 2: frontend**
```bash
cd frontend
cp .env.example .env               # Windows: copy .env.example .env
npm install
npm run dev
```
Open http://localhost:5173.

The repo already contains the dataset (`data/hackathon_preli_dataset.xlsx`) and the trained models (`artifacts/dengue_final_models.joblib`). Nothing else needs downloading.

## Demo flow

1. Dashboard opens on **2025-08-04** (monsoon peak). The map and table rank all 60 wards by risk.
2. Click a ward. You see its tier, the predicted cases with a 95% interval, and the **driver breakdown** (SHAP: how many cases each factor adds or removes).
3. Switch the horizon between 2, 3 and 4 weeks, or move the as-of date. Every change runs a real model inference.
4. **Weather & lags** shows the raw weather and the 1-, 2- and 4-week rainfall lags the model uses.
5. **Model performance** shows the chronological split and test MAE / RMSE / R², plus actual-vs-predicted and error-by-week on the unseen test period.

## Project layout

```
backend/        FastAPI app (routes, feature engineering, inference, SHAP)
frontend/       React dashboard
data/           hackathon dataset (xlsx)
artifacts/      trained models (joblib)
notebooks/      training notebook (EDA → features → split → models → export)
ARCHITECTURE.md data flow, split, model selection, cost controls
```

## API (used by the frontend)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Model and dataset status, supported date range |
| GET | `/api/cities` | The 5 city corporations |
| GET | `/api/wards?city=` | Wards with vulnerability features and approximate coordinates |
| POST | `/api/predict` | `{city?, ward_id?, as_of_date, horizon_weeks}` → tier, cases, 95% interval, drivers |
| GET | `/api/weather?ward_id=&weeks=&as_of=` | Weather history with computed rainfall lags |
| GET | `/api/metrics?horizon=` | Chronological split, test MAE/RMSE/R², actual vs predicted |
| GET | `/api/model/importance` | Permutation importance on the test window |

## Deploy

**Backend → Railway**
1. Create a new project from this GitHub repo. `railway.json` at the repo root sets the start command and health check, and `.python-version` pins Python 3.12.
2. Set the variables `FRONTEND_ORIGINS=https://<your-app>.vercel.app` and, optionally, `FRONTEND_ORIGIN_REGEX=https://.*\.vercel\.app` so preview deployments also work.
3. Under Settings → Networking, generate a public domain, then open `https://<railway-domain>/api/health`.

**Frontend → Vercel**
1. Import the same repo and set **Root Directory = `frontend`**. Vercel detects Vite, and `frontend/vercel.json` handles page refreshes on sub-routes.
2. Set the environment variable `VITE_API_BASE_URL=https://<railway-domain>` (no trailing slash), then deploy.

If the backend can't be reached, the dashboard switches to clearly labelled demo data ("Demo data (backend offline)"). It never shows demo data as a real forecast.

## Cost controls (summary)

The model is loaded once from joblib, and all wards are predicted and explained in one batch. Responses are cached on the server and in the browser (5-minute TTL, shared in-flight requests, aborted stale requests, debounced inputs). No paid APIs or LLM calls are made at runtime. Details are in [ARCHITECTURE.md §5](ARCHITECTURE.md#5-compute-and-cost-efficiency).

## AI assistants and external services disclosure

| Tool / service | Used for |
|---|---|
| Claude Code (Anthropic) | Code review, backend SHAP drivers, deployment configs, documentation |
| _TODO: list every other AI assistant the team used (e.g. ChatGPT, GitHub Copilot, Gemini) and what for_ | |
| OpenStreetMap tiles | Base map in the frontend (free, no key) |
| Google Fonts | Web fonts in the frontend |

No external APIs are called by the backend. No LLM is called at runtime.

## Live deployment

- Backend (Railway): https://ai-for-urban-dengue-outbreak-production.up.railway.app (health: `/api/health`, docs: `/docs`)
- Frontend (Vercel): import this repo with Root Directory `frontend`; `frontend/.env.production` already points the build at the Railway backend, so no environment variables are required.

Until then, run locally with the two commands above; the video demo uses localhost.

### Data and open-source libraries

- Dataset: hackathon-provided `hackathon_preli_dataset.xlsx` (2016–2025, 60 wards, 5 cities).
- Libraries: scikit-learn, pandas, NumPy, SHAP, FastAPI, React, Vite, Recharts, Leaflet, Tailwind CSS.
