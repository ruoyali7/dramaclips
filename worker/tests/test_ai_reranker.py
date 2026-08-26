import os
import unittest
from unittest.mock import patch

from hook_worker.ai_reranker import RANKING_SCHEMA, _request, rerank


def candidate(identifier, score):
    return {
        "id": identifier,
        "rank": 1,
        "score": score,
        "transcript": "the truth is finally revealed",
        "sourceRanges": [{"episodeNumber": 1, "start": 10, "end": 35}],
        "scoreComponents": {},
        "rationale": "rule rationale",
    }


class RerankerTests(unittest.TestCase):
    def test_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            items = [candidate("a", 80)]
            self.assertIs(rerank(items, ""), items)

    @patch("hook_worker.ai_reranker._request")
    def test_enabled_reorders_and_records_explanation(self, request):
        request.return_value = [
            {"id": "a", "score": 0.4, "keep": True, "reason": "weak"},
            {"id": "b", "score": 0.9, "keep": True, "reason": "strong reveal"},
        ]
        with patch.dict(os.environ, {"HOOK_AI_RERANKER_ENABLED": "true"}):
            result = rerank([candidate("a", 80), candidate("b", 70)], "reveal")
        self.assertEqual([item["id"] for item in result], ["b", "a"])
        self.assertEqual(result[0]["scoreComponents"]["aiRerank"], 90.0)

    @patch("hook_worker.ai_reranker._request")
    def test_rejected_candidate_is_ranked_last_not_deleted(self, request):
        request.return_value = [
            {"id": "a", "score": 0.95, "keep": False, "reason": "incomplete"},
            {"id": "b", "score": 0.7, "keep": True, "reason": "complete"},
        ]
        with patch.dict(os.environ, {"HOOK_AI_RERANKER_ENABLED": "true"}):
            result = rerank([candidate("a", 80), candidate("b", 70)], "reveal")
        self.assertEqual([item["id"] for item in result], ["b", "a"])
        self.assertEqual(len(result), 2)

    @patch("hook_worker.ai_reranker._request")
    def test_incomplete_response_keeps_rule_ranking(self, request):
        request.return_value = [
            {"id": "a", "score": 0.9, "keep": True, "reason": "good"},
        ]
        with patch.dict(os.environ, {"HOOK_AI_RERANKER_ENABLED": "true"}):
            items = [candidate("a", 80), candidate("b", 70)]
            self.assertIs(rerank(items, "reveal"), items)

    @patch("hook_worker.ai_reranker.requests.post")
    def test_request_uses_transcript_and_strict_schema(self, post):
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {
            "output": [{
                "content": [{
                    "type": "output_text",
                    "text": '{"rankings":[]}',
                }],
            }],
        }
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            _request([{"id": "a", "transcript": "the truth"}], "reveal")
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["text"]["format"]["schema"], RANKING_SCHEMA)
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertIn("the truth", payload["input"][1]["content"][0]["text"])

    @patch("hook_worker.ai_reranker._request", side_effect=RuntimeError("offline"))
    def test_failure_keeps_rule_ranking(self, request):
        with patch.dict(os.environ, {"HOOK_AI_RERANKER_ENABLED": "true"}):
            items = [candidate("a", 80)]
            self.assertIs(rerank(items, ""), items)


if __name__ == "__main__":
    unittest.main()
