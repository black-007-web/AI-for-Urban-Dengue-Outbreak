"""Per-ward driver breakdown using SHAP TreeExplainer.

Contributions are in units of predicted dengue cases: positive values push the
forecast up, negative values pull it down, and contributions plus the model's
base value sum to the prediction.
"""
import re
from threading import Lock

import numpy as np
import pandas as pd

_EXPLAINERS = {}
_LOCK = Lock()

_WEATHER = {
    "rainfall_mm": ("Rainfall", "mm", "rainfall"),
    "avg_temp_c": ("Average temperature", "°C", "average temperature"),
    "max_temp_c": ("Maximum temperature", "°C", "maximum temperature"),
    "min_temp_c": ("Minimum temperature", "°C", "minimum temperature"),
    "relative_humidity_pct": ("Relative humidity", "%", "humidity"),
}
_STATIC = {
    "population_density_sqkm": ("Population density", "/km²", "crowded housing"),
    "water_logging_risk_index": ("Water-logging risk", "", "poor drainage"),
    "sanitation_score": ("Sanitation score", "", "sanitation conditions"),
}


def _weeks(n: int) -> str:
    return "1 week ago" if n == 1 else f"{n} weeks ago"


def describe_feature(name: str) -> dict:
    """Map a model feature to a frontend key, a plain-English label and a unit."""
    if name in _STATIC:
        label, unit, phrase = _STATIC[name]
        return {"feature": name, "label": label, "unit": unit, "phrase": phrase, "group": "ward"}

    m = re.fullmatch(r"dengue_lag_(\d+)", name)
    if m:
        n = int(m.group(1))
        return {"feature": name, "label": f"Dengue cases {_weeks(n)}", "unit": "cases",
                "phrase": f"cases {_weeks(n)}", "group": "history"}
    m = re.fullmatch(r"dengue_rolling_(mean|max)_(\d+)", name)
    if m:
        kind = "average" if m.group(1) == "mean" else "peak"
        return {"feature": name, "label": f"Dengue cases, {m.group(2)}-week {kind}", "unit": "cases",
                "phrase": f"recent case {kind}", "group": "history"}

    for col, (label, unit, phrase) in _WEATHER.items():
        m = re.fullmatch(rf"{col}_lag_(\d+)", name)
        if m:
            n = int(m.group(1))
            key = f"rainfall_lag_{n}w" if col == "rainfall_mm" else name
            return {"feature": key, "label": f"{label} {_weeks(n)}", "unit": unit,
                    "phrase": f"{phrase} {_weeks(n)}", "group": "weather"}
        m = re.fullmatch(rf"{col}_rolling_mean_(\d+)", name)
        if m:
            n = int(m.group(1))
            key = f"rainfall_rolling_mean_{n}w" if col == "rainfall_mm" else name
            return {"feature": key, "label": f"{label}, {n}-week mean", "unit": unit,
                    "phrase": f"{phrase} over the past {n} weeks", "group": "weather"}

    if name.startswith("target_") or name in {"year", "month_sin", "month_cos", "week_sin", "week_cos"}:
        is_target = name.startswith("target_")
        return {"feature": name,
                "label": "Season of the forecast week" if is_target else "Season of the as-of week",
                "unit": "", "phrase": "seasonal timing", "group": "calendar"}

    return {"feature": name, "label": name.replace("_", " "), "unit": "", "phrase": name, "group": "other"}


def _explainer(horizon: int, model):
    with _LOCK:
        if horizon not in _EXPLAINERS:
            import shap  # imported lazily: only needed when drivers are requested
            _EXPLAINERS[horizon] = shap.TreeExplainer(model)
        return _EXPLAINERS[horizon]


def explain_batch(horizon: int, model, frame: pd.DataFrame, top_n: int = 8) -> list[list[dict]]:
    """Return driver lists (one per row of `frame`) sorted by absolute contribution.

    Calendar features are merged into one "season" driver so the chart shows
    actionable drivers rather than sin/cos encodings. Rainfall lag inputs are
    always included so the dashboard's lag timeline can render.
    """
    explainer = _explainer(horizon, model)
    values = np.asarray(explainer.shap_values(
        frame, check_additivity=False, approximate=uses_approximation(model)
    ))
    if values.ndim == 1:
        values = values.reshape(1, -1)

    results = []
    for row_idx in range(len(frame)):
        season_total = 0.0
        drivers = []
        for col_idx, name in enumerate(frame.columns):
            contribution = float(values[row_idx, col_idx])
            meta = describe_feature(name)
            if meta["group"] == "calendar":
                season_total += contribution
                continue
            drivers.append({
                "feature": meta["feature"],
                "label": meta["label"],
                "unit": meta["unit"],
                "phrase": meta["phrase"],
                "group": meta["group"],
                "value": round(float(frame.iat[row_idx, col_idx]), 3),
                "contribution": round(contribution, 4),
            })
        drivers.append({
            "feature": "season", "label": "Seasonal timing", "unit": "", "phrase": "the time of year",
            "group": "calendar", "value": None, "contribution": round(season_total, 4),
        })
        drivers.sort(key=lambda d: abs(d["contribution"]), reverse=True)
        top = drivers[:top_n]
        keep = {d["feature"] for d in top}
        top += [d for d in drivers if d["feature"].startswith("rainfall_lag_") and d["feature"] not in keep]
        results.append(top)
    return results


def uses_approximation(model) -> bool:
    """Exact TreeSHAP on the deep 350-tree H2 forest costs ~0.5 s per ward, so the
    forest uses the fast path-based (Saabas) approximation; boosting models are exact."""
    return type(model).__name__ == "RandomForestRegressor"


def method_label(model) -> str:
    if uses_approximation(model):
        return "Tree path attribution (SHAP approximate / Saabas); contribution = change in predicted cases"
    return "SHAP TreeExplainer (exact); contribution = change in predicted cases vs the model's average"


def base_value(horizon: int, model) -> float:
    value = np.ravel(_explainer(horizon, model).expected_value)[0]
    return float(value)
