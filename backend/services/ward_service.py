from threading import Lock
import pandas as pd
from core.config import DATASET_PATH, DATASET_SHEET

_DATA_LOCK = Lock()
_DATA_CACHE = None


class WardService:
    def __init__(self):
        self.data = self._load_data()

    @staticmethod
    def _load_data():
        global _DATA_CACHE
        if _DATA_CACHE is None:
            with _DATA_LOCK:
                if _DATA_CACHE is None:
                    if not DATASET_PATH.is_file():
                        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")
                    df = pd.read_excel(DATASET_PATH, sheet_name=DATASET_SHEET)
                    required = ["date", "city", "ward_id", "dengue_cases"]
                    missing = [c for c in required if c not in df.columns]
                    if missing:
                        raise ValueError(f"Dataset missing columns: {missing}")
                    df = df.copy()
                    df["date"] = pd.to_datetime(df["date"], errors="coerce")
                    df["city"] = df["city"].astype(str).str.strip()
                    df["ward_id"] = df["ward_id"].astype(str).str.strip()
                    df["dengue_cases"] = pd.to_numeric(df["dengue_cases"], errors="coerce")
                    df = df.dropna(subset=required)
                    if (df["dengue_cases"] < 0).any():
                        raise ValueError("Negative dengue case counts found")
                    _DATA_CACHE = df.sort_values(["city", "ward_id", "date"]).reset_index(drop=True)
        return _DATA_CACHE

    def cities(self):
        return sorted(self.data["city"].unique().tolist())

    def get_all_wards(self, city=None):
        df = self.data
        if city:
            df = df[df.city.str.casefold() == city.casefold()]
        return (df.groupby(["city", "ward_id"])
                .agg(records=("date", "count"),
                     latest_date=("date", "max"),
                     total_cases=("dengue_cases", "sum"))
                .reset_index())

    def get_ward(self, city, ward_id):
        return self.data[
            (self.data.city.str.casefold() == city.casefold())
            & (self.data.ward_id == str(ward_id))
        ].copy()
