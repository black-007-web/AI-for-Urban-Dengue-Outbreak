import hashlib
import re
from datetime import timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from api.deps import get_forecast_service, get_ward_service
from core.config import SPLIT_DATES
from services.feature_engineering import build_forecast_features
from services.explain import describe_feature, explain_batch, method_label
from services.risk_calibration import classify_prediction, training_targets


router = APIRouter(tags=["Frontend Compatibility"])

# The dataset and model are static, so identical forecast requests always give
# the same answer. Cache them in memory (bounded, FIFO) to skip re-inference.
_PREDICT_CACHE: dict = {}
_PREDICT_CACHE_MAX = 256
CITY_CENTROIDS = {
    "chattogram": (22.3569, 91.7832),
    "dhaka-north": (23.8103, 90.4125),
    "dhaka-south": (23.7104, 90.4074),
    "gazipur": (23.9999, 90.4203),
    "narayanganj": (23.6238, 90.5000),
}


class FrontendPredictionRequest(BaseModel):
    city: str | None = None
    ward_id: str | None = None
    as_of_date: str
    horizon_weeks: int = 3
    weather_override: dict | None = None


def _city_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(name).strip().casefold()).strip("-")


def _matches_frontend_city(dataset_city: str, frontend_city: str | None) -> bool:
    if not frontend_city:
        return True
    wanted = _city_id(frontend_city)
    actual = _city_id(dataset_city)
    if wanted == "dhaka":
        return actual in {"dhaka-north", "dhaka-south"}
    return wanted == actual


def _coordinates(city: str, ward_id: str) -> tuple[float, float]:
    digest = int(hashlib.sha256(f"{city}:{ward_id}".encode()).hexdigest()[:8], 16)
    center_lat, center_lon = CITY_CENTROIDS.get(_city_id(city), CITY_CENTROIDS["dhaka-north"])
    lat = center_lat + ((digest % 1000) / 1000 - 0.5) * 0.035
    lon = center_lon + (((digest >> 10) % 1000) / 1000 - 0.5) * 0.035
    return round(lat, 6), round(lon, 6)


@router.get("/api/health")
def api_health(request: Request):
    model_loaded = getattr(request.app.state, "forecast_service", None) is not None
    from core.config import APP_NAME, DATASET_PATH, MODEL_PATH
    from api.deps import get_ward_service
    try:
        dataset = get_ward_service().data
        dataset_end_date = dataset.date.max().strftime("%Y-%m-%d")
        dataset_start_date = dataset.date.min().strftime("%Y-%m-%d")
        supported_dates = (
            dataset.sort_values("date").groupby(["city", "ward_id"], sort=False)
            .date.apply(lambda dates: dates.iloc[12] if len(dates) > 12 else pd.NaT)
            .dropna()
        )
        earliest_supported_as_of_date = supported_dates.max().strftime("%Y-%m-%d")
    except Exception:
        dataset_end_date = None
        dataset_start_date = None
        earliest_supported_as_of_date = None
    return {
        "status": "healthy" if model_loaded and DATASET_PATH.is_file() else "degraded",
        "application": APP_NAME,
        "model_version": "dengue-final-models-v1",
        "mock": False,
        "model_loaded": model_loaded,
        "model_file_exists": MODEL_PATH.is_file(),
        "dataset_file_exists": DATASET_PATH.is_file(),
        "dataset_start_date": dataset_start_date,
        "earliest_supported_as_of_date": earliest_supported_as_of_date,
        "dataset_end_date": dataset_end_date,
        "live_operational_data": False,
        "notice": "Predictions are based on the exported historical dataset; no live 2026 surveillance feed is connected.",
    }


@router.get("/api/cities")
def api_cities(ward_service=Depends(get_ward_service)):
    return [
        {"id": _city_id(name), "name": name}
        for name in ward_service.cities()
    ]


@router.get("/api/wards")
def api_wards(city: str | None = None, ward_service=Depends(get_ward_service)):
    df = ward_service.data[
        ward_service.data.city.map(lambda value: _matches_frontend_city(value, city))
    ]
    grouped = (df.groupby(["city", "ward_id"])
               .agg(records=("date", "count"),
                    latest_date=("date", "max"),
                    total_cases=("dengue_cases", "sum"))
               .reset_index())
    wards = []
    for row in grouped.itertuples(index=False):
        df = ward_service.get_ward(row.city, row.ward_id)
        latest = df.iloc[-1]
        lat, lon = _coordinates(row.city, row.ward_id)
        wards.append({
            "ward_id": str(row.ward_id),
            "ward_name": str(row.ward_id),
            "city": str(row.city),
            "lat": lat,
            "lon": lon,
            "coordinates_approximate": True,
            "population_density_sqkm": float(latest.population_density_sqkm),
            "sanitation_score": float(latest.sanitation_score),
            "water_logging_risk_index": float(latest.water_logging_risk_index),
            "records": int(row.records),
            "total_cases": int(row.total_cases),
            "latest_date": row.latest_date.strftime("%Y-%m-%d"),
        })
    return wards


