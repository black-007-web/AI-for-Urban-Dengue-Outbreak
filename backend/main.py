import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.config import APP_NAME, APP_VERSION, FRONTEND_ORIGINS, FRONTEND_ORIGIN_REGEX
from api.routes.health import router as health_router
from api.routes.forecast import router as forecast_router
from api.routes.wards import router as wards_router
from api.routes.analytics import router as analytics_router
from api.routes.compat import router as compat_router
from services.forecast_service import ForecastService

def _warm_diagnostics(service):
    import time
    import pandas as pd
    from core.config import SPLIT_DATES
    from services.ward_service import WardService
    started = time.time()
    try:
        from services.explain import _explainer
        for horizon in (2, 3, 4):  # building the 350-tree SHAP explainer takes ~15 s once
            _explainer(horizon, service.models[horizon])
        print(f"SHAP explainers ready in {time.time() - started:.1f}s")
        data = WardService().data
        start, end = (pd.Timestamp(d) for d in SPLIT_DATES["test"])
        for horizon in (3, 4):
            service.residual_quantiles(horizon, data)
        for horizon in (3, 2, 4):
            service.evaluation_series(horizon, data, start, end, "test")
        service.test_feature_importance(3, data)
        print(f"Diagnostics warmed in {time.time() - started:.1f}s")
    except Exception as exc:
        print(f"Diagnostics warm-up failed (will compute on demand): {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.startup_model_error = None
    try:
        service = ForecastService()
        service.get_model_info()
        app.state.forecast_service = service
        print("Dengue ML package loaded.")
    except Exception as exc:
        app.state.forecast_service = None
        app.state.startup_model_error = str(exc)
        print(f"MODEL NOT READY: {exc}")
    # Warm the dataset cache once so the first /api/health call is fast.
    try:
        from services.ward_service import WardService
        WardService()
        print("Dataset loaded.")
    except Exception as exc:
        print(f"DATASET NOT READY: {exc}")
    # Precompute one-off diagnostics (test residual intervals, test metrics,
    # importance) in the background so the first user request is fast.
    if app.state.forecast_service is not None:
        threading.Thread(target=_warm_diagnostics, args=(app.state.forecast_service,),
                         daemon=True).start()
    yield
    print("Dengue API stopped.")

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Multi-city Bangladesh dengue historical analytics and ML inference API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=FRONTEND_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(forecast_router)
app.include_router(wards_router)
app.include_router(analytics_router)
app.include_router(compat_router)

@app.get("/")
def root():
    return {
        "application": APP_NAME,
        "version": APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "endpoints": [
            "/health", "/model-info", "/forecasts/{horizon}",
            "/wards", "/wards/{ward_id}?city=...",
            "/analytics/summary", "/analytics/trends",
            "/analytics/cities", "/analytics/ward-ranking"
        ],
    }

@app.get("/model-info")
def model_info():
    service = getattr(app.state, "forecast_service", None)
    if service is None:
        raise HTTPException(
            status_code=503,
            detail=getattr(app.state, "startup_model_error", "Model service unavailable")
        )
    return service.get_model_info()
