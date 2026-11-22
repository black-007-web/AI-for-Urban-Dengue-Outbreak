from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from api.deps import get_ward_service

router = APIRouter(prefix="/wards", tags=["Wards"])

@router.get("/cities")
def list_cities(service=Depends(get_ward_service)):
    return {"cities": service.cities()}

@router.get("")
def list_wards(city: str | None = Query(default=None), service=Depends(get_ward_service)):
    try:
        df = service.get_all_wards(city)
        items = [{
            "city": str(r.city),
            "ward_id": str(r.ward_id),
            "records": int(r.records),
            "total_cases": int(r.total_cases),
            "latest_date": r.latest_date.strftime("%Y-%m-%d"),
        } for r in df.itertuples(index=False)]
        return {"total": len(items), "wards": items}
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))

@router.get("/{city}/{ward_id}")
def ward_by_city(city: str, ward_id: str, service=Depends(get_ward_service)):
    df = service.get_ward(city, ward_id)
    if df.empty:
        raise HTTPException(404, detail="Ward not found for this city")
    return {
        "city": city,
        "ward_id": str(ward_id),
        "records": len(df),
        "latest_date": df.date.max().strftime("%Y-%m-%d"),
        "history": jsonable_encoder(df.sort_values("date").to_dict(orient="records")),
    }

@router.get("/{ward_id}")
def ward_by_id(ward_id: str, city: str | None = Query(default=None), service=Depends(get_ward_service)):
    df = service.data[service.data.ward_id == str(ward_id)]
    if city:
        df = df[df.city.str.casefold() == city.casefold()]
    elif df.city.nunique() > 1:
        raise HTTPException(409, detail="Ward ID occurs in multiple cities; provide ?city=...")
    if df.empty:
        raise HTTPException(404, detail="Ward not found")
    city_name = str(df.city.iloc[0])
    return {
        "city": city_name,
        "ward_id": str(ward_id),
        "records": len(df),
        "latest_date": df.date.max().strftime("%Y-%m-%d"),
        "history": jsonable_encoder(df.sort_values("date").to_dict(orient="records")),
    }