@router.post("/api/predict")
def api_predict(request: FrontendPredictionRequest,
                forecast_service=Depends(get_forecast_service),
                ward_service=Depends(get_ward_service)):
    horizon = int(request.horizon_weeks)
    if horizon not in (2, 3, 4):
        raise HTTPException(400, detail="horizon_weeks must be 2, 3, or 4")
    if request.weather_override is not None:
        raise HTTPException(
            422,
            detail="Weather overrides are not supported by the trained inference pipeline.",
        )
    city = request.city
    filtered = ward_service.data[
        ward_service.data.city.map(lambda value: _matches_frontend_city(value, city))
    ]
    wards = (filtered.groupby(["city", "ward_id"], as_index=False)
             .agg(records=("date", "count"),
                  latest_date=("date", "max"),
                  total_cases=("dengue_cases", "sum")))
    if request.ward_id:
        wards = wards[wards.ward_id == str(request.ward_id)]
    if wards.empty:
        raise HTTPException(404, detail="Ward not found")

    try:
        as_of_date = pd.Timestamp(request.as_of_date)
    except Exception:
        raise HTTPException(422, detail="as_of_date must be YYYY-MM-DD")
    dataset_end = ward_service.data.date.max()
    if as_of_date > dataset_end:
        raise HTTPException(
            422,
            detail={
                "error": "as_of_date is beyond the available surveillance data",
                "dataset_end_date": dataset_end.strftime("%Y-%m-%d"),
            },
        )
    supported_dates = (
        ward_service.data.sort_values("date").groupby(["city", "ward_id"], sort=False)
        .date.apply(lambda dates: dates.iloc[12] if len(dates) > 12 else pd.NaT)
        .dropna()
    )
    earliest_supported = supported_dates.max()
    if as_of_date < earliest_supported:
        raise HTTPException(
            422,
            detail={
                "error": "as_of_date does not provide the history required by the trained features",
                "earliest_supported_as_of_date": earliest_supported.strftime("%Y-%m-%d"),
            },
        )
    if request.as_of_date != as_of_date.strftime("%Y-%m-%d"):
        raise HTTPException(422, detail="as_of_date must use YYYY-MM-DD format")

    predictions = []
    forecast_dates = []
    targets = training_targets(ward_service.data, horizon)
    tier_thresholds = {
        "p60": float(np.quantile(targets, 0.60)),
        "p80": float(np.quantile(targets, 0.80)),
        "p95": float(np.quantile(targets, 0.95)),
    }
    cache_key = (request.city or "", request.ward_id or "", request.as_of_date, horizon)
    cached = _PREDICT_CACHE.get(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    rows = []
    for row in wards.itertuples(index=False):
        ward_df = ward_service.get_ward(row.city, row.ward_id)
        source_date = ward_df.loc[ward_df.date <= as_of_date, "date"].max()
        if pd.isna(source_date):
            raise HTTPException(
                422,
                detail=f"No observations for ward {row.ward_id} on or before {request.as_of_date}",
            )
        features = build_forecast_features(
            ward_df,
            pd.Timestamp(source_date),
            horizon,
            forecast_service.feature_map[horizon],
        )
        rows.append((row, source_date, features))

    # One SHAP pass for every ward in the request (much faster than per row).
    feature_names = forecast_service.feature_map[horizon]
    batch = pd.DataFrame([[f[n] for n in feature_names] for _, _, f in rows], columns=feature_names)
    try:
        all_drivers = explain_batch(horizon, forecast_service.models[horizon], batch)
    except Exception as exc:  # never fail a forecast because attribution failed
        print(f"Driver attribution unavailable: {exc}")
        all_drivers = [[] for _ in rows]

    batch_predictions = forecast_service.predict_batch(horizon, batch)
    lowers, uppers, interval_method = forecast_service.prediction_intervals_batch(
        horizon, batch, batch_predictions, ward_service.data
    )
    for index, ((row, source_date, features), drivers) in enumerate(zip(rows, all_drivers)):
        predicted_cases = float(batch_predictions[index])
        interval = {
            "lower": float(lowers[index]),
            "upper": float(uppers[index]),
            "method": interval_method,
        }
        forecast_date = pd.Timestamp(source_date) + timedelta(weeks=horizon)
        forecast_dates.append(forecast_date)
        classification = classify_prediction(predicted_cases, targets)
        score = classification["risk_score"]
        forecast = [{
            "week_start": forecast_date.strftime("%Y-%m-%d"),
            "predicted_cases": predicted_cases,
            "risk_score": round(score, 3),
            "risk_tier": classification["risk_tier"],
            "ci_lower": interval["lower"],
            "ci_upper": interval["upper"],
            "interval_method": interval["method"],
        }]
        predictions.append({
            "ward_id": str(row.ward_id),
            "ward_name": str(row.ward_id),
            "horizon_weeks": horizon,
            "risk_score": round(score, 3),
            "risk_score_type": "empirical percentile rank against training targets; not an ML probability",
            "risk_tier": classification["risk_tier"],
            "predicted_cases": predicted_cases,
            "ci_lower": interval["lower"],
            "ci_upper": interval["upper"],
            "interval_method": interval["method"],
            "drivers": drivers,
            "city": str(row.city),
            "forecast": forecast,
        })
    predictions.sort(key=lambda item: item["risk_score"], reverse=True)
    response = {
        "as_of_date": request.as_of_date,
        "data_as_of_date": as_of_date.strftime("%Y-%m-%d"),
        "horizon_weeks": horizon,
        "forecast_date": max(forecast_dates).strftime("%Y-%m-%d"),
        "model_version": "dengue-final-models-v1",
        "prediction_type": "horizon-specific model output; one prediction per ward",
        "risk_thresholds": {
            "units": "predicted dengue cases",
            "training_percentiles": tier_thresholds,
            "tier_rules": {
                "Low": f"< p60 ({tier_thresholds['p60']:.3g})",
                "Medium": f">= p60 and <= p80 ({tier_thresholds['p80']:.3g})",
                "High": f"> p80 and <= p95 ({tier_thresholds['p95']:.3g})",
                "Critical": f"> p95 ({tier_thresholds['p95']:.3g})",
            },
        },
        "interval_level": 0.95,
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "predictions": predictions,
        "driver_method": method_label(forecast_service.models[horizon]),
        "cached": False,
    }
    if len(_PREDICT_CACHE) >= _PREDICT_CACHE_MAX:
        _PREDICT_CACHE.pop(next(iter(_PREDICT_CACHE)))
    _PREDICT_CACHE[cache_key] = response
    return response


@router.get("/api/wards/geojson")
def api_geojson(city: str | None = None, ward_service=Depends(get_ward_service)):
    df = ward_service.data[
        ward_service.data.city.map(lambda value: _matches_frontend_city(value, city))
    ]
    wards = (df.groupby(["city", "ward_id"], as_index=False)
             .agg(records=("date", "count"),
                  latest_date=("date", "max"),
                  total_cases=("dengue_cases", "sum")))
    features = []
    for row in wards.itertuples(index=False):
        lat, lon = _coordinates(row.city, row.ward_id)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"ward_id": str(row.ward_id), "ward_name": str(row.ward_id)},
        })
    return {"type": "FeatureCollection", "features": features}


