import math
from datetime import timedelta

import pandas as pd


WEEK_PERIOD = 52.1775


def build_forecast_features(ward_data: pd.DataFrame, as_of_date: pd.Timestamp,
                            horizon: int, feature_names: list[str]) -> dict[str, float]:
    history = ward_data.loc[ward_data["date"] <= as_of_date].sort_values("date")
    if history.empty:
        raise ValueError(f"No observations exist on or before {as_of_date:%Y-%m-%d}")

    observation_date = pd.Timestamp(history.iloc[-1]["date"])
    row_index = len(history) - 1
    target_date = observation_date + timedelta(weeks=horizon)
    values: dict[str, float] = {}

    def series_value(column: str, offset: int) -> float:
        index = row_index - offset
        if index < 0:
            raise ValueError(f"Insufficient history for {column} lag {offset}")
        return float(history.iloc[index][column])

    def rolling_value(column: str, window: int, operation: str) -> float:
        start = row_index - window
        if start < 0:
            raise ValueError(f"Insufficient history for {column} rolling window {window}")
        samples = pd.to_numeric(history.iloc[start:row_index][column], errors="coerce")
        if len(samples) != window or not samples.notna().all():
            raise ValueError(f"Invalid historical values for {column} rolling window {window}")
        if operation == "mean":
            return float(samples.mean())
        return float(samples.max())

    for lag in (1, 2, 3, 4, 8, 12):
        values[f"dengue_lag_{lag}"] = series_value("dengue_cases", lag)
    for window in (2, 4, 8):
        values[f"dengue_rolling_mean_{window}"] = rolling_value(
            "dengue_cases", window, "mean"
        )
    for window in (4, 8):
        values[f"dengue_rolling_max_{window}"] = rolling_value(
            "dengue_cases", window, "max"
        )

    weather_columns = (
        "avg_temp_c",
        "max_temp_c",
        "min_temp_c",
        "rainfall_mm",
        "relative_humidity_pct",
    )
    for column in weather_columns:
        for lag in (1, 2, 4):
            values[f"{column}_lag_{lag}"] = series_value(column, lag)
        for window in (4, 8):
            values[f"{column}_rolling_mean_{window}"] = rolling_value(
                column, window, "mean"
            )

    latest = history.iloc[row_index]
    for column in (
        "population_density_sqkm",
        "water_logging_risk_index",
        "sanitation_score",
    ):
        values[column] = float(latest[column])

    observation_week = int(observation_date.isocalendar().week)
    values.update({
        "year": float(observation_date.year),
        "month_sin": math.sin(2 * math.pi * observation_date.month / 12),
        "month_cos": math.cos(2 * math.pi * observation_date.month / 12),
        "week_sin": math.sin(2 * math.pi * observation_week / WEEK_PERIOD),
        "week_cos": math.cos(2 * math.pi * observation_week / WEEK_PERIOD),
    })

    target_week = int(target_date.isocalendar().week)
    values.update({
        f"target_year_h{horizon}": float(target_date.year),
        f"target_month_sin_h{horizon}": math.sin(2 * math.pi * target_date.month / 12),
        f"target_month_cos_h{horizon}": math.cos(2 * math.pi * target_date.month / 12),
        f"target_week_sin_h{horizon}": math.sin(2 * math.pi * target_week / WEEK_PERIOD),
        f"target_week_cos_h{horizon}": math.cos(2 * math.pi * target_week / WEEK_PERIOD),
    })

    missing = [name for name in feature_names if name not in values]
    unexpected = [name for name in values if name not in feature_names]
    if missing or unexpected:
        raise ValueError({
            "missing_engineered_features": missing,
            "unexpected_engineered_features": unexpected,
        })

    ordered = {name: float(values[name]) for name in feature_names}
    invalid = [name for name, value in ordered.items() if not math.isfinite(value)]
    if invalid:
        raise ValueError(f"Non-finite engineered features: {invalid}")
    return ordered
