import math
from functools import lru_cache
from threading import Lock

import joblib
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

from core.config import MODEL_PATH, SPLIT_DATES, SUPPORTED_HORIZONS
from services.feature_engineering import build_forecast_features


# The deployed models were refit on train+validation, so interval residuals
# and permutation importance are both measured on the unseen test window.
TEST_START = pd.Timestamp(SPLIT_DATES["test"][0])
TEST_END = pd.Timestamp(SPLIT_DATES["test"][1])


class ForecastService:
    def __init__(self):
        self.package = self._load_package()
        self.models = self._extract_models(self.package)
        self.feature_map = self._extract_feature_map(self.package)
        self._diagnostics_lock = Lock()
        self._interval_cache = {}
        self._importance_cache = {}

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_package():
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(f"Model artifact not found: {MODEL_PATH}")
        obj = joblib.load(MODEL_PATH)
        if not isinstance(obj, dict):
            raise ValueError("Expected the exported Joblib package to be a dictionary")
        return obj

    @staticmethod
    def _by_horizon(mapping, horizon):
        if not isinstance(mapping, dict):
            return None
        return mapping.get(horizon, mapping.get(str(horizon)))

    def _extract_models(self, package):
        models = package.get("models")
        if not isinstance(models, dict):
            raise ValueError(
                "Artifact has no 'models' dictionary. Actual keys: "
                + ", ".join(map(str, package.keys()))
            )
        normalized = {}
        for h in SUPPORTED_HORIZONS:
            model = self._by_horizon(models, h)
            if isinstance(model, dict):
                # Support packages that store model and metadata together.
                model = model.get("model") or model.get("estimator")
            if model is not None:
                normalized[h] = model
        missing = [h for h in SUPPORTED_HORIZONS if h not in normalized]
        if missing:
            raise ValueError(f"Artifact is missing trained models for horizons: {missing}")
        return normalized

    def _extract_feature_map(self, package):
        candidates = [
            package.get("feature_names"),
            package.get("feature_metadata"),
            package.get("features"),
            package.get("model_metadata"),
        ]
        result = {}
        for h in SUPPORTED_HORIZONS:
            model = self.models[h]
            if hasattr(model, "feature_names_in_"):
                result[h] = list(model.feature_names_in_)
                continue
            for candidate in candidates:
                item = self._by_horizon(candidate, h)
                if isinstance(item, dict):
                    for key in ("feature_names", "features", "input_features", "columns"):
                        if isinstance(item.get(key), (list, tuple)):
                            item = item[key]
                            break
                if isinstance(item, (list, tuple)):
                    result[h] = list(item)
                    break
        missing = [h for h in SUPPORTED_HORIZONS if h not in result]
        if missing:
            raise ValueError(
                f"Could not recover feature order for horizons {missing}. "
                "The model should expose feature_names_in_ or package feature metadata."
            )
        for h, names in result.items():
            if len(names) != 49:
                raise ValueError(f"H{h} metadata has {len(names)} features; expected 49")
        return result

    def _model_name(self, h):
        selected = self.package.get("selected_models", {})
        selected_item = self._by_horizon(selected, h)
        if isinstance(selected_item, dict):
            selected_item = (
                selected_item.get("model_name")
                or selected_item.get("name")
                or selected_item.get("model")
            )
        return str(selected_item or type(self.models[h]).__name__)

    def predict(self, horizon, features):
        frame = self._validated_frame(horizon, features)
        prediction = float(self.models[horizon].predict(frame)[0])
        if not math.isfinite(prediction):
            raise ValueError("Model returned a non-finite prediction")
        return {
            "status": "success",
            "horizon": horizon,
            "predicted_cases": max(0.0, prediction),
            "model_name": self._model_name(horizon),
        }

    def _validated_frame(self, horizon, features):
        if horizon not in SUPPORTED_HORIZONS:
            raise ValueError(f"Unsupported horizon. Choose one of {SUPPORTED_HORIZONS}")
        expected = self.feature_map[horizon]
        missing = sorted(set(expected) - set(features))
        extra = sorted(set(features) - set(expected))
        if missing or extra:
            raise ValueError({
                "missing_features": missing,
                "unexpected_features": extra
            })
        values = []
        for name in expected:
            value = float(features[name])
            if not math.isfinite(value):
                raise ValueError(f"Feature '{name}' must be finite")
            values.append(value)
        return pd.DataFrame([values], columns=expected)

    def predict_batch(self, horizon, frame):
        """Predict many wards in one call (frame columns already in model order)."""
        return np.maximum(0.0, self.models[horizon].predict(frame[self.feature_map[horizon]]))

    def prediction_intervals_batch(self, horizon, frame, predictions, observations):
        """95% intervals for many wards at once. Returns (lowers, uppers, method)."""
        predictions = np.asarray(predictions, dtype=float)
        if horizon == 2:
            estimators = getattr(self.models[horizon], "estimators_", None)
            if not estimators:
                raise ValueError("H2 model does not expose its trained forest trees")
            values = frame[self.feature_map[horizon]].to_numpy(dtype=np.float32)
            per_tree = np.stack([estimator.predict(values) for estimator in estimators])
            lower, upper = np.quantile(per_tree, [0.025, 0.975], axis=0)
            method = "H2 2.5th–97.5th percentile across trained forest trees"
        else:
            lower_residual, upper_residual = self.residual_quantiles(horizon, observations)
            lower, upper = predictions + lower_residual, predictions + upper_residual
            method = (f"H{horizon} 2.5th–97.5th percentile of held-out test residuals "
                      f"({TEST_START:%Y-%m}–{TEST_END:%Y-%m})")
        return np.maximum(0.0, lower), np.maximum(0.0, upper), method

    def residual_quantiles(self, horizon, observations):
        # Lock-free fast path: don't wait behind a long importance computation.
        cached = self._interval_cache.get(horizon)
        if cached is not None:
            return cached
        with self._diagnostics_lock:
            if horizon not in self._interval_cache:
                self._interval_cache[horizon] = self._test_residual_quantiles(horizon, observations)
            return self._interval_cache[horizon]

    def prediction_interval(self, horizon, features, observations, predicted_cases=None):
        frame = self._validated_frame(horizon, features)
        prediction = (
            self.predict(horizon, features)["predicted_cases"]
            if predicted_cases is None else float(predicted_cases)
        )
        if horizon == 2:
            estimators = getattr(self.models[horizon], "estimators_", None)
            if estimators is None or len(estimators) == 0:
                raise ValueError("H2 model does not expose its trained forest trees")
            tree_predictions = np.array([
                float(estimator.predict(frame)[0]) for estimator in estimators
            ])
            lower, upper = np.quantile(tree_predictions, [0.025, 0.975])
            method = "H2 2.5th–97.5th percentile across trained forest trees"
        else:
            with self._diagnostics_lock:
                if horizon not in self._interval_cache:
                    self._interval_cache[horizon] = self._test_residual_quantiles(
                        horizon, observations
                    )
                lower_residual, upper_residual = self._interval_cache[horizon]
            lower = prediction + lower_residual
            upper = prediction + upper_residual
            method = f"H{horizon} 2.5th–97.5th percentile of held-out test residuals ({TEST_START:%Y-%m}–{TEST_END:%Y-%m})"
        return {
            "lower": max(0.0, float(lower)),
            "upper": max(0.0, float(upper)),
            "method": method,
        }

    def _evaluation_data(self, horizon, observations, start, end):
        groups = [column for column in ("city", "ward_id") if column in observations.columns]
        feature_rows = []
        targets = []
        for _, ward in observations.groupby(groups, sort=False):
            ward = ward.sort_values("date").reset_index(drop=True)
            dates = ward["date"].tolist()
            for index, source_date in enumerate(dates):
                target_index = index + horizon
                if source_date < start or source_date > end or target_index >= len(ward):
                    continue
                features = build_forecast_features(
                    ward, pd.Timestamp(source_date), horizon, self.feature_map[horizon]
                )
                feature_rows.append([features[name] for name in self.feature_map[horizon]])
                targets.append(float(ward.iloc[target_index]["dengue_cases"]))
        if not feature_rows:
            raise ValueError(f"No H{horizon} evaluation samples are available for {start.date()}–{end.date()}")
        return (
            pd.DataFrame(feature_rows, columns=self.feature_map[horizon]),
            np.asarray(targets, dtype=float),
        )

    def _test_residual_quantiles(self, horizon, observations):
        features, actual = self._evaluation_data(
            horizon, observations, TEST_START, TEST_END
        )
        predicted = np.maximum(0.0, self.models[horizon].predict(features))
        residuals = actual - predicted
        return tuple(float(value) for value in np.quantile(residuals, [0.025, 0.975]))

    def evaluation_series(self, horizon, observations, start, end, split_name):
        """Weekly totals of actual vs predicted cases (summed over wards) by target week."""
        cache_key = ("series", horizon, start, end)
        with self._diagnostics_lock:
            if cache_key in self._interval_cache:
                return self._interval_cache[cache_key]
        groups = [c for c in ("city", "ward_id") if c in observations.columns]
        names = self.feature_map[horizon]
        rows, targets, target_dates = [], [], []
        for _, ward in observations.groupby(groups, sort=False):
            ward = ward.sort_values("date").reset_index(drop=True)
            for index, source_date in enumerate(ward["date"]):
                target_index = index + horizon
                if source_date < start or source_date > end or target_index >= len(ward) or index < 12:
                    continue
                feats = build_forecast_features(ward, pd.Timestamp(source_date), horizon, names)
                rows.append([feats[n] for n in names])
                targets.append(float(ward.iloc[target_index]["dengue_cases"]))
                target_dates.append(pd.Timestamp(ward.iloc[target_index]["date"]))
        if not rows:
            return {"series": [], "metrics": None}
        predicted = np.maximum(0.0, self.models[horizon].predict(pd.DataFrame(rows, columns=names)))
        actual = np.asarray(targets, dtype=float)
        errors = actual - predicted
        ss_tot = float(((actual - actual.mean()) ** 2).sum())
        metrics = {
            "mae": round(float(np.abs(errors).mean()), 3),
            "rmse": round(float(np.sqrt((errors ** 2).mean())), 3),
            "r2": round(1 - float((errors ** 2).sum()) / ss_tot, 3) if ss_tot else None,
            "observations": int(len(actual)),
            "level": "ward-week",
        }
        frame = pd.DataFrame({"week": target_dates, "actual": targets, "predicted": predicted})
        weekly = frame.groupby("week", as_index=False)[["actual", "predicted"]].sum()
        series = [{
            "week_start": r.week.strftime("%Y-%m-%d"),
            "actual": round(float(r.actual), 1),
            "predicted": round(float(r.predicted), 1),
            "split": split_name,
        } for r in weekly.itertuples(index=False)]
        result = {"series": series, "metrics": metrics}
        with self._diagnostics_lock:
            self._interval_cache[cache_key] = result
        return result

    def test_feature_importance(self, horizon, observations):
        with self._diagnostics_lock:
            if horizon not in self._importance_cache:
                features, actual = self._evaluation_data(
                    horizon, observations, TEST_START, TEST_END
                )
                result = permutation_importance(
                    self.models[horizon],
                    features,
                    actual,
                    scoring="neg_mean_absolute_error",
                    n_repeats=3,
                    random_state=42,
                    n_jobs=1,
                )
                increases = np.maximum(result.importances_mean, 0.0)
                total = float(increases.sum())
                normalized = increases / total if total else increases
                self._importance_cache[horizon] = {
                    "sample_count": len(features),
                    "items": [
                        {
                            "feature": feature,
                            "importance": float(value),
                        }
                        for feature, value in zip(self.feature_map[horizon], normalized)
                    ],
                }
            return self._importance_cache[horizon]

    def get_model_info(self):
        horizons = {}
        for h in SUPPORTED_HORIZONS:
            horizons[f"H{h}"] = {
                "model_name": self._model_name(h),
                "model_class": type(self.models[h]).__name__,
                "feature_count": len(self.feature_map[h]),
            }
        return {
            "artifact": MODEL_PATH.name,
            "horizons": horizons,
            "package_keys": list(self.package.keys()),
        }
