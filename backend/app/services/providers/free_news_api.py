import os
import re
import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
import httpx

from app.schemas.evidence import NormalizedEvidenceItem

logger = logging.getLogger("truthlens.providers.free_news_api")

FREE_NEWS_API_BASE_URL = os.getenv("FREE_NEWS_API_BASE_URL", "https://freenewsapi.ai/v1")

# Common stop words to strip when building search queries
_STOP_WORDS: Set[str] = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "its", "it", "this", "that",
    "these", "those", "i", "we", "you", "he", "she", "they", "me", "him",
    "her", "us", "them", "my", "our", "your", "his", "their", "and", "or",
    "but", "if", "while", "of", "at", "by", "for", "with", "about", "against",
    "between", "through", "during", "before", "after", "above", "below", "to",
    "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "when", "where", "why", "how",
    "all", "both", "each", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "as", "until", "also", "into", "report", "reported",
    "reports", "reporting", "according", "said", "says", "including", "per",
    "via", "told", "added", "noted", "stated", "claimed",
}
_NEGATION_TERMS = {"no", "nor", "not", "never", "without"}


class FreeNewsAPIError(Exception):
    """Custom exception for Free News API failures."""
    def __init__(self, code: str, message: str, status_code: int = 502):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class FreeNewsProvider:
    """Provider service interface for Free News API (https://freenewsapi.ai).

    A keyless, public article retrieval provider for news corpus search.
    Treats results as candidate news evidence items, not authoritative verdicts.

    Improvements over Phase 3:
    - Generates multiple search-query variations from the claim for better recall
    - Extracts key entities (names, locations, numbers, dates) instead of using raw text
    - Retrieves full article text when available for deeper evidence matching
    - Runs parallel queries and merges/deduplicates results
    """

    def __init__(self, base_url: str = FREE_NEWS_API_BASE_URL, timeout: float = 9.0):
        self.base_url = base_url.rstrip("/")
        self.search_url = f"{self.base_url}/search"
        self.timeout = timeout

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def search(
        self,
        claim: str,
        country: Optional[str] = None,
        language: Optional[str] = None,
        date: Optional[str] = None,
        size: int = 10,
    ) -> Dict[str, Any]:
        """Search the Free News API for articles relevant to a claim.

        Generates multiple query variations from the claim, runs them in
        parallel, and merges/deduplicates the results.

        Returns:
            Dict containing took_ms, total, items list, and diagnostics.
        """
        queries = self._generate_search_queries(claim)
        logger.info(
            "[FreeNewsAPI] Generated %d search queries from claim: %s",
            len(queries),
            queries,
        )

        start_time = time.time()
        all_items: List[NormalizedEvidenceItem] = []
        diagnostics: List[Dict[str, Any]] = []
        search_errors: List[str] = []

        # Run queries in parallel for speed
        tasks = [
            self._execute_single_query(
                query=q,
                country=country,
                language=language,
                date=date,
                size=min(size, 25),
            )
            for q in queries
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for idx, result in enumerate(results):
            query_text = queries[idx] if idx < len(queries) else "unknown"
            if isinstance(result, Exception):
                err_type = type(result).__name__
                err_msg = str(result)
                logger.warning(
                    "[FreeNewsAPI] Query %d failed: %s — %s",
                    idx + 1, err_type, err_msg,
                )
                search_errors.append(f"Query '{query_text[:60]}': {err_type}")
                diagnostics.append({
                    "query": query_text,
                    "status": "error",
                    "error": err_type,
                    "results_count": 0,
                })
            else:
                items = result.get("items", [])
                all_items.extend(items)
                diagnostics.append({
                    "query": query_text,
                    "status": "ok",
                        "results_count": len(items),
                    "total": result.get("total", 0),
                })
                logger.info(
                    "[FreeNewsAPI] Query %d returned %d items (total=%d)",
                    idx + 1, len(items), result.get("total", 0),
                )

        # Deduplicate across queries by URL
        deduped_items = self._deduplicate_by_url(all_items)
        duration_ms = int((time.time() - start_time) * 1000)

        # If ALL queries failed, raise so the orchestrator can mark SEARCH_ERROR
        if len(search_errors) == len(queries) and len(queries) > 0:
            raise FreeNewsAPIError(
                code="ALL_QUERIES_FAILED",
                message=f"All {len(queries)} search queries failed: {'; '.join(search_errors)}",
                status_code=502,
            )

        logger.info(
            "[FreeNewsAPI] Merged results: %d unique items from %d queries in %dms",
            len(deduped_items), len(queries), duration_ms,
        )

        return {
            "took_ms": duration_ms,
            "total": len(deduped_items),
            "items": deduped_items[:size],
            "search_diagnostics": diagnostics,
            "queries_attempted": len(queries),
            "queries_succeeded": len(queries) - len(search_errors),
            "partial_failure": len(search_errors) > 0 and len(search_errors) < len(queries),
        }

    # ------------------------------------------------------------------
    # Query Generation
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_search_queries(claim: str) -> List[str]:
        """Generate multiple search query variations from a claim for better retrieval.

        Extracts key entities (proper nouns, locations, numbers, dates) and builds
        keyword-style queries instead of sending the entire verbose sentence.
        """
        claim_stripped = claim.strip()
        claim_lower = claim_stripped.lower()

        # Extract all words
        all_words = re.findall(r'\b\w+\b', claim_lower)

        # Key words = non-stop-words with length > 2
        key_words = [
            w for w in all_words
            if (w not in _STOP_WORDS or w in _NEGATION_TERMS) and len(w) > 2
        ]

        # Extract numbers (important for verification of figures)
        numbers = re.findall(r'\b\d+\b', claim_stripped)

        # Extract potential proper nouns from the original (capitalized sequences)
        proper_nouns = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', claim_stripped)
        # Filter out sentence-start words that aren't names
        proper_nouns = [pn for pn in proper_nouns if pn.lower() not in _STOP_WORDS]

        # Extract month names
        months = re.findall(
            r'\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b',
            claim_lower,
        )

        queries: List[str] = []

        # Query 1: Core entities — proper nouns + numbers + top key words
        q1_parts = proper_nouns[:4] + numbers[:3] + [w for w in key_words[:4] if w.lower() not in [pn.lower() for pn in proper_nouns[:4]]]
        if months:
            q1_parts.extend(months[:1])
        if q1_parts:
            q1 = " ".join(dict.fromkeys(q1_parts))  # deduplicate preserving order
            queries.append(q1)

        # Query 2: Key words only (broader semantic match)
        if key_words:
            q2 = " ".join(key_words[:8])
            if q2 not in queries:
                queries.append(q2)

        # Query 3: Simplified — top 4-5 distinctive words for maximum recall
        if len(key_words) > 4:
            q3 = " ".join(key_words[:5])
            if q3 not in queries:
                queries.append(q3)

        # Fallback: use the original claim truncated
        if not queries:
            queries.append(claim_stripped[:200])

        return queries[:3]

    # ------------------------------------------------------------------
    # Single Query Execution
    # ------------------------------------------------------------------

    async def _execute_single_query(
        self,
        query: str,
        country: Optional[str] = None,
        language: Optional[str] = None,
        date: Optional[str] = None,
        size: int = 15,
    ) -> Dict[str, Any]:
        """Execute a single search query against the Free News API."""
        params: Dict[str, Any] = {
            "q": query.strip()[:500],
            "size": min(max(size, 1), 100),
            "sort": "relevance",
            "full_text": True,  # Retrieve article text for evidence matching
        }

        if country and country.strip():
            params["country"] = country.strip().upper()

        if language and language.strip():
            params["lang"] = language.strip().lower()

        if date and date.strip():
            allowed_dates = {"today", "yesterday", "24h", "48h", "7d", "30d"}
            cleaned_date = date.strip().lower()
            if cleaned_date in allowed_dates:
                params["date"] = cleaned_date

        start_time = time.time()
        logger.info("[FreeNewsAPI] request started: endpoint=%s q='%s'", self.search_url, query[:80])

        try:
            timeout = httpx.Timeout(self.timeout, connect=min(3.0, self.timeout))
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(self.search_url, params=params)

            duration_ms = int((time.time() - start_time) * 1000)
            logger.info("[FreeNewsAPI] response received: status=%d duration_ms=%d", response.status_code, duration_ms)

            # Handle known HTTP status codes
            if response.status_code == 200:
                try:
                    payload = response.json()
                except Exception as json_err:
                    logger.error("[FreeNewsAPI] Malformed JSON response: %s", str(json_err))
                    raise FreeNewsAPIError(
                        code="PROVIDER_MALFORMED_RESPONSE",
                        message="Free News API returned an invalid JSON response format.",
                        status_code=502,
                    )

                if not isinstance(payload, dict) or not isinstance(payload.get("results", []), list):
                    raise FreeNewsAPIError(
                        code="PROVIDER_MALFORMED_RESPONSE",
                        message="Free News API returned an unexpected response structure.",
                        status_code=502,
                    )
                results = payload.get("results", [])
                normalized_items = self._normalize_results(results)
                return {
                    "took_ms": payload.get("took_ms") if isinstance(payload.get("took_ms"), int) else duration_ms,
                    "total": payload.get("total") if isinstance(payload.get("total"), int) else len(normalized_items),
                    "items": normalized_items,
                }

            elif response.status_code == 400:
                detail = self._extract_error_detail(response, "Malformed search parameter.")
                logger.warning("[FreeNewsAPI] 400 Bad Request: %s", detail)
                raise FreeNewsAPIError(code="PROVIDER_BAD_REQUEST", message=detail, status_code=400)

            elif response.status_code == 422:
                detail = self._extract_error_detail(response, "Parameter value out of accepted range.")
                logger.warning("[FreeNewsAPI] 422 Unprocessable: %s", detail)
                raise FreeNewsAPIError(code="PROVIDER_INVALID_PARAMS", message=detail, status_code=422)

            elif response.status_code == 429:
                logger.warning("[FreeNewsAPI] 429 Rate limited by upstream provider.")
                raise FreeNewsAPIError(
                    code="PROVIDER_RATE_LIMIT",
                    message="Upstream evidence search is currently rate limited. Please try again shortly.",
                    status_code=429,
                )

            elif response.status_code in (502, 503, 504):
                logger.error("[FreeNewsAPI] Upstream server error status=%d", response.status_code)
                raise FreeNewsAPIError(
                    code="PROVIDER_UNAVAILABLE",
                    message="Free News API search backend is currently unavailable.",
                    status_code=503,
                )

            else:
                logger.error("[FreeNewsAPI] Unexpected upstream HTTP status=%d", response.status_code)
                raise FreeNewsAPIError(
                    code="PROVIDER_ERROR",
                    message=f"Evidence search provider returned unexpected HTTP {response.status_code}.",
                    status_code=502,
                )

        except httpx.TimeoutException:
            logger.error("[FreeNewsAPI] Request timed out after %.1fs", self.timeout)
            raise FreeNewsAPIError(
                code="PROVIDER_TIMEOUT",
                message="The evidence provider took too long to respond. Please try a simpler search phrase.",
                status_code=504,
            )
        except httpx.RequestError as exc:
            logger.error("[FreeNewsAPI] Network error connecting to provider: %s", type(exc).__name__)
            raise FreeNewsAPIError(
                code="PROVIDER_NETWORK_ERROR",
                message="Network communication error while connecting to Free News API.",
                status_code=502,
            )

    # ------------------------------------------------------------------
    # Normalization & Deduplication
    # ------------------------------------------------------------------

    def _normalize_results(self, raw_results: List[Dict[str, Any]]) -> List[NormalizedEvidenceItem]:
        """Normalize raw Free News API article objects into TruthLens evidence candidates."""
        now_iso = datetime.now(timezone.utc).isoformat()
        normalized: List[NormalizedEvidenceItem] = []

        if not isinstance(raw_results, list):
            return normalized

        for item in raw_results:
            if not isinstance(item, dict):
                continue

            article_url = item.get("url") if isinstance(item.get("url"), str) else ""
            if not article_url:
                continue
            title = item.get("title") if isinstance(item.get("title"), str) else "Untitled Document"
            publisher = item.get("sitename") or item.get("host")
            publisher = publisher if isinstance(publisher, str) else None
            description = item.get("description") if isinstance(item.get("description"), str) else None
            content = item.get("text") if isinstance(item.get("text"), str) else None

            normalized_item = NormalizedEvidenceItem(
                id=str(item.get("id") or hash(article_url)),
                title=title,
                publisher=publisher,
                source_url=article_url,
                published_at=item.get("published_at") if isinstance(item.get("published_at"), str) else None,
                description=description,
                content=content,
                source_type="news",
                provider="free_news_api",
                language=item.get("lang") if isinstance(item.get("lang"), str) else None,
                country=item.get("country") if isinstance(item.get("country"), str) else None,
                retrieval_timestamp=now_iso,
            )
            normalized.append(normalized_item)

        return normalized

    @staticmethod
    def _deduplicate_by_url(items: List[NormalizedEvidenceItem]) -> List[NormalizedEvidenceItem]:
        """Remove duplicate articles across multiple query results by URL."""
        seen_urls: Set[str] = set()
        deduped: List[NormalizedEvidenceItem] = []
        for item in items:
            url_key = item.source_url.strip().lower().rstrip("/")
            if url_key not in seen_urls:
                seen_urls.add(url_key)
                deduped.append(item)
        return deduped

    @staticmethod
    def _extract_error_detail(response: httpx.Response, fallback: str) -> str:
        """Safely extract human-readable error detail without exposing stack traces."""
        try:
            data = response.json()
            if isinstance(data, dict) and "detail" in data:
                detail = data["detail"]
                if isinstance(detail, str):
                    return detail
                if isinstance(detail, list) and detail and isinstance(detail[0], dict):
                    return detail[0].get("msg", fallback)
        except Exception:
            pass
        return fallback
