import unittest

import requests

from hook_worker.upload import is_transient_network_error, primary_publish_channel, publish_video_optimization_command, retry_upload, should_optimize_publish_video, video_upload_timeout


class UploadRetryTests(unittest.TestCase):
    def test_local_is_primary_only_with_a_client_id(self):
        self.assertEqual(primary_publish_channel("local", "client-id"), "local")
        self.assertEqual(primary_publish_channel("local", ""), "cloud")
        self.assertEqual(primary_publish_channel("cloud", "client-id"), "cloud")

    def test_retries_one_timeout_then_returns_uploaded_resource(self):
        attempts = []
        retries = []

        def upload(attempt):
            attempts.append(attempt)
            if attempt == 1:
                raise RuntimeError("Yixiaoer CLI timed out")
            return {"key": "uploaded.mp4", "duration": 30}

        result = retry_upload(upload, retries.append)
        self.assertEqual(result["key"], "uploaded.mp4")
        self.assertEqual(attempts, [1, 2])
        self.assertEqual(retries, [2])

    def test_does_not_retry_non_timeout_failures(self):
        with self.assertRaisesRegex(RuntimeError, "invalid upload"):
            retry_upload(
                lambda attempt: (_ for _ in ()).throw(RuntimeError("invalid upload")),
                lambda attempt: self.fail("unexpected retry"),
            )

    def test_retries_tls_handshake_timeout(self):
        attempts = []

        def upload(attempt):
            attempts.append(attempt)
            if attempt == 1:
                raise RuntimeError("Yixiaoer CLI failed: TLS handshake timeout")
            return {"key": "uploaded.jpg"}

        self.assertEqual(retry_upload(upload, lambda attempt: None)["key"], "uploaded.jpg")
        self.assertEqual(attempts, [1, 2])

    def test_only_request_network_failures_are_transient(self):
        self.assertTrue(is_transient_network_error(requests.ReadTimeout("slow heartbeat")))
        self.assertTrue(is_transient_network_error(requests.ConnectionError("connection reset")))
        self.assertFalse(is_transient_network_error(RuntimeError("lease not owned")))

    def test_large_original_video_gets_longer_upload_window(self):
        self.assertEqual(video_upload_timeout(5 * 1024 * 1024), 1800)
        self.assertEqual(video_upload_timeout(38 * 1024 * 1024), 5400)
        self.assertEqual(video_upload_timeout(200 * 1024 * 1024), 5400)

    def test_only_large_original_videos_are_optimized(self):
        self.assertTrue(should_optimize_publish_video("original", 38 * 1024 * 1024))
        self.assertFalse(should_optimize_publish_video("original", 12 * 1024 * 1024))
        self.assertFalse(should_optimize_publish_video("hook", 38 * 1024 * 1024))

    def test_publish_optimization_limits_ffmpeg_threads(self):
        command = publish_video_optimization_command("https://video.test/source.mp4", "/tmp/output.mp4")

        self.assertIn("https://video.test/source.mp4", command)
        self.assertEqual(command[command.index("-filter_threads") + 1], "1")
        self.assertEqual(command[command.index("-filter_complex_threads") + 1], "1")
        self.assertEqual(command[command.index("-threads:v") + 1], "1")


if __name__ == "__main__":
    unittest.main()
