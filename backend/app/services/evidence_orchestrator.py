import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from app.schemas.evidence import (
    EvidenceSearchRequest,
    EvidenceSearchResponse,
    NormalizedEvidenceItem,
)
from app.services.providers.free_news_api import FreeNewsProvider, FreeNewsAPIError
from app.services.providers.google_fact_check import GoogleFactCheckProvider
from app.services.verification_engine import VerificationEngine

logger = logging.getLogger("truthlens.services.orchestrator")
OVERALL_PROVIDER_DEADLINE_SECONDS = 12.5


class EvidenceOrchestrator:
    """Coordinates evidence retrieval and verification analysis across configured providers.

    Queries:
    - Free News API for news search candidates
    - Google Fact Check Tools API for existing fact checks
    - Verification Engine for deterministic NLI stance, evidence scoring, and factual points
    """

    def __init__(
        self,
        free_news_provider: FreeNewsProvider = None,
        google_fact_check_provider: GoogleFactCheckProvider = None,
        verification_engine: VerificationEngine = None,
    ):
        self.free_news_provider = free_news_provider or FreeNewsProvider()
        self.google_fact_check_provider = google_fact_check_provider or GoogleFactCheckProvider()
        self.verification_engine = verification_engine or VerificationEngine()

    async def search(self, request: EvidenceSearchRequest) -> EvidenceSearchResponse:
        """Search evidence candidates and run verification analysis for a claim."""
        start_time = time.time()
        safe_claim_preview = request.claim[:60] + "..." if len(request.claim) > 60 else request.claim
        jurisdiction = request.jurisdiction or "Central Government / India"

        logger.info(
            "[Orchestrator] Starting evidence search & verification: query='%s' jurisdiction='%s' country='%s' lang='%s'",
            safe_claim_preview,
            jurisdiction,
            request.country,
            request.language,
        )

        provider_tasks: Dict[str, asyncio.Task] = {
            "news": asyncio.create_task(self.free_news_provider.search(
                claim=request.claim,
                country=request.country,
                language=request.language,
                date=request.date,
                size=request.size or 15,
            ))
        }
        google_configured = bool(getattr(self.google_fact_check_provider, "api_key", ""))
        if google_configured:
            provider_tasks["fact_check"] = asyncio.create_task(
                self.google_fact_check_provider.search_fact_checks(
                    claim=request.claim,
                    language_code=request.language or "en"
                )
            )

        done, pending = await asyncio.wait(
            provider_tasks.values(),
            timeout=OVERALL_PROVIDER_DEADLINE_SECONDS,
        )
        task_names = {task: name for name, task in provider_tasks.items()}
        outcomes: Dict[str, Any] = {}
        failures: List[Tuple[str, BaseException]] = []
        for task in done:
            name = task_names[task]
            try:
                outcomes[name] = task.result()
            except Exception as exc:
                failures.append((name, exc))
                logger.warning("[Orchestrator] Provider %s failed: %s", name, type(exc).__name__)
        for task in pending:
            name = task_names[task]
            task.cancel()
            failures.append((name, TimeoutError("Provider exceeded the overall search deadline.")))
            logger.warning("[Orchestrator] Provider %s exceeded the %.1fs overall deadline", name, OVERALL_PROVIDER_DEADLINE_SECONDS)
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

        if not outcomes:
            if len(failures) == 1:
                name, error = failures[0]
                if isinstance(error, FreeNewsAPIError):
                    raise error
                status_code = getattr(error, "status_code", 502)
                if status_code in (429, 502, 503, 504):
                    code = getattr(error, "code", "PROVIDER_ERROR")
                    message = str(error) if name == "fact_check" else "Evidence provider search failed."
                    raise FreeNewsAPIError(code, message, status_code)
            rate_limited = next(
                (error for _, error in failures if getattr(error, "status_code", None) == 429),
                None,
            )
            if rate_limited:
                raise FreeNewsAPIError(
                    getattr(rate_limited, "code", "PROVIDER_RATE_LIMIT"),
                    "Evidence search is currently rate limited. Please try again shortly.",
                    429,
                )
            timed_out = any(
                isinstance(exc, (TimeoutError, asyncio.TimeoutError))
                or getattr(exc, "status_code", None) == 504
                for _, exc in failures
            )
            raise FreeNewsAPIError(
                code="ALL_PROVIDERS_FAILED",
                message="Evidence providers did not complete the search. Please try again shortly.",
                status_code=504 if timed_out else 502,
            )

        provider_data = outcomes.get("news")
        if not isinstance(provider_data, dict):
            provider_data = {}
        raw_items: List[NormalizedEvidenceItem] = provider_data.get("items", [])
        if not isinstance(raw_items, list):
            raw_items = []
        deduped_items = self._deduplicate_items(raw_items)
        fact_check_api_results = outcomes.get("fact_check", [])
        if not isinstance(fact_check_api_results, list):
            fact_check_api_results = []

        # 3. Run Verification Engine Analysis
        analysis = self.verification_engine.analyze(
            claim=request.claim,
            jurisdiction=jurisdiction,
            evidence_items=deduped_items,
            fact_check_api_results=fact_check_api_results
        )

        took_ms = int((time.time() - start_time) * 1000)

        warning: Optional[str] = None
        if failures:
            provider_labels = {"news": "Free News API", "fact_check": "Google Fact Check"}
            failed_providers = ", ".join(provider_labels.get(name, name) for name, _ in failures)
            warning = f"Some evidence providers were unavailable ({failed_providers}); results may be incomplete."
        elif provider_data.get("partial_failure") is True:
            warning = "Some Free News API search queries failed; the retrieved evidence may be incomplete."
        elif not deduped_items and not fact_check_api_results:
            warning = "The completed search returned no evidence documents or matching fact checks."

        if "news" in outcomes and "fact_check" in outcomes:
            provider_name = "free_news_api+google_fact_check"
        elif "news" in outcomes:
            provider_name = "free_news_api"
        else:
            provider_name = "google_fact_check"

        return EvidenceSearchResponse(
            claim=request.claim,
            jurisdiction=jurisdiction,
            country=request.country,
            language=request.language,
            total_found=provider_data.get("total", len(deduped_items)) if isinstance(provider_data.get("total", len(deduped_items)), int) else len(deduped_items),
            results_count=len(deduped_items),
            provider=provider_name,
            took_ms=took_ms,
            verdict=analysis["verdict"],
            verdict_label=analysis["verdict_label"],
            evidence_score=analysis["evidence_score"],
            evidence_strength=analysis["evidence_strength"],
            summary=analysis["summary"],
            score_factors=analysis["score_factors"],
            facts=analysis["facts"],
            misleading_breakdown=analysis["misleading_breakdown"],
            official_sources=analysis["official_sources"],
            trusted_news_sources=analysis["trusted_news_sources"],
            fact_checks=analysis["fact_checks"],
            claim_breakdown=analysis["claim_breakdown"],
            evidence_matrix=analysis["evidence_matrix"],
            results=analysis["processed_items"],
            warning=warning,
        )

    @staticmethod
    def _deduplicate_items(items: List[NormalizedEvidenceItem]) -> List[NormalizedEvidenceItem]:
        """Perform deterministic deduplication using canonical URL and/or article ID."""
        seen_keys = set()
        deduped = []

        for item in items:
            canonical_key = None
            if item.source_url:
                try:
                    parsed = urlparse(item.source_url)
                    clean_path = parsed.path.rstrip("/")
                    canonical_key = f"{parsed.netloc.lower()}{clean_path}"
                except Exception:
                    canonical_key = item.source_url.strip().lower()

            if not canonical_key:
                canonical_key = item.id or f"{item.title.strip().lower()}::{item.publisher or ''}"

            if canonical_key not in seen_keys:
                seen_keys.add(canonical_key)
                deduped.append(item)

        return deduped
