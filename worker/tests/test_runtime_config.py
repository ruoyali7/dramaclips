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

    def test_mock_requires_a_safe_database(self):
        with self.assertRaisesRegex(RuntimeError, "local Supabase"):
            load_runtime_config({
                "SOCIAL_PUBLISH_MODE": "mock",
                "SUPABASE_URL": "https://production.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "secret",
            })
        config = load_runtime_config({
            "SOCIAL_PUBLISH_MODE": "mock",
            "SUPABASE_URL": "http://127.0.0.1:54321",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
        })
        self.assertEqual(config["social_publish_mode"], "mock")

    def test_test_mode_requires_explicit_real_publish_opt_in(self):
        values = {
            "SOCIAL_PUBLISH_MODE": "test",
            "SUPABASE_URL": "http://localhost:54321",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
        }
        with self.assertRaisesRegex(RuntimeError, "ALLOW_REAL_TEST_PUBLISH"):
            load_runtime_config(values)
        config = load_runtime_config({**values, "ALLOW_REAL_TEST_PUBLISH": "true"})
        self.assertEqual(config["social_publish_mode"], "test")

    def test_remote_development_database_must_match_allowlist(self):
        config = load_runtime_config({
            "SOCIAL_PUBLISH_MODE": "mock",
            "SUPABASE_URL": "https://devref.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
            "ALLOW_REMOTE_DEVELOPMENT_DB": "true",
            "DEV_SUPABASE_PROJECT_REF": "devref",
        })
        self.assertEqual(config["lease_backend"], "supabase")

    def test_production_rejects_non_live_modes(self):
        with self.assertRaisesRegex(RuntimeError, "SOCIAL_PUBLISH_MODE=live"):
            load_runtime_config({
                "RAILWAY_ENVIRONMENT_NAME": "production",
                "SOCIAL_PUBLISH_MODE": "mock",
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "secret",
            })


if __name__ == "__main__":
    unittest.main()
