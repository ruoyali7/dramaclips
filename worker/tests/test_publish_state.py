import unittest

from hook_worker.publish_state import (
    find_publish_record,
    provider_request_id,
    publish_record_state,
    should_resume,
    terminal_operation,
)


class PublishStateTests(unittest.TestCase):
    def test_resumes_an_existing_nonterminal_provider_request(self):
        detail = {
            "state": "outcome_unknown",
            "publish": {"taskSetId": "request-1"},
        }
        self.assertEqual(provider_request_id(detail), "request-1")
        self.assertTrue(should_resume(detail))
        self.assertFalse(should_resume(detail, retry_requested=True))

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
