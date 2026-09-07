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


if __name__ == "__main__":
    unittest.main()
