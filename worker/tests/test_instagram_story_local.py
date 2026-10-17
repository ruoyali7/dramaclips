import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, call, patch

from hook_worker import instagram_story_local as local


class LocalInstagramStoryAgentTests(unittest.TestCase):
    def test_bootstrap_session_id_saves_device_settings_and_clears_auth_block(self):
        client = Mock()
        client.get_settings.return_value = {"device_settings": {"device_id": "device-1"}}
        with tempfile.TemporaryDirectory() as directory:
            auth_block = Path(directory) / "blocked"
            auth_block.write_text("login_required", encoding="utf-8")
            with (
                patch.object(local, "AUTH_BLOCK", auth_block),
                patch.object(local, "_session_id", return_value="browser-session-id"),
                patch.object(local, "supabase") as supabase,
                patch("instagrapi.Client", return_value=client),
            ):
                local.bootstrap_session_id()

        client.login_by_sessionid.assert_called_once_with("browser-session-id")
        client.get_timeline_feed.assert_called_once_with()
        self.assertFalse(auth_block.exists())
        supabase.assert_called_once_with(
            "rpc/save_instagram_story_session",
            method="POST",
            payload={"p_session": client.get_settings.return_value},
        )

    def test_login_reprompts_for_missing_or_rejected_two_factor_code(self):
        from instagrapi.exceptions import TwoFactorRequired

        client = Mock()
        client.login.side_effect = [TwoFactorRequired("required"), TwoFactorRequired("rejected"), True]
        client.get_settings.return_value = {"device_settings": {"device_id": "device-1"}}
        with tempfile.TemporaryDirectory() as directory:
            auth_block = Path(directory) / "blocked"
            auth_block.write_text("login_required", encoding="utf-8")
            with (
                patch.object(local, "AUTH_BLOCK", auth_block),
                patch.object(local, "_session", return_value=None),
                patch.object(local, "supabase") as supabase,
                patch("instagrapi.Client", return_value=client),
                patch("builtins.input", side_effect=["dramaclips", "", "111111", "222222"]),
                patch.object(local.getpass, "getpass", return_value="secret"),
            ):
                local.login()

        self.assertEqual(
            client.login.call_args_list,
            [
                call("dramaclips", "secret"),
                call("dramaclips", "secret", verification_code="111111"),
                call("dramaclips", "secret", verification_code="222222"),
            ],
        )
        client.get_timeline_feed.assert_called_once_with()
        self.assertFalse(auth_block.exists())
        supabase.assert_called_once_with(
            "rpc/save_instagram_story_session",
            method="POST",
            payload={"p_session": client.get_settings.return_value},
        )

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
