import math
from pydantic import BaseModel, ConfigDict, Field, field_validator

class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    features: dict[str, float] = Field(..., min_length=1)

    @field_validator("features")
    @classmethod
    def finite_features(cls, values):
        for key, value in values.items():
            if not key.strip():
                raise ValueError("Feature names cannot be empty")
            if not math.isfinite(float(value)):
                raise ValueError(f"Feature {key} must be finite")
        return values

class ForecastResponse(BaseModel):
    status: str
    horizon: int
    predicted_cases: float
    model_name: str
