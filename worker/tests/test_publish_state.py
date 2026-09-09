import unittest
from unittest.mock import patch

from hook_worker import main as worker_main
from hook_worker.publish_state import (
    final_publish_status,
    find_publish_record,
    is_ambiguous_instagram_timeout,
    provider_request_id,
    publish_record_state,
    should_resume,
    terminal_operation,
)


class PublishStateTests(unittest.TestCase):
    def test_final_status_keeps_independent_platform_results(self):
        platforms = [{"source": "instagram"}, {"source": "facebook"}]
        self.assertEqual(
            final_publish_status(
                {"instagram": {"state": "failed"}, "facebook": {"state": "published"}},
                platforms,
                "publish",
            ),
            "failed",
        )
        self.assertEqual(
            final_publish_status(
                {"instagram": {"state": "outcome_unknown"}, "facebook": {"state": "published"}},
                platforms,
                "publish",
            ),
            "outcome_unknown",
        )

    def test_resumes_an_existing_nonterminal_provider_request(self):
        detail = {
            "state": "outcome_unknown",
            "publish": {"taskSetId": "request-1"},
        }
        self.assertEqual(provider_request_id(detail), "request-1")
        self.assertTrue(should_resume(detail))
        self.assertFalse(should_resume(detail, retry_requested=True))

    def test_accepts_direct_and_string_provider_request_ids(self):
        self.assertEqual(provider_request_id("request-1"), "request-1")
        self.assertEqual(provider_request_id({"taskSetId": "request-2"}), "request-2")
        self.assertEqual(
            provider_request_id({"publish": {"requestId": "request-3"}}),
            "request-3",
        )
        self.assertIsNone(provider_request_id("  "))

    def test_does_not_resume_an_already_published_platform(self):
        self.assertFalse(
            should_resume({"state": "published", "providerRequestId": "request-1"})
        )

    def test_finds_the_exact_publish_record(self):
        record = find_publish_record(
            {"data": [{"id": "other"}, {"id": "request-1", "taskSetStatus": "allsuccessful"}]},
            "request-1",
        )
        self.assertEqual(record["taskSetStatus"], "allsuccessful")

    def test_maps_records_fallback_terminal_states(self):
        self.assertEqual(
            publish_record_state({"taskSetStatus": "allsuccessful", "failedTotal": 0}),
            "published",
        )
        self.assertEqual(
            publish_record_state({"taskSetStatus": "completed", "failedTotal": 1}),
            "failed",
        )
        self.assertEqual(publish_record_state({"taskSetStatus": "pending"}), "processing")

    def test_instagram_timeout_without_post_data_is_ambiguous(self):
        self.assertTrue(is_ambiguous_instagram_timeout({"tasks": [{
            "platformName": "Instagram",
            "stageStatus": "fail",
            "errorMessage": "timeout of 30000ms exceeded",
            "publishId": None,
            "documentId": None,
            "openUrl": None,
        }]}))

    def test_instagram_timeout_recovers_post_id_from_records_permalink(self):
        details = {"tasks": [{
            "platformName": "Instagram",
            "errorMessage": "timeout of 30000ms exceeded",
        }]}
        records = {"data": [{
            "id": "request-1",
            "taskSetStatus": "completed",
            "failedTotal": 1,
            "openUrl": "https://www.instagram.com/reel/DdExample/",
        }]}
        with patch.object(worker_main, "yxer", side_effect=[details, records]):
            result = worker_main.query_publish_status(
                {"id": "package-1"}, "instagram", "request-1", None
            )
        self.assertEqual(result["state"], "published")
        self.assertEqual(worker_main.provider_post_id(result, "instagram"), "DdExample")

    def test_instagram_timeout_without_a_record_stays_processing(self):
        details = {"tasks": [{
            "platformName": "Instagram",
            "errorMessage": "timeout of 30000ms exceeded",
        }]}
        with patch.object(worker_main, "yxer", side_effect=[details, {"data": []}]):
            result = worker_main.query_publish_status(
                {"id": "package-1"}, "instagram", "request-1", None
            )
        self.assertEqual(result["state"], "processing")
        self.assertFalse(is_ambiguous_instagram_timeout({"tasks": [{
            "platformName": "Instagram",
            "errorMessage": "timeout of 30000ms exceeded",
            "openUrl": "https://www.instagram.com/reel/DdExample/",
        }]}))

    def test_terminal_operation_keeps_operation_and_records_diagnostic(self):
        result = terminal_operation(
            {"_operation": {"stage": "uploading_to_yixiaoer", "bytesSent": 10}},
            "failed",
            "timeout; output: last line",
        )
        self.assertEqual(result["stage"], "failed")
        self.assertEqual(result["bytesSent"], 10)
        self.assertEqual(result["error"], "timeout; output: last line")
        self.assertIn("last line", result["diagnostic"])
        self.assertTrue(result["finishedAt"].endswith("Z"))


if __name__ == "__main__":
    unittest.main()
