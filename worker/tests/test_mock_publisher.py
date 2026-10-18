import unittest

from hook_worker.mock_publisher import mock_platform_result, parse_mock_outcomes


class MockPublisherTests(unittest.TestCase):
    def setUp(self):
        self.job = {"id": "package-1", "yixiaoerAccounts": {"instagram": "mock-instagram"}}

    def test_success_is_deterministic_and_requires_no_network(self):
        first = mock_platform_result(self.job, "instagram", "publish", environ={})
        second = mock_platform_result(self.job, "instagram", "publish", environ={})
        self.assertEqual(first, second)
        self.assertEqual(first["state"], "published")
        self.assertTrue(first["platformPostId"].startswith("mock-post-"))

    def test_failure_timeout_and_processing_are_configurable(self):
        values = {"MOCK_PUBLISH_OUTCOMES": "instagram:failed,facebook:timeout,youtube:processing"}
        self.assertEqual(mock_platform_result(self.job, "instagram", "publish", environ=values)["state"], "failed")
        self.assertEqual(mock_platform_result(self.job, "facebook", "publish", environ=values)["state"], "outcome_unknown")
        self.assertEqual(mock_platform_result(self.job, "youtube", "publish", environ=values)["state"], "processing")

    def test_validate_never_returns_a_published_result(self):
        result = mock_platform_result(self.job, "instagram", "validate", environ={})
        self.assertEqual(result["state"], "validated")
        self.assertNotIn("platformPostId", result)

    def test_invalid_outcome_fails_configuration(self):
        with self.assertRaisesRegex(RuntimeError, "MOCK_PUBLISH_OUTCOMES"):
            parse_mock_outcomes("instagram:maybe")


if __name__ == "__main__":
    unittest.main()
