import importlib
import os
import sys
import unittest
from unittest.mock import MagicMock, patch


os.environ.setdefault("CONTROL_PLANE_URL", "https://example.com")
os.environ.setdefault("HOOK_WORKER_TOKEN", "test-token")
os.environ["WORKER_MODE"] = "cron"
os.environ["WORKER_ONESHOT"] = "true"
sys.modules.setdefault("cv2", MagicMock())
sys.modules.setdefault("faster_whisper", MagicMock())
sys.modules.setdefault("scenedetect", MagicMock())

main = importlib.import_module("hook_worker.main")


class OneshotWorkerTests(unittest.TestCase):
    def test_empty_queue_exits_after_one_lease_pass(self):
        with (
            patch.object(main, "sync_yixiaoer_accounts"),
            patch.object(main, "process_vizard_once", return_value=False),
            patch.object(main, "lease", return_value={"job": None}) as lease,
            patch.object(main, "cleanup_worker_temps"),
        ):
            main.main()

        lease.assert_called_once_with(
            "/api/internal/publish-worker/lease",
            {"workerId": main.WORKER, "leaseSeconds": 900},
        )

    def test_publish_only_worker_does_not_check_vizard(self):
        with (
            patch.object(main, "ENABLE_VIZARD_WORKER", False),
            patch.object(main, "ENABLE_PUBLISH_WORKER", True),
            patch.object(main, "sync_yixiaoer_accounts"),
            patch.object(main, "process_vizard_once") as process_vizard,
            patch.object(main, "lease", return_value={"job": None}),
            patch.object(main, "cleanup_worker_temps"),
        ):
            main.main()

        process_vizard.assert_not_called()

    def test_vizard_batch_drains_jobs_with_rate_limit_gap(self):
        with (
            patch.object(main, "VIZARD_BATCH_MAX_JOBS", 3),
            patch.object(main, "process_vizard_once", side_effect=[True, True, False]) as process,
            patch.object(main.time, "sleep") as sleep,
        ):
            self.assertEqual(main.process_vizard_batch(), 2)

        self.assertEqual(process.call_count, 3)
        self.assertEqual(sleep.call_count, 2)


if __name__ == "__main__":
    unittest.main()
