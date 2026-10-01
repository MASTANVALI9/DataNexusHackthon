import os
import logging
from typing import List, Dict, Any, Optional
import httpx

logger = logging.getLogger("truthlens.providers.google_fact_check")

GOOGLE_FACTCHECK_API_KEY = os.getenv("GOOGLE_FACTCHECK_API_KEY", "")
GOOGLE_FACTCHECK_BASE_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"


class GoogleFactCheckAPIError(Exception):
    """Raised when a configured fact-check provider cannot complete a search."""

    def __init__(self, message: str, code: str = "GOOGLE_FACTCHECK_ERROR", status_code: int = 502):
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class GoogleFactCheckProvider:
    """Connector for Google Fact Check Tools API (https://factchecktools.googleapis.com).

    Queries existing ClaimReview records when an API key is provided.
    Skips gracefully if no key is configured; configured-provider failures are
    surfaced to the orchestrator so they cannot masquerade as an empty search.
    """

    def __init__(self, api_key: str = GOOGLE_FACTCHECK_API_KEY, timeout: float = 6.0):
        self.api_key = api_key
        self.base_url = GOOGLE_FACTCHECK_BASE_URL
        self.timeout = timeout

    async def search_fact_checks(self, claim: str, language_code: str = "en") -> List[Dict[str, Any]]:
        """Query Google Fact Check API for matching ClaimReview entries."""
        if not self.api_key:
            logger.info("[GoogleFactCheck] No API key configured (GOOGLE_FACTCHECK_API_KEY). Skipping API call.")
            return []

        params = {
            "query": claim.strip()[:200],
            "languageCode": language_code,
            "key": self.api_key,
        }

        try:
            timeout = httpx.Timeout(self.timeout, connect=min(2.0, self.timeout))
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(self.base_url, params=params)

            if response.status_code == 200:
                data = response.json()
                if not isinstance(data, dict) or not isinstance(data.get("claims", []), list):
                    raise GoogleFactCheckAPIError(
                        "Google Fact Check API returned an unexpected response structure.",
                        code="GOOGLE_FACTCHECK_MALFORMED_RESPONSE",
                    )
                claims = data.get("claims", [])
                results = []
                for cl in claims:
                    if not isinstance(cl, dict):
                        continue
                    reviews = cl.get("claimReview", [])
                    if not isinstance(reviews, list):
                        continue
                    for rev in reviews:
                        if not isinstance(rev, dict):
                            continue
                        publisher = rev.get("publisher")
                        publisher_name = publisher.get("name") if isinstance(publisher, dict) else None
                        results.append({
                            "claimReviewed": cl.get("text") if isinstance(cl.get("text"), str) else claim,
                            "publisher": {"name": publisher_name} if isinstance(publisher_name, str) else {},
                            "textualRating": rev.get("textualRating") if isinstance(rev.get("textualRating"), str) else "",
                            "url": rev.get("url") if isinstance(rev.get("url"), str) else "",
                            "reviewDate": rev.get("reviewDate") if isinstance(rev.get("reviewDate"), str) else None,
                        })
                logger.info("[GoogleFactCheck] Found %d matching fact-check reviews.", len(results))
                return results
            else:
                logger.warning("[GoogleFactCheck] API returned HTTP %d", response.status_code)
                if response.status_code == 429:
                    raise GoogleFactCheckAPIError(
                        "Google Fact Check API is rate limited.",
                        code="GOOGLE_FACTCHECK_RATE_LIMIT",
                        status_code=429,
                    )
                raise GoogleFactCheckAPIError(
                    f"Google Fact Check API returned HTTP {response.status_code}.",
                    status_code=503 if response.status_code in (502, 503, 504) else 502,
                )

        except httpx.TimeoutException as exc:
            logger.warning("[GoogleFactCheck] Request timed out after %.1fs", self.timeout)
            raise GoogleFactCheckAPIError(
                "Google Fact Check API request timed out.",
                code="GOOGLE_FACTCHECK_TIMEOUT",
                status_code=504,
            ) from exc
        except httpx.RequestError as exc:
            logger.warning("[GoogleFactCheck] Network request failed: %s", type(exc).__name__)
            raise GoogleFactCheckAPIError(
                "Google Fact Check API network request failed.",
                code="GOOGLE_FACTCHECK_NETWORK_ERROR",
            ) from exc
        except (ValueError, TypeError) as exc:
            logger.warning("[GoogleFactCheck] Malformed response: %s", type(exc).__name__)
            raise GoogleFactCheckAPIError(
                "Google Fact Check API returned malformed data.",
                code="GOOGLE_FACTCHECK_MALFORMED_RESPONSE",
            ) from exc
        except GoogleFactCheckAPIError:
            raise
        except Exception as exc:
            logger.warning("[GoogleFactCheck] Query failed gracefully: %s", type(exc).__name__)
            raise GoogleFactCheckAPIError("Google Fact Check API request failed.") from exc
