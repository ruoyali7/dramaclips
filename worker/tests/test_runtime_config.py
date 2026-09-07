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
        self.assertEqual(config["lease_backend"], "supabase")


if __name__ == "__main__":
    unittest.main()