@router.get("/api/weather")
def api_weather(ward_id: str | None = None, city: str | None = None,
                weeks: int = 52, as_of: str | None = None,
                ward_service=Depends(get_ward_service)):
    if ward_id:
        df = ward_service.data[ward_service.data.ward_id == str(ward_id)]
        if city:
            df = df[df.city.map(lambda value: _matches_frontend_city(value, city))]
    else:
        df = ward_service.data
        if city:
            df = df[df.city.map(lambda value: _matches_frontend_city(value, city))]
    if df.empty:
        raise HTTPException(404, detail="Ward or city not found")
    try:
        end = pd.Timestamp(as_of) if as_of else df.date.max()
    except Exception:
        raise HTTPException(422, detail="as_of must be YYYY-MM-DD")
    df = df[df.date <= end].sort_values("date")
    if not ward_id:
        df = df.groupby("date", as_index=False).agg({
            "rainfall_mm": "mean",
            "avg_temp_c": "mean",
            "relative_humidity_pct": "mean",
        })
    df = df.sort_values("date").copy()
    for lag in (1, 2, 4):
        df[f"rainfall_lag_{lag}w"] = df.rainfall_mm.shift(lag)
    for window in (4, 8):
        df[f"rainfall_rolling_mean_{window}w"] = (
            df.rainfall_mm.shift(1).rolling(window).mean()
        )
    df = df.tail(max(1, weeks)).copy()
    series = []
    for row in df.itertuples(index=False):
        series.append({
            "week_start": row.date.strftime("%Y-%m-%d"),
            "rainfall_mm": round(float(row.rainfall_mm), 1),
            "avg_temp_C": round(float(row.avg_temp_c), 1),
            "relative_humidity_pct": round(float(row.relative_humidity_pct), 1),
            "rainfall_lag_1w": round(float(row.rainfall_lag_1w), 1) if pd.notna(row.rainfall_lag_1w) else None,
            "rainfall_lag_2w": round(float(row.rainfall_lag_2w), 1) if pd.notna(row.rainfall_lag_2w) else None,
            "rainfall_lag_4w": round(float(row.rainfall_lag_4w), 1) if pd.notna(row.rainfall_lag_4w) else None,
            "rainfall_rolling_mean_4w": round(float(row.rainfall_rolling_mean_4w), 1) if pd.notna(row.rainfall_rolling_mean_4w) else None,
            "rainfall_rolling_mean_8w": round(float(row.rainfall_rolling_mean_8w), 1) if pd.notna(row.rainfall_rolling_mean_8w) else None,
        })
    return {"ward_id": ward_id, "city": city, "series": series}


