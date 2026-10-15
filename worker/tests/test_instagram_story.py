import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


story_module = importlib.import_module("hook_worker.instagram_story")


class InstagramStoryTests(unittest.TestCase):
    def test_login_uses_session_id_for_first_session(self):
        client = MagicMock()
        client.get_settings.return_value = {"authorization_data": {"ds_user_id": "1"}}
        instagrapi = SimpleNamespace(Client=MagicMock(return_value=client))
        supabase = MagicMock()

        with (
            patch.dict(os.environ, {"INSTAGRAM_USERNAME": "account", "INSTAGRAM_PASSWORD": "secret", "INSTAGRAM_SESSION_ID": "session-cookie"}, clear=False),
            patch.dict(sys.modules, {"instagrapi": instagrapi}),
            patch.object(story_module, "_session", return_value=None),
            patch.object(story_module, "_session_id", return_value="session-cookie"),
        ):
            result = story_module.login_story_client(supabase)

        self.assertIs(result, client)
        client.login_by_sessionid.assert_called_once_with("session-cookie")
        client.login.assert_not_called()
        self.assertEqual(supabase.call_args.kwargs["payload"]["p_session"], client.get_settings.return_value)

    def test_session_id_prefers_vault_over_environment(self):
        supabase = MagicMock(return_value="vault-session")
        with patch.dict(os.environ, {"INSTAGRAM_SESSION_ID": "environment-session"}, clear=False):
            result = story_module._session_id(supabase)
        self.assertEqual(result, "vault-session")
        supabase.assert_called_once_with("rpc/get_instagram_story_session_id", method="POST", payload={})

    def test_publish_attaches_reelshort_link_and_saves_session(self):
        client = MagicMock()
        client.get_settings.return_value = {"authorization_data": {"ds_user_id": "1"}}
        client.photo_upload_to_story.return_value = SimpleNamespace(pk="12345")
        client.story_info.return_value = SimpleNamespace(
            links=[SimpleNamespace(webUri="https://l.instagram.com/?u=https%3A%2F%2Freelslink.com%2Fcps%2Ftest%3Ffbclid%3Dtracking")],
            user=SimpleNamespace(username="dramoraai_"),
        )
        link_type = MagicMock(side_effect=lambda **values: SimpleNamespace(**values))
        instagrapi = SimpleNamespace(Client=MagicMock(return_value=client))
        instagrapi_types = SimpleNamespace(StoryLink=link_type)
        supabase = MagicMock(side_effect=[{"cookies": {}}, None])
        job = {"id": "job-1", "image_url": "https://example.com/poster.jpg", "content_code": "5159963", "target_url": "https://reelslink.com/cps/test"}

        with (
            patch.dict(os.environ, {"INSTAGRAM_USERNAME": "account", "INSTAGRAM_PASSWORD": "secret"}, clear=False),
            patch.dict(sys.modules, {"instagrapi": instagrapi, "instagrapi.types": instagrapi_types}),
            patch.object(story_module, "render_poster", side_effect=lambda _url, _code, target: target),
        ):
            result = story_module.publish_story(job, supabase)

        link_type.assert_called_once_with(webUri=job["target_url"], x=0.5, y=0.79427, width=0.722222, height=0.067708)
        client.photo_upload_to_story.assert_called_once()
        self.assertNotIn("resize_mode", client.photo_upload_to_story.call_args.kwargs)
        self.assertTrue(result["linkVerified"])
        self.assertEqual(result["storyPk"], "12345")
        self.assertEqual(result["storyUrl"], "https://www.instagram.com/stories/dramoraai_/12345/")
        self.assertEqual(supabase.call_args_list[1].kwargs["payload"]["p_session"], client.get_settings.return_value)

    def test_link_matcher_rejects_a_different_destination(self):
        self.assertFalse(story_module._link_matches(
            "https://reelslink.com/cps/correct",
            "https://l.instagram.com/?u=https%3A%2F%2Freelslink.com%2Fcps%2Fwrong",
        ))

    def test_render_poster_matches_poster_publisher_dimensions_and_code(self):
        source = Path(tempfile.mkdtemp()) / "source.jpg"
        target = source.with_name("story.jpg")
        from PIL import Image
        Image.new("RGB", (600, 900), "#9c4f38").save(source)
        response = MagicMock(content=source.read_bytes())
        response.raise_for_status.return_value = None
        with patch.object(story_module.requests, "get", return_value=response):
            story_module.render_poster("https://example.com/poster.jpg", "5159963", target)
        with Image.open(target) as result:
            self.assertEqual(result.size, (1080, 1920))


if __name__ == "__main__":
    unittest.main()
