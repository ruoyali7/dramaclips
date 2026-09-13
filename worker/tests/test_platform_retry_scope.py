import unittest
from hook_worker.publish_state import should_process_platform


class PlatformRetryScopeTests(unittest.TestCase):
    def test_retry_only_the_selected_failed_platform(self):
        self.assertTrue(should_process_platform("instagram", {"state": "failed"}, "publish", {"instagram"}))
        self.assertFalse(should_process_platform("facebook", {"state": "failed"}, "publish", {"instagram"}))

    def test_successful_platform_is_never_republished(self):
        self.assertFalse(should_process_platform("instagram", {"state": "published"}, "publish", {"instagram"}))

    def test_normal_publish_includes_unsubmitted_platforms(self):
        self.assertTrue(should_process_platform("facebook", None, "publish", set()))
