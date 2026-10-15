import unittest

from hook_worker.runtime_config import load_runtime_config


class RuntimeConfigTests(unittest.TestCase):
    def test_cron_requires_oneshot(self):
        with self.assertRaisesRegex(RuntimeError, "WORKER_ONESHOT=true"):
            load_runtime_config({"WORKER_MODE": "cron", "WORKER_ONESHOT": "false"})

    def test_production_requires_direct_supabase(self):
        with self.assertRaisesRegex(RuntimeError, "direct Supabase"):
            load_runtime_config({
                "RAILWAY_ENVIRONMENT_NAME": "production",
                "WORKER_MODE": "cron",
                "WORKER_ONESHOT": "true",
            })

    def test_cron_uses_supabase_and_safe_idle_default(self):
        config = load_runtime_config({
            "RAILWAY_ENVIRONMENT_NAME": "production",
            "WORKER_MODE": "cron",
            "WORKER_ONESHOT": "true",
            "SUPABASE_URL": "https://example.supabase.co/",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
        })
        self.assertEqual(config["mode"], "cron")
        self.assertTrue(config["oneshot"])
        self.assertEqual(config["idle_poll_seconds"], 30)
        self.assertEqual(config["account_sync_interval_seconds"], 300)
        self.assertEqual(config["schedule_notification_interval_seconds"], 60)
        self.assertEqual(config["lease_backend"], "supabase")

    def test_continuous_worker_accepts_cost_saving_intervals(self):
        config = load_runtime_config({
            "WORKER_MODE": "continuous",
            "WORKER_ONESHOT": "false",
            "IDLE_POLL_SECONDS": "60",
            "ACCOUNT_SYNC_INTERVAL_SECONDS": "21600",
            "SCHEDULE_NOTIFICATION_INTERVAL_SECONDS": "3600",
        })
        self.assertEqual(config["idle_poll_seconds"], 60)
        self.assertEqual(config["account_sync_interval_seconds"], 21600)
        self.assertEqual(config["schedule_notification_interval_seconds"], 3600)


if __name__ == "__main__":
    unittest.main()
