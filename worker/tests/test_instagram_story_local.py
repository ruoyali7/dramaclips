import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from hook_worker import instagram_story_local as local


class LocalInstagramStoryAgentTests(unittest.TestCase):
    def test_auth_block_prevents_network_retry(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(local,"AUTH_BLOCK",Path(directory)/"blocked"):
            local.AUTH_BLOCK.write_text("login_required",encoding="utf-8")
            with patch.object(local,"_lease") as lease:
                self.assertEqual(local.run_once(),0)
            lease.assert_not_called()

    def test_reconnect_validates_saved_session_and_marks_connected(self):
        attempt={"id":"attempt-1"}
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(local,"AUTH_BLOCK",Path(directory)/"blocked"),
                patch.object(local,"_lease",return_value=attempt),
                patch.object(local,"_validated_client",return_value=object()),
                patch.object(local,"_update_reconnect") as update,
            ):
                self.assertEqual(local.run_once(),0)
        update.assert_called_once_with(attempt,"connected")

    def test_invalid_session_blocks_future_retries(self):
        attempt={"id":"attempt-1"}
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(local,"AUTH_BLOCK",Path(directory)/"blocked"),
                patch.object(local,"STATE_DIR",Path(directory)),
                patch.object(local,"_lease",return_value=attempt),
                patch.object(local,"login_story_client",side_effect=RuntimeError("login_required")),
                patch.object(local,"_update_reconnect") as update,
            ):
                self.assertEqual(local.run_once(),1)
                self.assertTrue(local.AUTH_BLOCK.exists())
        update.assert_called_once()
        self.assertEqual(update.call_args.args[1],"failed")


if __name__=="__main__":
    unittest.main()
