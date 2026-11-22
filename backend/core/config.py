import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
DATA_DIR = PROJECT_ROOT / "data"

MODEL_PATH = Path(os.getenv(
    "DENGUE_MODEL_PATH",
    str(ARTIFACTS_DIR / "dengue_final_models.joblib")
))
DATASET_PATH = Path(os.getenv(
    "DENGUE_DATASET_PATH",
    str(DATA_DIR / "hackathon_preli_dataset.xlsx")
))
DATASET_SHEET = os.getenv(
    "DENGUE_DATASET_SHEET",
    "bangladesh_dengue_large_dataset"
)

FRONTEND_ORIGINS = [
    x.strip() for x in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if x.strip()
]
# Optional regex so Vercel preview deployments are accepted,
# e.g. FRONTEND_ORIGIN_REGEX=https://.*\.vercel\.app
FRONTEND_ORIGIN_REGEX = os.getenv("FRONTEND_ORIGIN_REGEX") or None
# Chronological split used in the training notebook (Section 07, cell 61):
# first 70% of weeks train, next 15% validation, final 15% test.
# The exported models were refit on train+validation, so only the test window
# is genuinely unseen by the deployed models.
SPLIT_DATES = {
    "train": ("2016-01-04", "2022-12-26"),
    "validation": ("2023-01-02", "2024-06-24"),
    "test": ("2024-07-01", "2025-12-29"),
}
APP_NAME = "AI Urban Dengue Outbreak API"
APP_VERSION = "1.0.0"
SUPPORTED_HORIZONS = (2, 3, 4)
