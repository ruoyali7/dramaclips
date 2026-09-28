import unittest
from hook_worker.publish_state import publish_platform_allowed, should_process_platform


class PlatformRetryScopeTests(unittest.TestCase):
    def test_youtube_is_allowed_for_hooks_but_not_original_episodes(self):
        self.assertTrue(publish_platform_allowed("hook", "youtube"))
        self.assertFalse(publish_platform_allowed("original", "youtube"))
        self.assertFalse(publish_platform_allowed("episode", "youtube"))
        self.assertFalse(publish_platform_allowed("orgvideo", "youtube"))
        self.assertTrue(publish_platform_allowed("original", "facebook"))

    def test_retry_only_the_selected_failed_platform(self):
        self.assertTrue(should_process_platform("instagram", {"state": "failed"}, "publish", {"instagram"}))
        self.assertFalse(should_process_platform("facebook", {"state": "failed"}, "publish", {"instagram"}))

    def test_successful_platform_is_never_republished(self):
        self.assertFalse(should_process_platform("instagram", {"state": "published"}, "publish", {"instagram"}))

    def test_normal_publish_includes_unsubmitted_platforms(self):
        self.assertTrue(should_process_platform("facebook", None, "publish", set()))
