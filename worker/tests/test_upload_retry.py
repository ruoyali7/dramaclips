import unittest

from hook_worker.upload import retry_upload


class UploadRetryTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
