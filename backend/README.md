# AI Urban Dengue Outbreak — Backend

## Required project-root files

Place these files relative to the repository root:

- `artifacts/dengue_final_models.joblib`
- `data/hackathon_preli_dataset.xlsx`

The Excel workbook must contain the sheet `bangladesh_dengue_large_dataset`.

## Install and run (VS Code PowerShell)

From the repository root:

```powershell
python -m pip install -r requirements.txt
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /`
- `GET /health`
- `GET /model-info`
- `POST /forecasts/2`, `/forecasts/3`, `/forecasts/4`
- `GET /wards/cities`
- `GET /wards`
- `GET /wards?city=Chattogram`
- `GET /wards/{city}/{ward_id}`
- `GET /analytics/summary`
- `GET /analytics/trends`
- `GET /analytics/cities`
- `GET /analytics/ward-ranking`

`POST /forecasts/{horizon}` accepts the 49 engineered features and reorders them using the exported model metadata.

The frontend-compatible `POST /api/predict` builds those features from each ward's observed history, then calls the selected H2, H3, or H4 model once. The returned case count is the model's horizon-specific output; it is not summed across weeks. Rolling features exclude the current observation (`shift(1)`), and calendar feature periods match the notebook (`52.1775` weeks/year).

Risk tiers use horizon-specific p50/p80/p95 values from training targets through 2023-12-25. H2 uncertainty is estimated from forest-tree predictions; H3/H4 intervals use residual quantiles from the 2024 validation split. H3 global permutation importance is recalculated on the held-out 2025 test data. These empirical intervals are not guaranteed calibrated, and per-ward attribution is not available from the artifact.

The weather UI displays only model inputs: 1-, 2- and 4-week lags, plus 4- and 8-week rolling means. The workbook contains five cities; API city IDs are normalized slugs. Map coordinates are approximate city-centred ward positions, not surveyed ward coordinates.

## Important scope

The API serves historical dataset analytics and trained-model inference. The current workbook ends 2025-12-29, so it cannot produce a current 2026 operational forecast without updated surveillance and weather data. Requests after the available data date are rejected rather than represented as current-data forecasts.

Only load Joblib files you trust. Joblib/pickle artifacts can execute code during deserialization.
