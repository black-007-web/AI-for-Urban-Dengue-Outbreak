# DengueWatch: ward-level dengue early-warning dashboard

React 18 + Vite frontend for the **"AI for Urban Dengue Outbreak"** hackathon (Dhaka and Chattogram).
Public health officers see which wards need larvicide and fogging teams **2 to 4 weeks before** an outbreak peaks,
and exactly **why** each ward is flagged.

## Prerequisites
- Node.js 18 or newer

## Run it (two commands)
```bash
npm install
npm run dev
```
Open **http://localhost:5173**. With no backend running, the app switches to built-in demo data automatically and shows an amber
**"Demo data (backend offline)"** badge in the header. Demo data is never presented as a live prediction.

Other scripts: `npm run build` (production build), `npm run preview`, `npm run lint`.

## Connect to the backend
Copy `.env.example` to `.env` and edit:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI base URL |
| `VITE_USE_MOCK` | `false` | Set `true` to force the deterministic demo data |
| `VITE_DEFAULT_AS_OF` | `2025-12-29` | Latest date in the supplied surveillance workbook |

All endpoint paths live in one object, `ENDPOINTS` in `src/services/api.js`.

The live prediction endpoint uses the selected horizon's trained model once per ward and returns that horizon's predicted case count. The dashboard does not sum repeated H2/H3/H4 predictions or show uncalibrated confidence intervals. The supplied workbook ends on 2025-12-29; dates after that are rejected until newer surveillance/weather data is connected.

## API endpoints the frontend expects
| Method | Endpoint | Used for |
|---|---|---|
| GET | `/api/health` | Status and `model_version` (also the backend reachability probe) |
| GET | `/api/cities` | `[{id, name}]` |
| GET | `/api/wards?city=` | Ward list with coordinates and static features |
| GET | `/api/wards/geojson?city=` | Optional polygons; features need `properties.ward_id`. Circles are used if absent |
| POST | `/api/predict` | `{city \| ward_id, as_of_date, horizon_weeks, weather_override?}` returns `predictions[]` |
| GET | `/api/weather?ward_id=&city=&weeks=&as_of=` | `{series: [{week_start, rainfall_mm, avg_temp_C, relative_humidity_pct, rainfall_lag_1w..4w}]}` |
| GET | `/api/metrics` | See "Assumptions" below |
| GET | `/api/model/importance` | `[{feature, label, importance}]` |

### Assumptions to align with the backend team
- The dashboard always calls `/api/predict` with `city` (all wards at once) and picks the selected ward client-side.
- `risk_score` / `risk_tier` describe the **last** forecast week (the end of the horizon). `predicted_cases` and its CI cover the whole window.
- `drivers` may include every feature (the UI shows the top 7 by absolute contribution). Negative contributions are supported.
  The "breeding clock" reads `rainfall_lag_1w` to `rainfall_lag_4w` from `drivers`; it hides itself if they are missing.
- `/api/metrics` returns `{model_name, notes, split: {train|validation|test: {start, end}}, metrics: {mae, rmse, r2}, metrics_by_split?: {validation, test}, per_tier?: [{tier, precision, recall, support}], series: [{week_start, split?, actual, predicted}]}`.
- `/api/weather` also accepts an optional `as_of` (end of the series).
- Forecast weeks only carry `risk_score` and a CI, so their tier is derived from the thresholds in `src/config.js`.

## Caching and cost controls
- In-memory TTL cache (5 min) keyed by endpoint and params, mirrored to `sessionStorage` (`src/services/cache.js`).
- Identical in-flight requests share one promise and one network call.
- Stale requests are cancelled with `AbortController`; the network call is aborted only when every consumer has gone.
- Search boxes and sliders are debounced (400 ms). Predictions run when a main control changes or when **Run prediction** is pressed.
- Pages are lazy-loaded (`React.lazy` + `Suspense`); heavy charts are memoized.
- "Cached response" chips and a live savings panel on the About page make the effect visible.
- No API keys, no paid services, no LLM calls from the browser. Map tiles come from OpenStreetMap.

## Project layout
```
src/
  config.js        tiers, thresholds, actions, feature labels, settings
  services/        api.js (all HTTP) + cache.js
  mocks/           deterministic seeded demo data
  context/         shared dashboard state
  pages/           Dashboard, WeatherLags, ModelPerformance, About
  components/      ControlBar, WardMap, MapPanel, WardTable, WardDetail, RiskBadge ...
  charts/          DriverBarChart, ForecastBandChart, LagTimeline, WeatherChart, LagChart,
                   ActualVsPredicted, ResidualsChart, ImportanceChart, SplitTimeline
```

## Design notes
Glass surfaces, an animated aurora backdrop, spotlight cards, spring-animated controls and count-up numbers use
**Framer Motion** (the animation library behind Framer sites). No extra UI kit is installed. Motion respects `prefers-reduced-motion`.
Tiers are always shown with an icon and text as well as colour.

## Honesty about demo data
Everything under `src/mocks/` is generated from seeded hashes. Ward coordinates are approximate and no number is real epidemiology.

## AI assistant disclosure
Built with the help of Claude (Anthropic). Replace this line with the team's full disclosure; the same placeholder appears on the About page as `{{AI_DISCLOSURE}}`.
