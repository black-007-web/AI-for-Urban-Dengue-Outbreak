from fastapi import Request, HTTPException
from services.forecast_service import ForecastService
from services.ward_service import WardService
from services.analytics_service import AnalyticsService

def get_forecast_service(request: Request) -> ForecastService:
    service = getattr(request.app.state, "forecast_service", None)
    if service is None:
        detail = getattr(request.app.state, "startup_model_error", None)
        raise HTTPException(status_code=503, detail=detail or "Model service unavailable")
    return service

def get_ward_service() -> WardService:
    try:
        return WardService()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Dataset service unavailable: {exc}")

def get_analytics_service() -> AnalyticsService:
    try:
        return AnalyticsService()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Analytics service unavailable: {exc}")
