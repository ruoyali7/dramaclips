import unittest
from unittest.mock import MagicMock

import requests

from hook_worker.meta_publisher import (
    MetaApiError,
    MetaOutcomeUnknown,
    MetaPublisher,
    publish_provider,
)


class Response:
    def __init__(self, data, status=200):
        self.data = data
        self.status_code = status
        self.ok = status < 400
        self.content = b"{}"
        self.text = str(data)
        self.reason = "error"

    def json(self):
        return self.data


def config(**extra):
    return {
        "META_GRAPH_API_VERSION": "v24.0",
        "META_APP_SECRET": "app-secret",
        "INSTAGRAM_USER_ID": "ig-1",
        "FACEBOOK_PAGE_ID": "page-1",
        "FACEBOOK_PAGE_ACCESS_TOKEN": "page-token",
        **extra,
    }


class MetaPublisherTests(unittest.TestCase):
    def test_provider_switch_defaults_to_yixiaoer_and_accepts_meta(self):
        self.assertEqual(publish_provider("instagram", {}), "yixiaoer")
        self.assertEqual(
            publish_provider("facebook", {"FACEBOOK_PUBLISH_PROVIDER": "meta"}),
            "meta",
        )
        with self.assertRaisesRegex(RuntimeError, "not available for youtube"):
            publish_provider("youtube", {"YOUTUBE_PUBLISH_PROVIDER": "meta"})

    def test_instagram_reel_uses_r2_url_then_publishes_media_id(self):
        session = MagicMock()
        session.request.side_effect = [
            Response({"id": "container-1"}),
            Response({"id": "container-1", "status_code": "IN_PROGRESS"}),
            Response({"id": "container-1", "status_code": "FINISHED"}),
            Response({"id": "media-1"}),
        ]
        publisher = MetaPublisher(config(), session=session, sleep=MagicMock())

        container_id, _ = publisher.create_instagram_container(
            "https://cdn.example/video.mp4", "Caption #Drama"
        )
        status = publisher.wait_for_instagram_container(container_id, attempts=3, interval=0)
        media_id, _ = publisher.publish_instagram_container(container_id)

        self.assertEqual(status["status_code"], "FINISHED")
        self.assertEqual(media_id, "media-1")
        create = session.request.call_args_list[0]
        self.assertEqual(create.kwargs["params"]["media_type"], "REELS")
        self.assertEqual(create.kwargs["params"]["video_url"], "https://cdn.example/video.mp4")
        self.assertEqual(create.kwargs["headers"]["Authorization"], "Bearer page-token")
        self.assertNotIn("access_token", create.kwargs["params"])

    def test_facebook_reel_uses_hosted_upload_and_waits_for_publish(self):
        session = MagicMock()
        session.request.side_effect = [
            Response({"video_id": "video-1", "upload_url": "https://rupload.facebook.com/video-1"}),
            Response({"success": True}),
            Response({"success": True}),
            Response({"id": "video-1", "status": {"publishing_phase": {"status": "complete"}}}),
        ]
        publisher = MetaPublisher(config(), session=session, sleep=MagicMock())

        video_id, upload_url, _ = publisher.start_facebook_reel()
        publisher.upload_facebook_reel(upload_url, "https://cdn.example/video.mp4")
        publisher.finish_facebook_reel(video_id, "Episode title", "Caption")
        status = publisher.wait_for_facebook_reel(video_id, attempts=1, interval=0)

        self.assertEqual(status["id"], "video-1")
        upload = session.request.call_args_list[1]
        self.assertEqual(upload.kwargs["headers"]["file_url"], "https://cdn.example/video.mp4")
        self.assertEqual(upload.kwargs["headers"]["Authorization"], "OAuth page-token")
        finish = session.request.call_args_list[2]
        self.assertEqual(finish.kwargs["params"]["video_state"], "PUBLISHED")

    def test_post_timeout_is_ambiguous_and_not_retried(self):
        session = MagicMock()
        session.request.side_effect = requests.Timeout("read timed out")
        publisher = MetaPublisher(config(), session=session)

        with self.assertRaises(MetaOutcomeUnknown):
            publisher.create_instagram_container("https://cdn.example/video.mp4", "Caption")
        self.assertEqual(session.request.call_count, 1)

    def test_safe_status_request_retries_rate_limit_response(self):
        session = MagicMock()
        session.request.side_effect = [
            Response({"error": {"code": 4, "message": "Rate limited"}}, status=429),
            Response({"id": "container-1", "status_code": "FINISHED"}),
        ]
        sleep = MagicMock()
        publisher = MetaPublisher(config(), session=session, sleep=sleep)

        result = publisher.instagram_container_status("container-1")

        self.assertEqual(result["status_code"], "FINISHED")
        self.assertEqual(session.request.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_meta_error_includes_provider_message_without_token(self):
        session = MagicMock()
        session.request.return_value = Response(
            {"error": {"code": 190, "message": "Invalid OAuth access token"}},
            status=400,
        )
        publisher = MetaPublisher(config(), session=session)

        with self.assertRaisesRegex(MetaApiError, "Invalid OAuth access token") as caught:
            publisher.instagram_container_status("container-1")
        self.assertNotIn("page-token", str(caught.exception))

    def test_missing_credentials_fail_before_network_request(self):
        session = MagicMock()
        publisher = MetaPublisher({}, session=session)

        with self.assertRaisesRegex(MetaApiError, "FACEBOOK_PAGE_ACCESS_TOKEN"):
            publisher.create_instagram_container("https://cdn.example/video.mp4", "Caption")
        session.request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
