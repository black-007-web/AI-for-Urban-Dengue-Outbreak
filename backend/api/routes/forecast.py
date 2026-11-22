from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_forecast_service
from schemas.forecast import ForecastRequest, ForecastResponse
from core.config import SUPPORTED_HORIZONS

router = APIRouter(tags=["Forecasts"])

@router.post("/forecasts/{horizon}", response_model=ForecastResponse)
@router.post("/predict/{horizon}", response_model=ForecastResponse, include_in_schema=False)
def predict(horizon: int, request: ForecastRequest, service=Depends(get_forecast_service)):
    if horizon not in SUPPORTED_HORIZONS:
        raise HTTPException(400, detail={"supported_horizons": list(SUPPORTED_HORIZONS)})
    try:
        return service.predict(horizon, request.features)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(500, detail=f"Prediction failed: {exc}")
