from pydantic import BaseModel

class AnalyticsSummary(BaseModel):
    total_records: int
    total_cities: int
    total_wards: int
    total_cases: int
    average_cases: float
    latest_date: str
