import re
import logging
import math
from typing import List, Dict, Any, Tuple, Optional
from urllib.parse import urlparse

from app.schemas.evidence import (
    NormalizedEvidenceItem,
    FactPoint,
    MisleadingBreakdown,
    OfficialSourceItem,
    TrustedNewsItem,
    FactCheckItem,
    ClaimBreakdownItem,
    MatrixItem,
    ScoreFactor,
)

logger = logging.getLogger("truthlens.services.verification_engine")

OFFICIAL_DOMAINS = [
    "gov.in", "pib.gov.in", "egazette.gov.in", "india.gov.in", "ipr.ap.gov.in",
    "ap.gov.in", "digitalmedia.telangana.gov.in", "telangana.gov.in",
    "dipr.tn.gov.in", "tn.gov.in", "andaman.gov.in", "dipr.jk.gov.in",
    "jk.gov.in", "nic.in", "isro.gov.in"
]

TRUSTED_NEWS_PUBLISHERS = [
    "reuters", "associated press", "ap news", "bbc", "al jazeera", "the guardian",
    "deutsche welle", "dw", "france 24", "the hindu", "indian express", "ndtv",
    "times of india", "hindustan times", "business standard", "livemint", "anipress", "ptinews"
]

FACTCHECK_PUBLISHERS = [
    "alt news", "altnews", "boom", "boomlive", "pib fact check", "factly",
    "the quint fact check", "snopes", "politifact", "full fact", "google fact check"
]

HIGH_STAKES_KEYWORDS = [
    "killed", "dead", "died", "death", "assassinated", "shot", "murdered", "fatal",
    "arrested", "in jail", "resigned", "resignation", "critical condition", "passed away", "hospitalized"
]

CONFIRM_KEYWORDS = [
    "succesfully", "successfully", "landed", "launched", "announces", "announced",
    "approved", "confirms", "confirmed", "begins", "pact", "official statement",
    "reports", "reported", "verified", "true"
]

DIRECT_DEBUNK_PHRASES = (
    "claim is false", "false claim", "fake claim", "claim is fake",
    "debunked", "refuted", "baseless", "fabricated", "untrue",
    "disproven", "incorrect", "misleading claim", "hoax", "is alive",
    "remains alive", "not dead",
)

CLAIM_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
    "for", "from", "had", "has", "have", "he", "her", "hers", "him", "his",
    "i", "in", "is", "it", "its", "of", "on", "or", "our", "ours", "she",
    "that", "the", "their", "theirs", "them", "they", "this", "to", "was",
    "we", "were", "which", "who", "will", "with", "would", "you", "your",
    "do", "does", "did", "not", "never", "doesn", "don", "didn", "isn", "aren",
}

NEGATION_PHRASES = (
    "did not", "does not", "do not", "has not", "have not", "had not",
    "was not", "were not", "is not", "are not", "never", "no evidence",
    "not true", "not approved", "not confirmed", "denied", "rejects",
    "didn't", "doesn't", "don't", "isn't", "aren't", "wasn't", "weren't",
    "no report", "no reports", "without evidence",
)


