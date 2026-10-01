"""TruthLens Pydantic schemas for request/response serialization."""
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
