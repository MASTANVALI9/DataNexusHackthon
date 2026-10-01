import asyncio
import unittest
from unittest.mock import patch

import httpx

from app.schemas.evidence import EvidenceSearchRequest, NormalizedEvidenceItem
from app.services.evidence_orchestrator import EvidenceOrchestrator
from app.services.providers.free_news_api import FreeNewsAPIError, FreeNewsProvider
from app.services.providers.google_fact_check import GoogleFactCheckAPIError, GoogleFactCheckProvider
from app.services.verification_engine import VerificationEngine


class TestVerificationEngine(unittest.TestCase):
    def setUp(self):
        self.engine = VerificationEngine()

    @staticmethod
    def evidence(
        title,
        description=None,
        content=None,
        publisher="Reuters",
        url="https://www.reuters.com/world/example-story",
    ):
        return NormalizedEvidenceItem(
            id=title,
            title=title,
            publisher=publisher,
            source_url=url,
            description=description,
            content=content,
            retrieval_timestamp="2026-10-01T00:00:00Z",
        )

    def test_supporting_statement_in_full_article_body_is_used(self):
        claim = "The national regulator approved the new treatment on October 1"
        item = self.evidence(
            "Regulator publishes its routine bulletin",
            description="A routine notice was released.",
            content="The national regulator approved the new treatment on October 1 after its review.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(item.relationship, "SUPPORTS")
        self.assertEqual(result["verdict"], "SUPPORTED")
        self.assertIsInstance(result["evidence_score"], int)
        self.assertIn("approved the new treatment", result["summary"])
        self.assertTrue(any("approved the new treatment" in fact.text for fact in result["facts"]))

    def test_relevant_paraphrase_can_support_without_exact_wording(self):
        claim = "The national regulator approved the new treatment"
        item = self.evidence(
            "Treatment approval announced",
            content="The national regulator cleared the new treatment after completing its review.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(result["verdict"], "SUPPORTED")

    def test_unrelated_evidence_does_not_support_or_appear_as_a_fact(self):
        claim = "The national regulator approved the new treatment"
        item = self.evidence("Heavy rain disrupts transport in several districts")

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(item.relationship, "INSUFFICIENT")
        self.assertEqual(result["verdict"], "INSUFFICIENT")
        self.assertIsNone(result["evidence_score"])
        self.assertEqual(result["facts"], [])

    def test_no_evidence_never_automatically_contradicts_cash_claim(self):
        claim = "Government announces ₹15,000 cash transfer to all citizens"

        result = self.engine.analyze(claim, "Central Government / India", [])

        self.assertEqual(result["verdict"], "INSUFFICIENT")
        self.assertIsNone(result["evidence_score"])
        self.assertEqual(result["facts"], [])

    def test_cash_claim_requires_direct_reliable_contradictory_evidence(self):
        claim = "Government announces ₹15,000 cash transfer to all citizens"
        item = self.evidence(
            "Government says viral ₹15,000 cash transfer claim is false",
            content="The government says the viral ₹15,000 cash transfer claim is false.",
            publisher="Press Information Bureau",
            url="https://pib.gov.in/example",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(item.relationship, "CONTRADICTS")
        self.assertEqual(result["verdict"], "CONTRADICTED")
        self.assertLess(result["evidence_score"], 50)

    def test_chandrayaan_keyword_cannot_override_unrelated_evidence(self):
        claim = "ISRO Chandrayaan-3 successfully landed on lunar south pole on August 23"
        item = self.evidence("Unrelated local weather update", description="Rain expected this week.")

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(result["verdict"], "INSUFFICIENT")
        self.assertIsNone(result["evidence_score"])

    def test_high_stakes_direct_support_does_not_crash(self):
        claim = "Rahul Gandhi died after an incident"
        item = self.evidence(
            "Reuters reports Rahul Gandhi died after an incident",
            publisher="Reuters",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(item.relationship, "SUPPORTS")
        self.assertEqual(result["verdict"], "SUPPORTED")

    def test_high_stakes_unrelated_evidence_remains_unverified(self):
        claim = "Rahul Gandhi died after an incident"
        item = self.evidence(
            "Rahul Gandhi addresses a public rally",
            description="The politician spoke at a political event.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertNotEqual(item.relationship, "SUPPORTS")
        self.assertEqual(result["verdict"], "INSUFFICIENT")
        self.assertIsNone(result["evidence_score"])

    def test_high_stakes_claim_without_evidence_remains_unverified(self):
        result = self.engine.analyze(
            "Rahul Gandhi died after an incident",
            "Central Government / India",
            [],
        )

        self.assertEqual(result["verdict"], "INSUFFICIENT")
        self.assertIsNone(result["evidence_score"])

    def test_generic_high_stakes_mention_does_not_become_confirmation(self):
        claim = "A public official was arrested yesterday"
        item = self.evidence(
            "Public official attends a conference",
            description="The official gave remarks at the conference.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertNotEqual(result["verdict"], "SUPPORTED")

    def test_partial_evidence_is_not_full_support(self):
        claim = "The regulator approved treatment for children on October 1"
        item = self.evidence(
            "Treatment review continues",
            content="The regulator continues to review the treatment; approval is pending.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertNotEqual(item.relationship, "SUPPORTS")
        self.assertNotEqual(result["verdict"], "SUPPORTED")

    def test_material_subclaims_with_opposing_evidence_are_mixed(self):
        claim = "The regulator approved the new medicine and the agency rejected the funding plan"
        supporting = self.evidence(
            "Regulator approved new medicine",
            content="The regulator approved the new medicine.",
            url="https://reuters.com/medicine",
        )
        contradicting = self.evidence(
            "Agency did not reject funding plan",
            content="The agency did not reject the funding plan.",
            publisher="BBC",
            url="https://bbc.com/funding",
        )

        result = self.engine.analyze(claim, "Central Government / India", [supporting, contradicting])

        self.assertEqual(result["verdict"], "MISLEADING")
        self.assertEqual(result["evidence_score"], 50)
        self.assertIn("approved the new medicine", result["misleading_breakdown"].supported_part)
        self.assertIn("did not reject", result["misleading_breakdown"].misleading_part)

    def test_direct_contradiction_is_distinguished_from_irrelevance(self):
        claim = "The national regulator approved the new treatment"
        item = self.evidence(
            "Regulator says treatment was not approved",
            content="The national regulator did not approve the new treatment.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(item.relationship, "CONTRADICTS")
        self.assertEqual(result["verdict"], "CONTRADICTED")

    def test_matching_negated_claim_is_supported_not_misclassified_as_contradicted(self):
        claim = "The regulator did not approve the treatment"
        item = self.evidence(
            "Regulator did not approve treatment",
            content="The regulator did not approve the treatment.",
        )

        result = self.engine.analyze(claim, "Central Government / India", [item])

        self.assertEqual(item.relationship, "SUPPORTS")
        self.assertEqual(result["verdict"], "SUPPORTED")

    def test_unrelated_fact_check_is_ignored(self):
        result = self.engine.analyze(
            "The national regulator approved the new treatment",
            "Central Government / India",
            [],
            fact_check_api_results=[{
                "claimReviewed": "A football club won its local match",
                "publisher": {"name": "Reuters"},
                "textualRating": "False",
                "url": "https://example.com/fact-check",
            }],
        )

        self.assertEqual(result["fact_checks"], [])
        self.assertEqual(result["verdict"], "INSUFFICIENT")

    def test_fact_check_rating_is_not_assumed_to_be_support(self):
        result = self.engine.analyze(
            "The national regulator approved the new treatment",
            "Central Government / India",
            [],
            fact_check_api_results=[{
                "claimReviewed": "The national regulator approved the new treatment",
                "publisher": {"name": "Reuters"},
                "textualRating": "Unclear",
                "url": "https://example.com/fact-check",
            }],
        )

        self.assertEqual(result["fact_checks"][0].relationship, "CONTEXT")
        self.assertEqual(result["verdict"], "INSUFFICIENT")

    def test_duplicate_syndicated_article_does_not_increase_independent_votes(self):
        claim = "The national regulator approved the new treatment"
        body = "The national regulator approved the new treatment after a detailed review."
        one = self.evidence("Regulator approves new treatment", content=body, url="https://reuters.com/story")
        copy = self.evidence(
            "Another headline for syndicated report",
            content=body,
            publisher="BBC",
            url="https://bbc.com/story",
        )

        one_result = self.engine.analyze(claim, "Central Government / India", [one])
        two_result = self.engine.analyze(claim, "Central Government / India", [one, copy])

        self.assertEqual(one_result["evidence_score"], two_result["evidence_score"])

    def test_summary_never_inserts_unretrieved_sources_or_facts(self):
        result = self.engine.analyze("Rahul Gandhi died", "Central Government / India", [])

        self.assertNotIn("PIB", result["summary"])
        self.assertNotIn("Reuters", result["summary"])
        self.assertEqual(result["facts"], [])

    def test_null_score_and_api_response_fields_remain_compatible(self):
        result = self.engine.analyze("A claim with no retrieved evidence", "Central Government / India", [])
        expected_fields = {
            "claim", "jurisdiction", "country", "language", "total_found", "results_count",
            "provider", "took_ms", "verdict", "verdict_label", "evidence_score",
            "evidence_strength", "summary", "score_factors", "facts", "misleading_breakdown",
            "official_sources", "trusted_news_sources", "fact_checks", "claim_breakdown",
            "evidence_matrix", "results", "warning",
        }
        response = {
            "claim": "A claim with no retrieved evidence",
            "jurisdiction": "Central Government / India",
            "verdict": result["verdict"],
            "verdict_label": result["verdict_label"],
            "evidence_score": result["evidence_score"],
            "evidence_strength": result["evidence_strength"],
            "summary": result["summary"],
            "score_factors": result["score_factors"],
            "facts": result["facts"],
            "misleading_breakdown": result["misleading_breakdown"],
            "official_sources": result["official_sources"],
            "trusted_news_sources": result["trusted_news_sources"],
            "fact_checks": result["fact_checks"],
            "claim_breakdown": result["claim_breakdown"],
            "evidence_matrix": result["evidence_matrix"],
            "results": result["processed_items"],
        }

        from app.schemas.evidence import EvidenceSearchResponse
        validated = EvidenceSearchResponse(**response)

        self.assertIsNone(validated.evidence_score)
        self.assertEqual(set(validated.model_dump()), expected_fields)


class _FakeResponse:
    def __init__(self, status_code=200, payload=None, malformed=False):
        self.status_code = status_code
        self.payload = payload
        self.malformed = malformed

    def json(self):
        if self.malformed:
            raise ValueError("not JSON")
        return self.payload


class _FakeAsyncClient:
    response = _FakeResponse()
    exception = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, *args, **kwargs):
        if self.exception:
            raise self.exception
        return self.response


class TestProviderHandling(unittest.IsolatedAsyncioTestCase):
    def test_query_generation_preserves_claim_negation(self):
        queries = FreeNewsProvider._generate_search_queries(
            "The national regulator did not approve the new treatment"
        )

        self.assertTrue(any("not" in query.split() for query in queries))

    async def test_missing_optional_google_key_skips_network_call(self):
        provider = GoogleFactCheckProvider(api_key="")
        with patch("app.services.providers.google_fact_check.httpx.AsyncClient") as client:
            self.assertEqual(await provider.search_fact_checks("claim"), [])
            client.assert_not_called()

    async def test_free_news_malformed_payload_raises_safe_provider_error(self):
        provider = FreeNewsProvider()
        _FakeAsyncClient.response = _FakeResponse(payload={"results": "unexpected"})
        _FakeAsyncClient.exception = None
        with patch("app.services.providers.free_news_api.httpx.AsyncClient", _FakeAsyncClient):
            with self.assertRaises(FreeNewsAPIError) as caught:
                await provider._execute_single_query("claim")
        self.assertEqual(caught.exception.code, "PROVIDER_MALFORMED_RESPONSE")

    async def test_free_news_timeout_raises_safe_provider_error(self):
        provider = FreeNewsProvider()
        _FakeAsyncClient.exception = httpx.ReadTimeout("private diagnostic detail")
        with patch("app.services.providers.free_news_api.httpx.AsyncClient", _FakeAsyncClient):
            with self.assertRaises(FreeNewsAPIError) as caught:
                await provider._execute_single_query("claim")
        self.assertEqual(caught.exception.code, "PROVIDER_TIMEOUT")
        self.assertNotIn("private diagnostic detail", caught.exception.message)
        _FakeAsyncClient.exception = None

    async def test_google_malformed_response_is_not_reported_as_empty_search(self):
        provider = GoogleFactCheckProvider(api_key="test-key")
        _FakeAsyncClient.response = _FakeResponse(malformed=True)
        with patch("app.services.providers.google_fact_check.httpx.AsyncClient", _FakeAsyncClient):
            with self.assertRaises(GoogleFactCheckAPIError):
                await provider.search_fact_checks("claim")

    async def test_google_provider_failure_does_not_discard_news_results(self):
        item = NormalizedEvidenceItem(
            id="reuters-1",
            title="Regulator approves new treatment",
            publisher="Reuters",
            source_url="https://reuters.com/story",
            content="The national regulator approved the new treatment after review.",
            retrieval_timestamp="2026-10-01T00:00:00Z",
        )

        class NewsProvider:
            async def search(self, **kwargs):
                return {"items": [item], "total": 1}

        class FailedGoogleProvider:
            api_key = "configured"

            async def search_fact_checks(self, **kwargs):
                raise GoogleFactCheckAPIError("provider unavailable")

        orchestrator = EvidenceOrchestrator(NewsProvider(), FailedGoogleProvider())
        response = await orchestrator.search(EvidenceSearchRequest(claim="The national regulator approved the new treatment"))

        self.assertEqual(response.results_count, 1)
        self.assertEqual(response.verdict, "SUPPORTED")
        self.assertIn("google", response.warning.lower())

    async def test_news_failure_does_not_discard_fact_check_results(self):
        class FailedNewsProvider:
            async def search(self, **kwargs):
                raise FreeNewsAPIError("PROVIDER_TIMEOUT", "News search timed out.", 504)

        class GoogleProvider:
            api_key = "configured"

            async def search_fact_checks(self, **kwargs):
                return [{
                    "claimReviewed": "The national regulator approved the new treatment",
                    "publisher": {"name": "Reuters"},
                    "textualRating": "True",
                    "url": "https://example.com/review",
                }]

        orchestrator = EvidenceOrchestrator(FailedNewsProvider(), GoogleProvider())
        response = await orchestrator.search(EvidenceSearchRequest(claim="The national regulator approved the new treatment"))

        self.assertEqual(response.provider, "google_fact_check")
        self.assertEqual(len(response.fact_checks), 1)
        self.assertEqual(response.verdict, "SUPPORTED")
        self.assertIn("news", response.warning.lower())

    async def test_failure_of_all_configured_providers_is_not_an_empty_search(self):
        class FailedNewsProvider:
            async def search(self, **kwargs):
                raise FreeNewsAPIError("PROVIDER_TIMEOUT", "News provider timed out.", 504)

        class FailedGoogleProvider:
            api_key = "configured"

            async def search_fact_checks(self, **kwargs):
                raise GoogleFactCheckAPIError("Fact-check provider unavailable.")

        orchestrator = EvidenceOrchestrator(FailedNewsProvider(), FailedGoogleProvider())
        with self.assertRaises(FreeNewsAPIError) as caught:
            await orchestrator.search(EvidenceSearchRequest(claim="A claim to check"))
        self.assertEqual(caught.exception.status_code, 504)


if __name__ == "__main__":
    unittest.main()