class VerificationEngine:
    """Deterministic, evidence-grounded verification analysis engine.

    Computes:
    - High-stakes entity event verification (prevents false positive stance matching on death/arrest rumors)
    - Source authority classification (Official, Trusted News, Fact Check)
    - Strict evidence-grounded stance analysis (SUPPORTS, CONTRADICTS, CONTEXT, INSUFFICIENT)
    - Deterministic Evidence Support Score (0 to 100) with explainable score factors
    - Evidence-grounded factual points with retrieved-source attribution
    - Multi-claim decomposition & individual stance evaluations

    The 0-100 evidence_score represents support for the submitted claim, not the
    probability that it is true. A low score can accompany a well-supported
    contradiction; insufficient or unreliable evidence has no numeric score.
    """

    def analyze(
        self,
        claim: str,
        jurisdiction: str,
        evidence_items: List[NormalizedEvidenceItem],
        fact_check_api_results: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Perform comprehensive evidence analysis."""
        clean_claim = claim.strip()
        
        # 1. Classify evidence items into categories and assign NLI stance
        classified_items = self._classify_and_score_items(clean_claim, evidence_items)
        
        # Integrate Google Fact Check API results if available
        fact_check_items = self._process_fact_checks(clean_claim, fact_check_api_results or [])

        # 2. Extract specific source groups
        official_sources = self._extract_official_sources(jurisdiction, classified_items)
        trusted_news_sources = self._extract_trusted_news(classified_items)
        all_fact_checks = fact_check_items + self._extract_fact_checks_from_items(classified_items)

        # 3. Perform Claim Decomposition
        sub_claims = self._decompose_claim(clean_claim)
        claim_breakdowns = self._evaluate_sub_claims(sub_claims, classified_items, all_fact_checks)

        # 4. Calculate overall Evidence Support Score & Verdict
        verdict, score, strength, score_factors = self._calculate_verdict_and_score(
            classified_items,
            all_fact_checks,
            claim_breakdowns
        )

        # 5. Generate an evidence-grounded summary and source-traceable facts
        summary = self._generate_summary(
            verdict, clean_claim, classified_items, official_sources, trusted_news_sources, all_fact_checks
        )
        facts = self._generate_factual_points(
            verdict, clean_claim, classified_items, official_sources, trusted_news_sources, all_fact_checks
        )

        # 6. Generate Misleading Breakdown if verdict is MISLEADING
        misleading_breakdown = None
        if verdict == "MISLEADING":
            misleading_breakdown = self._generate_misleading_breakdown(
                clean_claim, classified_items, claim_breakdowns
            )

        # 7. Build Evidence Matrix
        evidence_matrix = self._build_evidence_matrix(classified_items)

        return {
            "verdict": verdict,
            "verdict_label": self._get_verdict_label(verdict),
            "evidence_score": score,
            "evidence_strength": strength,
            "summary": summary,
            "score_factors": score_factors,
            "facts": facts,
            "misleading_breakdown": misleading_breakdown,
            "official_sources": official_sources,
            "trusted_news_sources": trusted_news_sources,
            "fact_checks": all_fact_checks,
            "claim_breakdown": claim_breakdowns,
            "evidence_matrix": evidence_matrix,
            "processed_items": classified_items,
        }

    def _classify_and_score_items(
        self, claim: str, items: List[NormalizedEvidenceItem]
    ) -> List[NormalizedEvidenceItem]:
        """Categorize sources and assign a conservative lexical evidence stance."""
        claim_terms = self._claim_terms(claim)
        claim_is_negated = any(phrase in claim.lower() for phrase in NEGATION_PHRASES)
        claim_is_debunked = any(phrase in claim.lower() for phrase in DIRECT_DEBUNK_PHRASES)
        claim_has_high_stakes = any(self._contains_phrase(claim, kw) for kw in HIGH_STAKES_KEYWORDS)
        for item in items:
            combined_text = self._evidence_text(item)
            publisher_lower = (item.publisher or "").lower()
            evidence_terms = set(re.findall(r"\b[\w']+\b", combined_text))
            matched_terms = claim_terms.intersection(evidence_terms)
            coverage = len(matched_terms) / max(len(claim_terms), 1)

            # Classify Source Type
            if self._is_official_source(item):
                item.source_type = "official"
            elif any(fc in publisher_lower or fc in combined_text for fc in FACTCHECK_PUBLISHERS):
                item.source_type = "fact_check"
            else:
                item.source_type = "news"

            if coverage >= 0.5 and len(matched_terms) >= min(2, len(claim_terms)):
                item.relevance = "High"
            elif coverage >= 0.25 and matched_terms:
                item.relevance = "Medium"
            else:
                item.relevance = "Low"

            if item.relevance == "Low":
                item.relationship = "INSUFFICIENT"
                continue

            relevant_sentences = self._relevant_sentences(combined_text, claim_terms)
            has_direct_contradiction = any(
                self._sentence_contradicts(sentence, claim_terms, claim_is_negated, claim_is_debunked)
                for sentence in relevant_sentences
            )
            has_explicit_confirmation = any(
                any(phrase in sentence for phrase in CONFIRM_KEYWORDS)
                for sentence in relevant_sentences
            )
            has_event_match = any(
                self._contains_phrase(combined_text, event) for event in HIGH_STAKES_KEYWORDS
                if self._contains_phrase(claim, event)
            )

            if has_direct_contradiction:
                item.relationship = "CONTRADICTS"
            elif claim_has_high_stakes:
                # A name-only mention, including an unrelated public appearance, is not
                # evidence for or against a high-stakes event claim.
                if has_event_match and relevant_sentences and (has_explicit_confirmation or coverage >= 0.75):
                    item.relationship = "SUPPORTS"
                else:
                    item.relationship = "CONTEXT"
            elif relevant_sentences and coverage >= 0.75:
                item.relationship = "SUPPORTS"
            else:
                item.relationship = "CONTEXT"

        return items

    @staticmethod
    def _evidence_text(item: NormalizedEvidenceItem) -> str:
        """Return only article text fields, ignoring malformed or absent values."""
        fields = (item.title, item.description, item.content)
        return " ".join(value.strip() for value in fields if isinstance(value, str) and value.strip()).lower()

    @staticmethod
    def _claim_terms(text: str) -> set:
        return {
            token for token in re.findall(r"\b[\w']+\b", text.lower())
            if token not in CLAIM_STOP_WORDS and len(token) > 2
        }

    @staticmethod
    def _contains_phrase(text: str, phrase: str) -> bool:
        return re.search(r"\b" + re.escape(phrase) + r"\b", text.lower()) is not None

    @staticmethod
    def _is_official_source(item: NormalizedEvidenceItem) -> bool:
        domain = VerificationEngine._get_domain(item.source_url).split(":")[0].removeprefix("www.")
        return any(domain == suffix or domain.endswith("." + suffix) for suffix in OFFICIAL_DOMAINS)

    @staticmethod
    def _is_trusted_source(item: NormalizedEvidenceItem) -> bool:
        domain = VerificationEngine._get_domain(item.source_url).lower().removeprefix("www.")
        trusted_domains = (
            "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "aljazeera.com",
            "theguardian.com", "dw.com", "france24.com", "thehindu.com",
            "indianexpress.com", "ndtv.com", "timesofindia.indiatimes.com",
            "hindustantimes.com", "business-standard.com", "livemint.com",
            "aninews.in", "ptinews.com", "prsindia.org", "altnews.in",
            "boomlive.in", "factly.in", "snopes.com", "politifact.com",
            "fullfact.org", "factcheck.org", "thequint.com",
        )
        return (
            VerificationEngine._is_official_source(item)
            or any(domain == suffix or domain.endswith("." + suffix) for suffix in trusted_domains)
        )

    @classmethod
    def _relevant_sentences(cls, evidence_text: str, claim_terms: set) -> List[str]:
        if not claim_terms:
            return []
        sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+|\n+", evidence_text) if sentence.strip()]
        threshold = max(1, math.ceil(len(claim_terms) * 0.35))
        return [
            sentence for sentence in sentences
            if len(claim_terms.intersection(re.findall(r"\b[\w']+\b", sentence))) >= threshold
        ]

    @staticmethod
    def _sentence_contradicts(
        sentence: str,
        claim_terms: set,
        claim_is_negated: bool = False,
        claim_is_debunked: bool = False,
    ) -> bool:
        sentence_terms = set(re.findall(r"\b[\w']+\b", sentence))
        if not claim_terms.intersection(sentence_terms):
            return False
        if any(phrase in sentence for phrase in DIRECT_DEBUNK_PHRASES):
            return not claim_is_debunked
        sentence_is_negated = any(phrase in sentence for phrase in NEGATION_PHRASES)
        return sentence_is_negated != claim_is_negated

    def _process_fact_checks(self, claim: str, raw_fact_checks: List[Dict[str, Any]]) -> List[FactCheckItem]:
        """Convert raw Google Fact Check API results into standard FactCheckItem objects."""
        items: List[FactCheckItem] = []
        claim_terms = self._claim_terms(claim)
        for fc in raw_fact_checks:
            if not isinstance(fc, dict):
                continue
            publisher_data = fc.get("publisher")
            publisher = publisher_data.get("name", "Fact Checker") if isinstance(publisher_data, dict) else "Fact Checker"
            claim_rev = fc.get("claimReviewed")
            rating = fc.get("textualRating")
            if not isinstance(publisher, str) or not publisher.strip():
                publisher = "Fact Checker"
            if not isinstance(claim_rev, str) or not isinstance(rating, str) or not rating.strip():
                continue
            reviewed_terms = self._claim_terms(claim_rev)
            coverage = len(claim_terms.intersection(reviewed_terms)) / max(len(claim_terms), 1)
            if coverage < 0.4 or (len(claim_terms) > 1 and len(claim_terms.intersection(reviewed_terms)) < 2):
                continue

            rating_lower = rating.lower().strip()
            if any(term in rating_lower for term in ("mostly false", "false", "fake", "incorrect", "misleading", "untrue", "hoax", "pants on fire")):
                rel = "CONTRADICTS"
            elif any(term in rating_lower for term in ("mostly true", "true", "correct", "accurate", "verified")):
                rel = "SUPPORTS"
            else:
                rel = "CONTEXT"

            items.append(FactCheckItem(
                publisher=publisher,
                claim_reviewed=claim_rev,
                rating=rating,
                url=fc.get("url") if isinstance(fc.get("url"), str) else "",
                date=fc.get("reviewDate") if isinstance(fc.get("reviewDate"), str) else None,
                relationship=rel
            ))
        return items

    def _extract_official_sources(self, jurisdiction: str, items: List[NormalizedEvidenceItem]) -> List[OfficialSourceItem]:
        """Filter official sources retrieved from search."""
        official = []
        for item in items:
            if self._is_official_source(item):
                official.append(OfficialSourceItem(
                    name=item.publisher or self._domain_to_name(self._get_domain(item.source_url)),
                    title=item.title,
                    url=item.source_url,
                    published_at=item.published_at,
                    relationship=item.relationship,
                    snippet=item.description or item.content,
                    is_registry_fallback=False
                ))
        return official

    def _extract_trusted_news(self, items: List[NormalizedEvidenceItem]) -> List[TrustedNewsItem]:
        """Filter trusted national and international news sources."""
        news = []
        for item in items:
            domain = self._get_domain(item.source_url)
            if self._is_trusted_source(item) and not self._is_official_source(item):
                news.append(TrustedNewsItem(
                    publisher=item.publisher or self._domain_to_name(domain),
                    title=item.title,
                    url=item.source_url,
                    published_at=item.published_at,
                    relationship=item.relationship,
                    snippet=item.description or item.content
                ))
        return news

    def _extract_fact_checks_from_items(self, items: List[NormalizedEvidenceItem]) -> List[FactCheckItem]:
        """Extract fact check articles found in general search."""
        fcs = []
        for item in items:
            if item.source_type == "fact_check":
                fcs.append(FactCheckItem(
                    publisher=item.publisher or "Fact-Check Publisher",
                    claim_reviewed=item.title,
                    rating="Fact Check Article",
                    url=item.source_url,
                    date=item.published_at,
                    relationship=item.relationship
                ))
        return fcs

    def _decompose_claim(self, claim: str) -> List[str]:
        """Decompose complex claims into independent verifiable statements."""
        parts = re.split(r'\b(?:and|while|as well as|along with)\b', claim, flags=re.IGNORECASE)
        sub_claims = [p.strip() for p in parts if len(p.strip()) > 15]
        if not sub_claims:
            sub_claims = [claim]
        return sub_claims

    def _evaluate_sub_claims(
        self, sub_claims: List[str], items: List[NormalizedEvidenceItem], fact_checks: List[FactCheckItem]
    ) -> List[ClaimBreakdownItem]:
        """Reassess each clause independently to avoid whole-claim stance leakage."""
        breakdowns = []
        for sub in sub_claims:
            sub_terms = self._claim_terms(sub)
            clause_items = self._classify_and_score_items(
                sub, [item.model_copy(deep=True) for item in items]
            )
            matching_items = [
                item for item in clause_items
                if item.relevance != "Low"
                and item.relationship in ("SUPPORTS", "CONTRADICTS")
                and self._is_trusted_source(item)
            ]
            matching_checks = [
                fact_check for fact_check in fact_checks
                if len(sub_terms.intersection(self._claim_terms(fact_check.claim_reviewed)))
                / max(len(sub_terms), 1) >= 0.4
            ]
            verdict, score, _, _ = self._calculate_verdict_and_score(
                clause_items, matching_checks, []
            )
            v_label = {
                "SUPPORTED": "Supported by evidence",
                "CONTRADICTED": "Contradicted by evidence",
                "MISLEADING": "Mixed evidence for this clause",
                "INSUFFICIENT": "Insufficient evidence",
            }[verdict]
            rel = {
                "SUPPORTED": "SUPPORTS",
                "CONTRADICTED": "CONTRADICTS",
                "MISLEADING": "CONTEXT",
                "INSUFFICIENT": "INSUFFICIENT",
            }[verdict]

            sources_list = list(dict.fromkeys(
                it.publisher or self._domain_to_name(self._get_domain(it.source_url))
                for it in matching_items if it.relationship in ("SUPPORTS", "CONTRADICTS")
            ))
            sources_list.extend(
                check.publisher for check in matching_checks
                if check.relationship in ("SUPPORTS", "CONTRADICTS")
                and check.publisher not in sources_list
            )
            independent_source_count = len({
                self._report_group_key(item) for item in matching_items
            }) + len({check.publisher.lower() for check in matching_checks})

            breakdowns.append(ClaimBreakdownItem(
                claim=sub,
                verdict=verdict,
                verdict_label=v_label,
                evidence_score=score,
                relationship=rel,
                sources_count=independent_source_count,
                key_sources=sources_list[:3]
            ))
        return breakdowns

    def _calculate_verdict_and_score(
        self,
        items: List[NormalizedEvidenceItem],
        fact_checks: List[FactCheckItem],
        sub_claims: List[ClaimBreakdownItem]
    ) -> Tuple[str, Optional[int], str, List[ScoreFactor]]:
        """Return a verdict and claim-support score from independent, reliable evidence."""
        support_votes = self._reliable_article_votes(items, "SUPPORTS")
        contradiction_votes = self._reliable_article_votes(items, "CONTRADICTS")
        support_checks = self._reliable_fact_check_votes(fact_checks, "SUPPORTS")
        contradiction_checks = self._reliable_fact_check_votes(fact_checks, "CONTRADICTS")
        supports = support_votes + support_checks
        contradicts = contradiction_votes + contradiction_checks

        sub_verdicts = {sub.verdict for sub in sub_claims}
        if len(sub_claims) > 1 and "SUPPORTED" in sub_verdicts and "CONTRADICTED" in sub_verdicts:
            return (
                "MISLEADING", 50, "Mixed Evidence",
                [ScoreFactor(
                    factor="Mixed material subclaims",
                    impact="50/100",
                    description="Retrieved reliable evidence supports at least one material clause and contradicts another."
                )]
            )

        if not supports and not contradicts:
            return (
                "INSUFFICIENT", None, "Insufficient Evidence",
                [ScoreFactor(
                    factor="No relevant reliable stance evidence",
                    impact="Not scored",
                    description="Retrieved material did not provide enough relevant, reliable evidence to support or contradict the claim."
                )]
            )

        if supports and contradicts:
            return (
                "MISLEADING", 50, "Mixed Evidence",
                [
                    ScoreFactor(
                        factor="Conflicting direct evidence",
                        impact="50/100",
                        description="Relevant reliable sources include both supporting and contradicting evidence; this score is not a probability."
                    )
                ]
            )

        votes = supports or contradicts
        verdict = "SUPPORTED" if supports else "CONTRADICTED"
        independent_count = len(votes)
        reliability = sum(vote["reliability"] for vote in votes) / independent_count
        completeness = sum(vote["completeness"] for vote in votes) / independent_count
        corroboration = min(max(independent_count - 1, 0), 2) * 0.05
        confidence = min(0.95, reliability * (0.65 + 0.2 * completeness + corroboration))
        score = round(55 + 45 * confidence) if verdict == "SUPPORTED" else round(45 * (1 - confidence))
        direction = "supports" if verdict == "SUPPORTED" else "contradicts"
        factors = [
            ScoreFactor(
                factor="Relevant direct evidence",
                impact=f"{independent_count} independent source(s)",
                description=f"Only relevant {direction} reports from identified reliable sources contribute to this assessment."
            ),
            ScoreFactor(
                factor="Source reliability and completeness",
                impact=f"{round(reliability * 100)}% reliability weight",
                description="The score accounts for source classification and whether descriptive or full article text was available. Duplicate reports do not add independent weight."
            )
        ]
        strength = "Strong Evidence" if confidence >= 0.75 else "Moderate Evidence"
        return verdict, score, strength, factors

    def _reliable_article_votes(self, items: List[NormalizedEvidenceItem], relationship: str) -> List[Dict[str, float]]:
        votes: Dict[str, Dict[str, float]] = {}
        for item in items:
            if item.relationship != relationship or item.relevance == "Low" or not self._is_trusted_source(item):
                continue
            group_key = VerificationEngine._report_group_key(item)
            if not group_key:
                continue
            reliability = 1.0 if self._is_official_source(item) else 0.85
            has_full_content = isinstance(item.content, str) and len(item.content) >= 80
            completeness = 1.0 if has_full_content else 0.85 if item.description else 0.65
            previous = votes.get(group_key)
            vote = {"reliability": reliability, "completeness": completeness}
            if previous is None or vote["completeness"] > previous["completeness"]:
                votes[group_key] = vote
        return list(votes.values())

    @staticmethod
    def _report_group_key(item: NormalizedEvidenceItem) -> str:
        content = re.sub(r"\W+", " ", item.content.lower()).strip() if isinstance(item.content, str) else ""
        title = re.sub(r"\W+", " ", (item.title or "").lower()).strip()
        return content or title

    @staticmethod
    def _reliable_fact_check_votes(fact_checks: List[FactCheckItem], relationship: str) -> List[Dict[str, float]]:
        votes: Dict[str, Dict[str, float]] = {}
        known_reviewers = {
            re.sub(r"\W+", " ", name.lower()).strip()
            for name in FACTCHECK_PUBLISHERS + TRUSTED_NEWS_PUBLISHERS
        }
        for fact_check in fact_checks:
            if fact_check.relationship != relationship or not fact_check.url:
                continue
            key = re.sub(r"\W+", " ", fact_check.publisher.lower()).strip()
            if key in known_reviewers:
                votes[key] = {"reliability": 0.85, "completeness": 0.9}
        return list(votes.values())

    def _generate_summary(
        self,
        verdict: str,
        claim: str,
        items: List[NormalizedEvidenceItem],
        official: List[OfficialSourceItem],
        news: List[TrustedNewsItem],
        fact_checks: List[FactCheckItem],
    ) -> str:
        """Summarize only retrieved, relevant reports; never imply absent searches."""
        support = [item for item in items if item.relationship == "SUPPORTS" and self._is_trusted_source(item)]
        contradiction = [item for item in items if item.relationship == "CONTRADICTS" and self._is_trusted_source(item)]
        selected = support if verdict == "SUPPORTED" else contradiction if verdict == "CONTRADICTED" else support + contradiction
        snippets = []
        for item in selected[:2]:
            snippet = self._evidence_excerpt(item, claim)
            if snippet:
                source = item.publisher or self._domain_to_name(self._get_domain(item.source_url))
                snippets.append(f"{source} reports: “{snippet}”")
        check_relationship = "SUPPORTS" if verdict == "SUPPORTED" else "CONTRADICTS"
        for fact_check in fact_checks:
            if fact_check.relationship == check_relationship and fact_check.url:
                snippets.append(
                    f"{fact_check.publisher} rated the reviewed claim “{fact_check.rating}”: "
                    f"“{fact_check.claim_reviewed}”"
                )
                break
        if verdict == "SUPPORTED" and snippets:
            return "Retrieved evidence directly supports the claim. " + " ".join(snippets)
        if verdict == "CONTRADICTED" and snippets:
            return "Retrieved evidence directly conflicts with the claim. " + " ".join(snippets)
        if verdict == "MISLEADING" and snippets:
            return "Retrieved reliable evidence contains conflicting accounts. " + " ".join(snippets)
        return "The completed search did not provide enough relevant, reliable evidence to verify the claim."

    def _generate_factual_points(
        self,
        verdict: str,
        claim: str,
        items: List[NormalizedEvidenceItem],
        official: List[OfficialSourceItem],
        news: List[TrustedNewsItem],
        fact_checks: List[FactCheckItem]
    ) -> List[FactPoint]:
        """Return text excerpts traceable to relevant retrieved articles or reviews."""
        points: List[FactPoint] = []
        seen = set()
        for item in items:
            if item.relationship == "INSUFFICIENT" or item.relevance == "Low":
                continue
            excerpt = self._evidence_excerpt(item, claim)
            if not excerpt or excerpt in seen:
                continue
            seen.add(excerpt)
            publisher = item.publisher or self._domain_to_name(self._get_domain(item.source_url))
            points.append(FactPoint(text=excerpt, sources=[publisher]))
            if len(points) == 8:
                return points

        for fact_check in fact_checks:
            if fact_check.relationship == "CONTEXT" or not fact_check.url:
                continue
            text = f"Fact-check rating: {fact_check.rating} — {fact_check.claim_reviewed}"
            if text not in seen:
                seen.add(text)
                points.append(FactPoint(text=text, sources=[fact_check.publisher]))
            if len(points) == 8:
                break
        return points

    def _evidence_excerpt(self, item: NormalizedEvidenceItem, claim: str) -> str:
        text = self._evidence_text(item)
        terms = self._claim_terms(claim)
        candidates = self._relevant_sentences(text, terms)
        if candidates:
            candidate = max(
                candidates,
                key=lambda sentence: len(terms.intersection(re.findall(r"\b[\w']+\b", sentence)))
            )
        else:
            candidate = item.title if isinstance(item.title, str) else ""
            title_terms = set(re.findall(r"\b[\w']+\b", candidate.lower()))
            if len(terms.intersection(title_terms)) / max(len(terms), 1) < 0.35:
                return ""
        candidate = re.sub(r"\s+", " ", candidate).strip()
        return candidate[:400]

    def _generate_misleading_breakdown(
        self,
        claim: str,
        items: List[NormalizedEvidenceItem],
        sub_claims: Optional[List[ClaimBreakdownItem]] = None,
    ) -> MisleadingBreakdown:
        """Describe mixed evidence using retrieved excerpts rather than assumptions."""
        supporting = next(
            (self._evidence_excerpt(item, claim) for item in items
             if item.relationship == "SUPPORTS" and self._is_trusted_source(item)),
            ""
        )
        contradicting = next(
            (self._evidence_excerpt(item, claim) for item in items
             if item.relationship == "CONTRADICTS" and self._is_trusted_source(item)),
            ""
        )
        if sub_claims and (not supporting or not contradicting):
            for sub_claim in sub_claims:
                if sub_claim.verdict not in ("SUPPORTED", "CONTRADICTED"):
                    continue
                relation = sub_claim.relationship
                for original in items:
                    candidate = original.model_copy(deep=True)
                    self._classify_and_score_items(sub_claim.claim, [candidate])
                    if candidate.relationship == relation and self._is_trusted_source(candidate):
                        excerpt = self._evidence_excerpt(candidate, sub_claim.claim)
                        if relation == "SUPPORTS" and not supporting:
                            supporting = excerpt
                        elif relation == "CONTRADICTS" and not contradicting:
                            contradicting = excerpt
                        break
        return MisleadingBreakdown(
            claimed=claim,
            supported_part=supporting or "No retrieved excerpt directly supports this claim.",
            misleading_part=contradicting or "No retrieved excerpt directly contradicts this claim.",
            actual_information="The retrieved reliable evidence is mixed; the claim cannot be treated as fully supported."
        )

    def _build_evidence_matrix(self, items: List[NormalizedEvidenceItem]) -> List[MatrixItem]:
        """Build the structured evidence matrix table."""
        matrix = []
        for item in items:
            domain = self._get_domain(item.source_url)
            matrix.append(MatrixItem(
                source=domain,
                publisher=item.publisher or self._domain_to_name(domain),
                source_type=item.source_type.capitalize(),
                relationship=item.relationship,
                relevance=item.relevance,
                title=item.title,
                url=item.source_url,
                snippet=item.description
            ))
        return matrix

    @staticmethod
    def _get_verdict_label(verdict: str) -> str:
        mapping = {
            "SUPPORTED": "INFORMATION APPEARS CORRECT",
            "CONTRADICTED": "INFORMATION IS INCORRECT",
            "MISLEADING": "INFORMATION IS MISLEADING / PARTIALLY CORRECT",
            "INSUFFICIENT": "UNVERIFIED — NO RELIABLE CONFIRMATION FOUND"
        }
        return mapping.get(verdict, "UNVERIFIED — NO RELIABLE CONFIRMATION FOUND")

    @staticmethod
    def _get_domain(url: str) -> str:
        try:
            return urlparse(url).netloc.lower()
        except Exception:
            return "external-source.org"

    @staticmethod
    def _domain_to_name(domain: str) -> str:
        clean = domain.replace("www.", "")
        parts = clean.split(".")
        if len(parts) >= 2:
            return parts[0].capitalize()
        return clean.capitalize()
