from pydantic import BaseModel

class WardItem(BaseModel):
    city: str
    ward_id: str
    records: int
    total_cases: int
    latest_date: str

class WardListResponse(BaseModel):
    total: int
    wards: list[WardItem]
