from fastapi import APIRouter, Request
from core.config import APP_NAME, APP_VERSION, MODEL_PATH, DATASET_PATH

router = APIRouter(tags=["Health"])

@router.get("/health")
def health(request: Request):
    model_loaded = getattr(request.app.state, "forecast_service", None) is not None
    dataset_exists = DATASET_PATH.is_file()
    return {
        "status": "healthy" if model_loaded and dataset_exists else "degraded",
        "application": APP_NAME,
        "version": APP_VERSION,
        "model_file_exists": MODEL_PATH.is_file(),
        "model_loaded": model_loaded,
        "dataset_file_exists": dataset_exists,
        "model_error": getattr(request.app.state, "startup_model_error", None),
    }
