from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class EvidenceSearchRequest(BaseModel):
    """Request schema for evidence retrieval and claim verification."""
    claim: str = Field(..., min_length=1, max_length=500, description="The core claim or news headline to verify.")
    country: Optional[str] = Field("IN", max_length=10, description="ISO country code filter (e.g., 'IN').")
    language: Optional[str] = Field("en", max_length=10, description="ISO language code filter (e.g., 'en', 'te', 'ta').")
    date: Optional[str] = Field(None, description="Preset period: 'today', 'yesterday', '24h', '48h', '7d', '30d'.")
    size: Optional[int] = Field(15, ge=1, le=100, description="Number of results to retrieve (1-100).")
    jurisdiction: Optional[str] = Field("Central Government / India", description="TruthLens target jurisdiction context.")


class NormalizedEvidenceItem(BaseModel):
    """Normalized evidence candidate model.

    Represents a candidate article or public record retrieved from an evidence provider.
    """
    id: str
    title: str
    publisher: Optional[str] = None
    source_url: str
    published_at: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    source_type: str = "news"  # 'official', 'news', 'fact_check'
    provider: str = "free_news_api"
    language: Optional[str] = None
    country: Optional[str] = None
    relationship: str = "INSUFFICIENT"  # 'SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'INSUFFICIENT'
    relevance: str = "Medium"  # 'High', 'Medium', 'Low'
    retrieval_timestamp: str


class FactPoint(BaseModel):
    text: str
    sources: List[str] = []


class MisleadingBreakdown(BaseModel):
    claimed: str
    supported_part: str
    misleading_part: str
    actual_information: str


class OfficialSourceItem(BaseModel):
    name: str
    title: str
    url: str
    published_at: Optional[str] = None
    relationship: str = "SUPPORTS"
    snippet: Optional[str] = None
    is_registry_fallback: bool = False


class TrustedNewsItem(BaseModel):
    publisher: str
    title: str
    url: str
    published_at: Optional[str] = None
    relationship: str = "SUPPORTS"
    snippet: Optional[str] = None


class FactCheckItem(BaseModel):
    publisher: str
    claim_reviewed: str
    rating: str
    url: str
    date: Optional[str] = None
    relationship: str = "CONTRADICTS"


class ClaimBreakdownItem(BaseModel):
    claim: str
    verdict: str  # 'SUPPORTED', 'CONTRADICTED', 'MISLEADING', 'INSUFFICIENT'
    verdict_label: str
    evidence_score: Optional[int] = None
    relationship: str = "INSUFFICIENT"
    sources_count: int = 0
    key_sources: List[str] = []


class MatrixItem(BaseModel):
    source: str
    publisher: str
    source_type: str
    relationship: str
    relevance: str
    title: str
    url: str
    snippet: Optional[str] = None


class ScoreFactor(BaseModel):
    factor: str
    impact: str  # '+30 pts', '-50 pts', 'Neutral'
    description: str


class EvidenceSearchResponse(BaseModel):
    """Normalized search & verification response returned to the frontend."""
    claim: str
    jurisdiction: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    total_found: int = 0
    results_count: int = 0
    provider: str = "free_news_api"
    took_ms: Optional[int] = None

    # Verification Core Engine Results
    verdict: str = "INSUFFICIENT"  # 'SUPPORTED', 'CONTRADICTED', 'MISLEADING', 'INSUFFICIENT'
    verdict_label: str = "INFORMATION CANNOT BE VERIFIED"
    evidence_score: Optional[int] = None
    evidence_strength: str = "Insufficient Evidence"
    summary: str = "Reliable evidence was not sufficient to determine whether this statement is correct."

    score_factors: List[ScoreFactor] = []
    facts: List[FactPoint] = []
    misleading_breakdown: Optional[MisleadingBreakdown] = None

    official_sources: List[OfficialSourceItem] = []
    trusted_news_sources: List[TrustedNewsItem] = []
    fact_checks: List[FactCheckItem] = []

    claim_breakdown: List[ClaimBreakdownItem] = []
    evidence_matrix: List[MatrixItem] = []
    results: List[NormalizedEvidenceItem] = []

    warning: Optional[str] = None


class EvidenceErrorDetail(BaseModel):
    code: str
    message: str


class EvidenceErrorResponse(BaseModel):
    error: EvidenceErrorDetail

