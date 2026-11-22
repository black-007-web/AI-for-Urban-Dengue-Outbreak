from fastapi import APIRouter, Depends, Query, HTTPException
from api.deps import get_analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary")
def summary(service=Depends(get_analytics_service)):
    try:
        return service.summary()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))

@router.get("/trends")
def trends(city: str | None = None, ward_id: str | None = None,
           service=Depends(get_analytics_service)):
    try:
        return {"city": city or "All Cities", "ward_id": ward_id,
                "trends": service.trends(city, ward_id)}
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))

@router.get("/cities")
def cities(service=Depends(get_analytics_service)):
    try:
        return {"cities": service.city_summary()}
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))

@router.get("/ward-ranking")
def ward_ranking(city: str | None = Query(default=None),
                 service=Depends(get_analytics_service)):
    try:
        return {"ranking_type": "historical_total_cases",
                "warning": "Historical ranking, not a future outbreak-risk ranking.",
                "wards": service.ward_ranking(city)}
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))
