import numpy as np
import pandas as pd

from core.config import SPLIT_DATES

TRAIN_END = pd.Timestamp(SPLIT_DATES["train"][1])
# 58% of training ward-weeks have zero cases, so p50 is 0 and would make
# "Low" unreachable. Low is therefore "below p60" (under ~1 expected case).
RISK_PERCENTILES = (0.60, 0.80, 0.95)


def training_targets(data: pd.DataFrame, horizon: int) -> np.ndarray:
    keys = [column for column in ("city", "ward_id") if column in data.columns]
    ordered = data.sort_values([*keys, "date"]).copy()
    ordered["_target"] = ordered.groupby(keys, sort=False)["dengue_cases"].shift(-horizon)
    targets = ordered.loc[ordered.date <= TRAIN_END, "_target"].dropna().to_numpy(dtype=float)
    if not len(targets) or not np.isfinite(targets).all():
        raise ValueError(f"No finite H{horizon} training targets are available for risk calibration")
    return np.sort(targets)


def classify_prediction(predicted_cases: float, targets: np.ndarray) -> dict:
    q60, q80, q95 = np.quantile(targets, RISK_PERCENTILES)
    if predicted_cases < q60:
        tier = "Low"
    elif predicted_cases <= q80:
        tier = "Medium"
    elif predicted_cases <= q95:
        tier = "High"
    else:
        tier = "Critical"

    percentile_rank = np.searchsorted(targets, predicted_cases, side="left") / len(targets)
    return {
        "risk_tier": tier,
        "risk_score": float(percentile_rank),
        "thresholds": {
            "p60": float(q60),
            "p80": float(q80),
            "p95": float(q95),
        },
    }
