from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    application: str
    version: str
    model_loaded: bool
    dataset_file_exists: bool
