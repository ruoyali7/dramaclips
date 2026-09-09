import unittest
from datetime import datetime, timezone

from hook_worker.credential_reminder import credential_times, notification_due


class CredentialReminderTest(unittest.TestCase):
    def test_reminds_one_hour_before_during_awake_hours(self):
        reminder, expiry = credential_times("2026-09-09T22:00:00Z")
        self.assertEqual(expiry, datetime(2026, 9, 10, 22, 0, tzinfo=timezone.utc))
        self.assertEqual(reminder, datetime(2026, 9, 10, 21, 0, tzinfo=timezone.utc))

    def test_moves_sleeping_hours_reminder_to_previous_bedtime(self):
        reminder, expiry = credential_times("2026-09-09T15:00:00Z")
        self.assertEqual(expiry, datetime(2026, 9, 10, 15, 0, tzinfo=timezone.utc))
        self.assertEqual(reminder, datetime(2026, 9, 10, 5, 30, tzinfo=timezone.utc))

    def test_sends_each_notification_only_once_and_not_while_asleep(self):
        updated = "2026-09-09T15:00:00Z"
        due, _, _ = notification_due(datetime(2026, 9, 10, 5, 45, tzinfo=timezone.utc), updated)
        self.assertEqual(due, "upcoming")
        due, _, _ = notification_due(datetime(2026, 9, 10, 6, 0, tzinfo=timezone.utc), updated, upcoming_sent_at="sent")
        self.assertIsNone(due)
        due, _, _ = notification_due(datetime(2026, 9, 10, 15, 15, tzinfo=timezone.utc), updated)
        self.assertIsNone(due)
        due, _, _ = notification_due(datetime(2026, 9, 10, 17, 30, tzinfo=timezone.utc), updated)
        self.assertEqual(due, "expired")


if __name__ == "__main__":
    unittest.main()
