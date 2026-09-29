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
    def test_schedule_tail_notification_sends_once_with_ten_future_originals(self):
        plan = {"id": "plan-1", "status": "scheduled"}
        scheduled = [{"id": f"cart-{index}", "scheduled_at": f"2026-10-07T0{index}:00:00Z"} for index in range(10)]
        with (
            patch.object(main, "supabase", side_effect=[[plan], scheduled, None]) as supabase,
            patch.object(main, "notify_scheduled_queue_nearly_finished", return_value=True) as notify,
        ):
            self.assertTrue(main.process_schedule_tail_notification())

        notify.assert_called_once_with(10, scheduled[-1]["scheduled_at"])
        self.assertEqual(supabase.call_count, 3)
        self.assertIn("schedule_tail_warning_notified_at", supabase.call_args.kwargs["payload"])

    def test_schedule_tail_notification_waits_while_more_than_ten_remain(self):
        plan = {"id": "plan-1", "status": "scheduled"}
        scheduled = [{"id": f"cart-{index}", "scheduled_at": "2026-10-07T04:50:00Z"} for index in range(11)]
        with (
            patch.object(main, "supabase", side_effect=[[plan], scheduled]),
            patch.object(main, "notify_scheduled_queue_nearly_finished") as notify,
        ):
            self.assertFalse(main.process_schedule_tail_notification())

        notify.assert_not_called()

    def test_empty_queue_exits_after_one_lease_pass(self):
        with (
            patch.object(main, "sync_yixiaoer_accounts"),
            patch.object(main, "process_schedule_tail_notification", return_value=False),
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
            patch.object(main, "process_schedule_tail_notification", return_value=False),
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
        sleep.assert_has_calls([unittest.mock.call(main.VIZARD_SUBMISSION_GAP_SECONDS)] * 2)


if __name__ == "__main__":
    unittest.main()
