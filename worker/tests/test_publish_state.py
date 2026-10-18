import unittest
from unittest.mock import patch

from hook_worker import main as worker_main
from hook_worker.publish_state import (
    final_publish_status,
    find_publish_record,
    is_ambiguous_instagram_timeout,
    provider_request_id,
    publish_record_state,
    should_resume,
    terminal_operation,
)


class PublishStateTests(unittest.TestCase):
    def test_replaces_retired_account_when_platform_has_one_active_account(self):
        selected = {"instagram": "retired", "facebook": "facebook-1"}
        active = [
            {"id": "instagram-2", "platform": "Instagram", "status": 1},
            {"id": "facebook-1", "platform": "Facebook", "status": 1},
        ]
        self.assertEqual(
            worker_main.resolve_publish_accounts(selected, active),
            {"instagram": "instagram-2", "facebook": "facebook-1"},
        )

    def test_does_not_guess_when_multiple_accounts_are_active(self):
        selected = {"instagram": "retired"}
        active = [
            {"id": "instagram-1", "platform": "Instagram", "status": 1},
            {"id": "instagram-2", "platform": "Instagram", "status": 1},
        ]
        self.assertEqual(worker_main.resolve_publish_accounts(selected, active), selected)

    def test_final_status_keeps_independent_platform_results(self):
        platforms = [{"source": "instagram"}, {"source": "facebook"}]
        self.assertEqual(
            final_publish_status(
                {"instagram": {"state": "failed"}, "facebook": {"state": "published"}},
                platforms,
                "publish",
            ),
            "failed",
        )
        self.assertEqual(
            final_publish_status(
                {"instagram": {"state": "outcome_unknown"}, "facebook": {"state": "published"}},
                platforms,
                "publish",
            ),
            "outcome_unknown",
        )

    def test_resumes_an_existing_nonterminal_provider_request(self):
        detail = {
            "state": "outcome_unknown",
            "publish": {"taskSetId": "request-1"},
        }
        self.assertEqual(provider_request_id(detail), "request-1")
        self.assertTrue(should_resume(detail))
        self.assertFalse(should_resume(detail, retry_requested=True))

    def test_accepts_direct_and_string_provider_request_ids(self):
        self.assertEqual(provider_request_id("request-1"), "request-1")
        self.assertEqual(provider_request_id({"taskSetId": "request-2"}), "request-2")
        self.assertEqual(
            provider_request_id({"publish": {"requestId": "request-3"}}),
            "request-3",
        )
        self.assertIsNone(provider_request_id("  "))

    def test_does_not_resume_an_already_published_platform(self):
        self.assertFalse(
            should_resume({"state": "published", "providerRequestId": "request-1"})
        )

    def test_finds_the_exact_publish_record(self):
        record = find_publish_record(
            {"data": [{"id": "other"}, {"id": "request-1", "taskSetStatus": "allsuccessful"}]},
            "request-1",
        )
        self.assertEqual(record["taskSetStatus"], "allsuccessful")

    def test_maps_records_fallback_terminal_states(self):
        self.assertEqual(
            publish_record_state({"taskSetStatus": "allsuccessful", "failedTotal": 0}),
            "published",
        )
        self.assertEqual(
            publish_record_state({"taskSetStatus": "completed", "failedTotal": 1}),
            "failed",
        )
        self.assertEqual(publish_record_state({"taskSetStatus": "pending"}), "processing")

    def test_instagram_timeout_without_post_data_is_ambiguous(self):
        self.assertTrue(is_ambiguous_instagram_timeout({"tasks": [{
            "platformName": "Instagram",
            "stageStatus": "fail",
            "errorMessage": "timeout of 30000ms exceeded",
            "publishId": None,
            "documentId": None,
            "openUrl": None,
        }]}))

    def test_instagram_timeout_recovers_post_id_from_records_permalink(self):
        details = {"tasks": [{
            "platformName": "Instagram",
            "errorMessage": "timeout of 30000ms exceeded",
        }]}
        records = {"data": [{
            "id": "request-1",
            "taskSetStatus": "completed",
            "failedTotal": 1,
            "openUrl": "https://www.instagram.com/reel/DdExample/",
        }]}
        with patch.object(worker_main, "yxer", side_effect=[details, records]):
            result = worker_main.query_publish_status(
                {"id": "package-1"}, "instagram", "request-1", None
            )
        self.assertEqual(result["state"], "published")
        self.assertEqual(worker_main.provider_post_id(result, "instagram"), "DdExample")

    def test_instagram_timeout_with_post_id_is_published(self):
        details = {"tasks": [{
            "platformName": "Instagram",
            "stageStatus": "fail",
            "errorMessage": "timeout of 30000ms exceeded",
            "publishId": "18011243744958161",
            "documentId": "18011243744958161",
            "openUrl": "https://instagram.com/p/18011243744958161",
        }]}
        with patch.object(worker_main, "yxer", return_value=details) as yxer:
            result = worker_main.query_publish_status(
                {"id": "package-1"}, "instagram", "request-1", None
            )
        self.assertEqual(result["state"], "published")
        self.assertEqual(
            worker_main.provider_post_id(result, "instagram"),
            "18011243744958161",
        )
        yxer.assert_called_once()

    def test_publish_platform_pause_is_case_insensitive(self):
        with patch.dict(
            worker_main.os.environ,
            {"PAUSED_PUBLISH_PLATFORMS": " youtube, Instagram "},
        ):
            self.assertTrue(worker_main.publish_platform_is_paused("youtube"))
            self.assertTrue(worker_main.publish_platform_is_paused("instagram"))
            self.assertFalse(worker_main.publish_platform_is_paused("facebook"))

    def test_meta_only_publish_skips_yixiaoer_pipeline(self):
        job = {
            "platforms": [{"source": "instagram", "caption": "Caption"}],
            "videoKind": "hook",
            "yixiaoerAction": "publish",
            "yixiaoerResults": {},
        }
        with (
            patch.dict(worker_main.os.environ, {"INSTAGRAM_PUBLISH_PROVIDER": "meta"}),
            patch.object(worker_main, "run_meta_platforms") as run_meta,
            patch.object(worker_main, "run_yixiaoer_publish") as run_yixiaoer,
        ):
            worker_main.run_publish(job)

        run_meta.assert_called_once_with(job, job["platforms"], True)
        run_yixiaoer.assert_not_called()

    def test_queued_provider_snapshot_overrides_later_environment_change(self):
        instagram = {"source": "instagram", "caption": "Caption"}
        job = {
            "platforms": [instagram],
            "videoKind": "hook",
            "yixiaoerAction": "publish",
            "yixiaoerResults": {"_control": {"providers": {"instagram": "meta"}}},
        }
        with (
            patch.dict(worker_main.os.environ, {"INSTAGRAM_PUBLISH_PROVIDER": "yixiaoer"}),
            patch.object(worker_main, "run_meta_platforms") as run_meta,
            patch.object(worker_main, "run_yixiaoer_publish") as run_yixiaoer,
        ):
            worker_main.run_publish(job)

        run_meta.assert_called_once_with(job, [instagram], True)
        run_yixiaoer.assert_not_called()

    def test_queued_yixiaoer_snapshot_preserves_fallback_after_environment_change(self):
        instagram = {"source": "instagram", "caption": "Caption"}
        job = {
            "platforms": [instagram],
            "videoKind": "hook",
            "yixiaoerAction": "publish",
            "yixiaoerResults": {"_control": {"providers": {"instagram": "yixiaoer"}}},
        }
        with (
            patch.dict(worker_main.os.environ, {"INSTAGRAM_PUBLISH_PROVIDER": "meta"}),
            patch.object(worker_main, "run_meta_platforms") as run_meta,
            patch.object(worker_main, "run_yixiaoer_publish") as run_yixiaoer,
        ):
            worker_main.run_publish(job)

        run_meta.assert_not_called()
        routed_job = run_yixiaoer.call_args.args[0]
        self.assertEqual(routed_job["platforms"], [instagram])

    def test_mixed_publish_routes_only_selected_platform_to_meta(self):
        instagram = {"source": "instagram", "caption": "Instagram"}
        youtube = {"source": "youtube", "caption": "YouTube"}
        job = {
            "platforms": [instagram, youtube],
            "videoKind": "hook",
            "yixiaoerAction": "publish",
            "yixiaoerResults": {},
        }
        def publish_meta(current_job, _packs, _terminal):
            current_job["yixiaoerResults"]["instagram"] = {"state": "published"}
        with (
            patch.dict(worker_main.os.environ, {"INSTAGRAM_PUBLISH_PROVIDER": "meta"}),
            patch.object(worker_main, "run_meta_platforms", side_effect=publish_meta) as run_meta,
            patch.object(worker_main, "run_yixiaoer_publish") as run_yixiaoer,
        ):
            worker_main.run_publish(job)

        run_meta.assert_called_once_with(job, [instagram], False)
        routed_job = run_yixiaoer.call_args.args[0]
        self.assertEqual(routed_job["platforms"], [youtube])
        self.assertEqual(routed_job["_allPlatforms"], [instagram, youtube])
        self.assertEqual(routed_job["yixiaoerResults"]["instagram"]["state"], "published")

    def test_meta_retry_does_not_enter_yixiaoer_pipeline(self):
        instagram = {"source": "instagram", "caption": "Instagram"}
        facebook = {"source": "facebook", "caption": "Facebook"}
        job = {
            "platforms": [instagram, facebook],
            "videoKind": "hook",
            "yixiaoerAction": "publish",
            "yixiaoerResults": {
                "_control": {"retryPlatforms": ["instagram"]},
                "instagram": {"state": "failed"},
                "facebook": {"state": "failed"},
            },
        }
        with (
            patch.dict(worker_main.os.environ, {"INSTAGRAM_PUBLISH_PROVIDER": "meta"}),
            patch.object(worker_main, "run_meta_platforms") as run_meta,
            patch.object(worker_main, "run_yixiaoer_publish") as run_yixiaoer,
        ):
            worker_main.run_publish(job)

        run_meta.assert_called_once_with(job, [instagram], True)
        run_yixiaoer.assert_not_called()

    def test_disallowed_youtube_original_is_not_counted_in_meta_result(self):
        instagram = {"source": "instagram", "caption": "Instagram"}
        youtube = {"source": "youtube", "caption": "YouTube"}
        job = {
            "platforms": [instagram, youtube],
            "videoKind": "original",
            "yixiaoerAction": "publish",
            "yixiaoerResults": {},
        }
        with (
            patch.dict(worker_main.os.environ, {"INSTAGRAM_PUBLISH_PROVIDER": "meta"}),
            patch.object(worker_main, "run_meta_platforms") as run_meta,
            patch.object(worker_main, "run_yixiaoer_publish") as run_yixiaoer,
        ):
            worker_main.run_publish(job)

        run_meta.assert_called_once_with(job, [instagram], True)
        self.assertEqual(job["_allPlatforms"], [instagram])
        run_yixiaoer.assert_not_called()

    def test_meta_platform_failure_does_not_stop_the_next_platform(self):
        instagram = {"source": "instagram", "caption": "Instagram"}
        facebook = {"source": "facebook", "caption": "Facebook"}
        results = {}
        job = {
            "platforms": [instagram, facebook],
            "_allPlatforms": [instagram, facebook],
            "yixiaoerAction": "publish",
            "yixiaoerResults": results,
        }

        def publish(_job, pack, current, _heartbeat):
            if pack["source"] == "instagram":
                raise worker_main.MetaApiError("Instagram rejected the request")
            current["facebook"] = {"provider": "meta", "state": "published"}

        with (
            patch.object(worker_main, "run_meta_platform", side_effect=publish) as run_platform,
            patch.object(worker_main, "publish_update", return_value={"package": {}}) as update,
        ):
            worker_main.run_meta_platforms(job, [instagram, facebook], True)

        self.assertEqual(run_platform.call_count, 2)
        self.assertEqual(results["instagram"]["state"], "failed")
        self.assertEqual(results["facebook"]["state"], "published")
        self.assertEqual(update.call_args.args[1], "failed")

    def test_unexpected_meta_platform_failure_does_not_stop_the_next_platform(self):
        instagram = {"source": "instagram", "caption": "Instagram"}
        facebook = {"source": "facebook", "caption": "Facebook"}
        results = {}
        job = {
            "platforms": [instagram, facebook],
            "_allPlatforms": [instagram, facebook],
            "yixiaoerAction": "publish",
            "yixiaoerResults": results,
        }

        def publish(_job, pack, current, _heartbeat):
            if pack["source"] == "instagram":
                raise ValueError("malformed provider response")
            current["facebook"] = {"provider": "meta", "state": "published"}

        with (
            patch.object(worker_main, "run_meta_platform", side_effect=publish) as run_platform,
            patch.object(worker_main, "publish_update", return_value={"package": {}}),
        ):
            worker_main.run_meta_platforms(job, [instagram, facebook], True)

        self.assertEqual(run_platform.call_count, 2)
        self.assertEqual(results["instagram"]["state"], "failed")
        self.assertIn("Unexpected Meta publisher error", results["instagram"]["error"])
        self.assertEqual(results["facebook"]["state"], "published")

    def test_facebook_reconciliation_accepts_published_video_status(self):
        publisher = unittest.mock.MagicMock(
            instagram_user_id="ig-1", facebook_page_id="page-1"
        )
        publisher.facebook_reel_status.return_value = {
            "status": {"video_status": "published"}
        }
        results = {
            "facebook": {
                "provider": "meta",
                "state": "outcome_unknown",
                "stage": "publishing",
                "providerRequestId": "video-1",
            }
        }
        with patch.object(worker_main, "MetaPublisher", return_value=publisher):
            worker_main.run_meta_platform(
                {"yixiaoerAction": "publish", "dramaTitle": "Drama", "episodeNumber": 1},
                {"source": "facebook", "caption": "Caption"},
                results,
                None,
            )

        self.assertEqual(results["facebook"]["state"], "published")
        self.assertEqual(results["facebook"]["platformPostId"], "video-1")
        publisher.finish_facebook_reel.assert_not_called()

    def test_facebook_retries_same_upload_after_confirmed_upload_failure(self):
        publisher = unittest.mock.MagicMock(
            instagram_user_id="ig-1", facebook_page_id="page-1"
        )
        publisher.facebook_reel_status.return_value = {
            "status": {"uploading_phase": {"status": "failed"}}
        }
        publisher.upload_facebook_reel.return_value = {"success": True}
        publisher.finish_facebook_reel.return_value = {"success": True}
        publisher.wait_for_facebook_reel.return_value = {
            "status": {"publishing_phase": {"status": "complete"}}
        }
        results = {
            "facebook": {
                "provider": "meta",
                "state": "outcome_unknown",
                "stage": "started",
                "providerRequestId": "video-1",
                "uploadUrl": "https://rupload.facebook.com/video-1",
            }
        }
        with (
            patch.object(worker_main, "MetaPublisher", return_value=publisher),
            patch.object(worker_main, "publish_update"),
        ):
            worker_main.run_meta_platform(
                {"yixiaoerAction": "publish", "dramaTitle": "Drama", "episodeNumber": 1, "videoUrl": "https://cdn.example/video.mp4"},
                {"source": "facebook", "caption": "Caption"},
                results,
                None,
            )

        publisher.start_facebook_reel.assert_not_called()
        publisher.upload_facebook_reel.assert_called_once_with(
            "https://rupload.facebook.com/video-1", "https://cdn.example/video.mp4"
        )
        self.assertEqual(results["facebook"]["state"], "published")

    def test_instagram_meta_flow_persists_container_before_publish(self):
        publisher = unittest.mock.MagicMock(
            instagram_user_id="ig-1", facebook_page_id="page-1"
        )
        publisher.create_instagram_container.return_value = (
            "container-1",
            {"id": "container-1"},
        )
        publisher.wait_for_instagram_container.return_value = {
            "id": "container-1",
            "status_code": "FINISHED",
        }
        publisher.publish_instagram_container.return_value = (
            "media-1",
            {"id": "media-1"},
        )
        job = {
            "dramaTitle": "Drama",
            "episodeNumber": 1,
            "videoUrl": "https://cdn.example/video.mp4",
            "yixiaoerAction": "publish",
        }
        results = {}
        with (
            patch.object(worker_main, "MetaPublisher", return_value=publisher),
            patch.object(worker_main, "publish_update") as update,
        ):
            worker_main.run_meta_platform(
                job, {"source": "instagram", "caption": "Caption"}, results, None
            )

        self.assertEqual(results["instagram"]["platformPostId"], "media-1")
        self.assertEqual(results["instagram"]["state"], "published")
        self.assertEqual(update.call_args_list[0].kwargs["results"]["instagram"]["providerRequestId"], "container-1")
        publisher.publish_instagram_container.assert_called_once_with("container-1")

    def test_ambiguous_instagram_publish_is_reconciled_not_reposted(self):
        publisher = unittest.mock.MagicMock(
            instagram_user_id="ig-1", facebook_page_id="page-1"
        )
        publisher.instagram_container_status.return_value = {
            "id": "container-1",
            "status_code": "FINISHED",
        }
        results = {
            "instagram": {
                "provider": "meta",
                "state": "outcome_unknown",
                "stage": "publishing",
                "providerRequestId": "container-1",
            }
        }
        with patch.object(worker_main, "MetaPublisher", return_value=publisher):
            with self.assertRaises(worker_main.MetaOutcomeUnknown):
                worker_main.run_meta_platform(
                    {"yixiaoerAction": "publish", "dramaTitle": "Drama", "episodeNumber": 1},
                    {"source": "instagram", "caption": "Caption"},
                    results,
                    None,
                )

        publisher.create_instagram_container.assert_not_called()
        publisher.publish_instagram_container.assert_not_called()

    def test_instagram_timeout_without_a_record_stays_processing(self):
        details = {"tasks": [{
            "platformName": "Instagram",
            "errorMessage": "timeout of 30000ms exceeded",
        }]}
        with patch.object(worker_main, "yxer", side_effect=[details, {"data": []}]):
            result = worker_main.query_publish_status(
                {"id": "package-1"}, "instagram", "request-1", None
            )
        self.assertEqual(result["state"], "processing")
        self.assertFalse(is_ambiguous_instagram_timeout({"tasks": [{
            "platformName": "Instagram",
            "errorMessage": "timeout of 30000ms exceeded",
            "openUrl": "https://www.instagram.com/reel/DdExample/",
        }]}))

    def test_instagram_missing_account_header_uses_publish_records(self):
        records = {"data": [{
            "id": "request-1",
            "taskSetStatus": "completed",
            "failedTotal": 1,
            "openUrl": "https://www.instagram.com/reel/DdExample/",
        }]}
        with patch.object(
            worker_main,
            "yxer",
            side_effect=[RuntimeError("please provide x-account-id"), records],
        ):
            result = worker_main.query_publish_status(
                {"id": "package-1"}, "instagram", "request-1", None
            )
        self.assertEqual(result["state"], "published")
        self.assertEqual(worker_main.provider_post_id(result, "instagram"), "DdExample")

    def test_terminal_operation_keeps_operation_and_records_diagnostic(self):
        result = terminal_operation(
            {"_operation": {"stage": "uploading_to_yixiaoer", "bytesSent": 10}},
            "failed",
            "timeout; output: last line",
        )
        self.assertEqual(result["stage"], "failed")
        self.assertEqual(result["bytesSent"], 10)
        self.assertEqual(result["error"], "timeout; output: last line")
        self.assertIn("last line", result["diagnostic"])
        self.assertTrue(result["finishedAt"].endswith("Z"))


if __name__ == "__main__":
    unittest.main()
