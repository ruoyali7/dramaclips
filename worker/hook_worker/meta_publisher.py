import hashlib
import hmac
import os
import time
from urllib.parse import urlparse

import requests


class MetaApiError(RuntimeError):
    pass


class MetaOutcomeUnknown(RuntimeError):
    pass


def publish_provider(platform, environ=None):
    values = environ if environ is not None else os.environ
    provider = values.get(f"{platform.upper()}_PUBLISH_PROVIDER", "yixiaoer").strip().lower()
    if provider not in ("yixiaoer", "meta"):
        raise RuntimeError(f"Unsupported {platform} publish provider: {provider}")
    if provider == "meta" and platform not in ("instagram", "facebook"):
        raise RuntimeError(f"Meta publishing is not available for {platform}")
    return provider


class MetaPublisher:
    def __init__(self, environ=None, session=None, sleep=None):
        values = environ if environ is not None else os.environ
        self.version = values.get("META_GRAPH_API_VERSION", "").strip()
        self.token = values.get("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
        self.instagram_user_id = values.get("INSTAGRAM_USER_ID", "").strip()
        self.facebook_page_id = values.get("FACEBOOK_PAGE_ID", "").strip()
        self.app_secret = values.get("META_APP_SECRET", "").strip()
        self.graph_url = "https://graph.facebook.com"
        self.session = session or requests.Session()
        self.sleep = sleep or time.sleep

    def validate(self, platform):
        missing = []
        if not self.token:
            missing.append("FACEBOOK_PAGE_ACCESS_TOKEN")
        if not self.version:
            missing.append("META_GRAPH_API_VERSION")
        if not self.app_secret:
            missing.append("META_APP_SECRET")
        if platform == "instagram" and not self.instagram_user_id:
            missing.append("INSTAGRAM_USER_ID")
        if platform == "facebook" and not self.facebook_page_id:
            missing.append("FACEBOOK_PAGE_ID")
        if missing:
            raise MetaApiError(f"Meta publishing is missing: {', '.join(missing)}")

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def validate_access(self, platform):
        self.validate(platform)
        account_id = self.instagram_user_id if platform == "instagram" else self.facebook_page_id
        fields = "id,username" if platform == "instagram" else "id,name"
        return self._request(
            "GET",
            f"{self.graph_url}/{self.version}/{account_id}",
            params={"fields": fields},
        )

    def _params(self, values=None):
        params = dict(values or {})
        if self.app_secret:
            params["appsecret_proof"] = hmac.new(
                self.app_secret.encode(), self.token.encode(), hashlib.sha256
            ).hexdigest()
        return params

    def _request(self, method, url, *, params=None, headers=None, ambiguous=False, include_proof=True):
        attempts = 3 if method == "GET" else 1
        for attempt in range(attempts):
            request_params = self._params(params) if include_proof else dict(params or {})
            try:
                response = self.session.request(
                    method,
                    url,
                    params=request_params,
                    headers={**self._headers(), **(headers or {})},
                    timeout=(15, 60),
                )
            except requests.RequestException as error:
                if attempt + 1 < attempts:
                    self.sleep(attempt + 1)
                    continue
                message = f"Meta {method} request did not return a response: {error}"
                if ambiguous:
                    raise MetaOutcomeUnknown(message) from error
                raise MetaApiError(message) from error
            try:
                data = response.json() if response.content else {}
            except ValueError:
                data = {}
            if not response.ok and attempt + 1 < attempts and (response.status_code == 429 or response.status_code >= 500):
                self.sleep(attempt + 1)
                continue
            if not response.ok:
                detail = data.get("error") if isinstance(data, dict) else None
                message = detail.get("message") if isinstance(detail, dict) else response.text
                code = detail.get("code") if isinstance(detail, dict) else response.status_code
                raise MetaApiError(f"Meta API {code}: {str(message or response.reason)[:700]}")
            if not isinstance(data, dict):
                raise MetaApiError("Meta API returned an invalid response")
            return data

    def create_instagram_container(self, video_url, caption):
        self.validate("instagram")
        data = self._request(
            "POST",
            f"{self.graph_url}/{self.version}/{self.instagram_user_id}/media",
            params={
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption,
                "share_to_feed": "true",
            },
            ambiguous=True,
        )
        if not data.get("id"):
            raise MetaOutcomeUnknown("Meta accepted the Instagram container request without returning an id")
        return str(data["id"]), data

    def instagram_container_status(self, container_id):
        return self._request(
            "GET",
            f"{self.graph_url}/{self.version}/{container_id}",
            params={"fields": "status_code,status"},
        )

    def wait_for_instagram_container(self, container_id, heartbeat=None, attempts=60, interval=10):
        last = {}
        for _ in range(attempts):
            if heartbeat and heartbeat():
                raise MetaApiError("Publishing canceled while Meta processed the Instagram Reel")
            last = self.instagram_container_status(container_id)
            status = str(last.get("status_code") or "").upper()
            if status == "FINISHED":
                return last
            if status in ("ERROR", "EXPIRED"):
                raise MetaApiError(f"Instagram container {status.lower()}: {last.get('status') or 'unknown error'}")
            self.sleep(interval)
        raise MetaApiError(
            f"Instagram container {container_id} is still processing after {attempts * interval} seconds"
        )

    def publish_instagram_container(self, container_id):
        data = self._request(
            "POST",
            f"{self.graph_url}/{self.version}/{self.instagram_user_id}/media_publish",
            params={"creation_id": container_id},
            ambiguous=True,
        )
        if not data.get("id"):
            raise MetaOutcomeUnknown("Meta accepted Instagram publishing without returning a media id")
        return str(data["id"]), data

    def start_facebook_reel(self):
        self.validate("facebook")
        data = self._request(
            "POST",
            f"{self.graph_url}/{self.version}/{self.facebook_page_id}/video_reels",
            params={"upload_phase": "start"},
            ambiguous=True,
        )
        if not data.get("video_id") or not data.get("upload_url"):
            raise MetaOutcomeUnknown("Meta started the Facebook Reel without returning its upload identifiers")
        return str(data["video_id"]), str(data["upload_url"]), data

    def upload_facebook_reel(self, upload_url, video_url):
        if urlparse(upload_url).hostname != "rupload.facebook.com":
            raise MetaApiError("Meta returned an invalid Facebook Reel upload URL")
        return self._request(
            "POST",
            upload_url,
            headers={"Authorization": f"OAuth {self.token}", "file_url": video_url},
            ambiguous=True,
            include_proof=False,
        )

    def finish_facebook_reel(self, video_id, title, caption):
        return self._request(
            "POST",
            f"{self.graph_url}/{self.version}/{self.facebook_page_id}/video_reels",
            params={
                "video_id": video_id,
                "upload_phase": "finish",
                "video_state": "PUBLISHED",
                "title": title[:128],
                "description": caption[:2048],
            },
            ambiguous=True,
        )

    def facebook_reel_status(self, video_id):
        return self._request(
            "GET",
            f"{self.graph_url}/{self.version}/{video_id}",
            params={"fields": "status"},
        )

    def wait_for_facebook_reel(self, video_id, heartbeat=None, attempts=60, interval=10):
        last = {}
        for _ in range(attempts):
            if heartbeat and heartbeat():
                raise MetaApiError("Publishing canceled while Meta processed the Facebook Reel")
            last = self.facebook_reel_status(video_id)
            status = last.get("status") if isinstance(last.get("status"), dict) else {}
            publishing = str((status.get("publishing_phase") or {}).get("status") or "").lower()
            video_status = str(status.get("video_status") or "").lower()
            if publishing == "complete" or video_status == "published":
                return last
            failed = publishing in ("error", "failed") or video_status in ("error", "failed")
            if failed:
                raise MetaApiError(f"Facebook Reel processing failed: {status}")
            self.sleep(interval)
        raise MetaOutcomeUnknown(
            f"Facebook Reel {video_id} did not reach a terminal state within {attempts * interval} seconds"
        )
