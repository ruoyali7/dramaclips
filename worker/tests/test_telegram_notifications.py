import os
import unittest
from unittest.mock import patch

from hook_worker import telegram_notifications


class TelegramNotificationTests(unittest.TestCase):
    @patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "bot-token", "TELEGRAM_CHAT_ID": "chat-id"})
    @patch.object(telegram_notifications.requests, "post")
    def test_reports_terminal_publish_failures(self, post):
        post.return_value.ok = True
        sent = telegram_notifications.notify_publish_failure(
            {"id": "package-1", "dramaTitle": "Drama", "episodeNumber": 2},
            "failed",
            {"instagram": {"state": "failed", "error": "provider rejected upload"}, "facebook": {"state": "published"}},
        )
        self.assertTrue(sent)
        message = post.call_args.kwargs["json"]["text"]
        self.assertIn("Drama · EP 2", message)
        self.assertIn("instagram: failed", message)
        self.assertIn("provider rejected upload", message)
        self.assertIn("package-1", message)

    @patch.dict(os.environ, {}, clear=True)
    def test_skips_when_telegram_is_not_configured(self):
        self.assertFalse(telegram_notifications.notify_publish_failure(
            {"id": "package-1", "dramaSlug": "drama", "episodeNumber": 1},
            "outcome_unknown",
            {},
        ))

    @patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "bot-token", "TELEGRAM_CHAT_ID": "chat-id"})
    @patch.object(telegram_notifications.requests, "post")
    def test_warns_when_scheduled_queue_is_nearly_finished(self, post):
        post.return_value.ok = True
        sent = telegram_notifications.notify_scheduled_queue_nearly_finished(8, "2026-10-07T04:50:00Z")
        self.assertTrue(sent)
        message = post.call_args.kwargs["json"]["text"]
        self.assertIn("剩余：8 条", message)
        self.assertIn("请补货", message)
        self.assertIn("安排下一个 week", message)


if __name__ == "__main__":
    unittest.main()
