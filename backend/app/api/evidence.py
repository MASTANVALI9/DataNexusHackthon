import time
import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.evidence import (
    EvidenceSearchRequest,
    EvidenceSearchResponse,
    EvidenceErrorResponse,
)
from app.services.evidence_orchestrator import EvidenceOrchestrator
from app.services.providers.free_news_api import FreeNewsAPIError

logger = logging.getLogger("truthlens.api.evidence")

router = APIRouter(prefix="/evidence", tags=["Evidence Retrieval"])
orchestrator = EvidenceOrchestrator()


@router.post(
    "/search",
    response_model=EvidenceSearchResponse,
    responses={
        400: {"model": EvidenceErrorResponse, "description": "Invalid search parameters"},
        422: {"model": EvidenceErrorResponse, "description": "Unprocessable parameter range"},
        429: {"model": EvidenceErrorResponse, "description": "Provider rate limit reached"},
        502: {"model": EvidenceErrorResponse, "description": "Upstream provider error"},
        504: {"model": EvidenceErrorResponse, "description": "Provider gateway timeout"},
    },
)
async def search_evidence(request: EvidenceSearchRequest):
    """Retrieve normalized evidence candidates relevant to a claim.

    Queries the Free News API provider through the Evidence Orchestrator.
    Returns candidate articles normalized into standard TruthLens evidence objects.
    """
    start_time = time.time()
    safe_claim = request.claim.strip()[:60] + "..." if len(request.claim.strip()) > 60 else request.claim.strip()
    logger.info("[Evidence] POST /api/evidence/search received claim='%s'", safe_claim)

    if not request.claim or not request.claim.strip():
        logger.warning("[Evidence] Empty claim rejected")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "EMPTY_CLAIM",
                    "message": "The claim text cannot be empty or whitespace.",
                }
            },
        )

    try:
        response = await orchestrator.search(request)
        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(
            "[Evidence] response status=200 results=%d duration_ms=%d",
            response.results_count,
            duration_ms,
        )
        return response

    except FreeNewsAPIError as err:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.warning(
            "[Evidence] Provider error status=%d code=%s message='%s' duration_ms=%d",
            err.status_code,
            err.code,
            err.message,
            duration_ms,
        )
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )

    except Exception as exc:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception("[Evidence] Unexpected internal error during evidence retrieval: %s", type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_RETRIEVAL_ERROR",
                    "message": "An unexpected error occurred while retrieving evidence. Please try again.",
                }
            },
        )
