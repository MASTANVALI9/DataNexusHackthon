from fastapi import APIRouter
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Health check endpoint to verify backend service status."""
    return HealthResponse(
        status="ok",
        service="truthlens-backend"
    )