@router.get("/api/metrics")
def api_metrics(request: Request, horizon: int = Query(3, ge=2, le=4),
                ward_service=Depends(get_ward_service)):
    service = getattr(request.app.state, "forecast_service", None)
    if service is None:
        raise HTTPException(503, detail="Model service unavailable")
    metadata = service.package.get("model_metadata", {})
    item = metadata.get(horizon, metadata.get(str(horizon), {})) or {}
    split = {name: {"start": start, "end": end} for name, (start, end) in SPLIT_DATES.items()}

    test_start, test_end = (pd.Timestamp(d) for d in SPLIT_DATES["test"])
    evaluation = service.evaluation_series(horizon, ward_service.data, test_start, test_end, "test")
    test_scores = evaluation["metrics"] or {
        "mae": round(float(item.get("test_mae", 0)), 3),
        "rmse": round(float(item.get("test_rmse", 0)), 3),
        "r2": None,
    }

    def _get(key):
        value = item.get(key)
        return round(float(value), 3) if value is not None else None

    by_horizon = {}
    for h, meta in metadata.items():
        by_horizon[f"H{h}"] = {
            "model": service._model_name(int(h)),
            "validation_mae": round(float(meta.get("validation_mae", 0)), 3),
            "validation_rmse": round(float(meta.get("validation_rmse", 0)), 3),
            "test_mae": round(float(meta.get("test_mae", 0)), 3),
            "test_rmse": round(float(meta.get("test_rmse", 0)), 3),
        }
    return {
        "model_name": f"H{horizon}: {service._model_name(horizon)}",
        "horizon": horizon,
        "notes": (
            "Chronological split: train on the earliest 70% of weeks, select the model on the next 15% "
            "(validation), report on the final 15% (test). Models were refit on train+validation before "
            "the test evaluation, so test weeks are never seen in training. Chart shows weekly totals "
            "summed over all 60 wards; scores are per ward-week."
        ),
        "split": split,
        "metrics": test_scores,
        "metrics_by_split": {
            "validation": {"mae": _get("validation_mae"), "rmse": _get("validation_rmse"), "r2": None},
            "test": test_scores,
        },
        "metrics_by_horizon": by_horizon,
        "per_tier": [],
        "series": evaluation["series"],
    }


_CALENDAR_LABELS = {
    "year": "Year (as-of week)",
    "month_sin": "Month of year (as-of, sin)", "month_cos": "Month of year (as-of, cos)",
    "week_sin": "Week of year (as-of, sin)", "week_cos": "Week of year (as-of, cos)",
}


def _importance_label(feature: str) -> str:
    if feature in _CALENDAR_LABELS:
        return _CALENDAR_LABELS[feature]
    if feature.startswith("target_"):
        part = feature.split("_")[1]
        kind = {"year": "Year", "month": "Month of year", "week": "Week of year"}.get(part, part)
        trig = " (sin)" if "_sin_" in feature else " (cos)" if "_cos_" in feature else ""
        return f"{kind} of forecast week{trig}"
    return describe_feature(feature)["label"]


@router.get("/api/model/importance")
def api_importance(request: Request, ward_service=Depends(get_ward_service)):
    service = getattr(request.app.state, "forecast_service", None)
    if service is None:
        raise HTTPException(503, detail="Model service unavailable")
    result = service.test_feature_importance(3, ward_service.data)
    items = sorted(result["items"], key=lambda item: item["importance"], reverse=True)[:20]
    return {
        "horizon": 3,
        "split": "held-out test",
        "method": "permutation importance measured as normalized nonnegative MAE increase",
        "sample_count": result["sample_count"],
        "items": [
            {
                "feature": item["feature"],
                "label": _importance_label(item["feature"]),
                "importance": round(item["importance"], 6),
            }
            for item in items
        ],
    }
