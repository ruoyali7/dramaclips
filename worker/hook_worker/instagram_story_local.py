import getpass
import json
import os
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

from .instagram_story import StoryUploadStarted, _session, _session_id, login_story_client, publish_story


WORKER_ID = f"story-local-{socket.gethostname()}"
STATE_DIR = Path.home() / "Library" / "Application Support" / "DramaClips"
AUTH_BLOCK = STATE_DIR / "instagram-story-auth-blocked"


def _config():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", os.getenv("SUPABASE_URL", "")).rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return url, key


def supabase(path, method="GET", payload=None):
    url, key = _config()
    response = requests.request(
        method,
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    if not response.ok:
        raise RuntimeError(f"Supabase {method} {path.split('?')[0]} {response.status_code}: {response.text[:500]}")
    return response.json() if response.content else None


def _lease(rpc, seconds):
    rows = supabase(
        f"rpc/{rpc}",
        method="POST",
        payload={"p_worker_id": WORKER_ID, "p_lease_seconds": seconds},
    ) or []
    return rows[0] if rows else None


def _update_reconnect(attempt, status, error=None):
    rows = supabase(
        "rpc/update_instagram_story_reconnect",
        method="POST",
        payload={"p_id": attempt["id"], "p_worker_id": WORKER_ID, "p_status": status, "p_error": error},
    ) or []
    if not rows:
        raise RuntimeError("Local reconnect lease was lost")


def _update_job(job, status, result=None, error=None):
    rows = supabase(
        "rpc/update_instagram_story_job",
        method="POST",
        payload={"p_id": job["id"], "p_worker_id": WORKER_ID, "p_status": status, "p_result": result, "p_error": error},
    ) or []
    if not rows:
        raise RuntimeError("Local Story lease was lost")


def _block_auth(error):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    AUTH_BLOCK.write_text(str(error)[:900], encoding="utf-8")


def _validated_client():
    try:
        return login_story_client(supabase, allow_session_id=False)
    except Exception as error:
        _block_auth(error)
        raise RuntimeError("Instagram session needs local verification; run the local login command once") from error


def run_once():
    if AUTH_BLOCK.exists():
        return 0

    attempt = _lease("lease_instagram_story_reconnect", 180)
    if attempt:
        try:
            _validated_client()
            _update_reconnect(attempt, "connected")
            print("Home Mac verified Instagram; the page can schedule today's Stories", flush=True)
            return 0
        except Exception as error:
            _update_reconnect(attempt, "failed", str(error)[:900])
            print(str(error), file=sys.stderr, flush=True)
            return 1

    now = quote(datetime.now(timezone.utc).isoformat(), safe="")
    due = supabase(
        f"instagram_story_jobs?status=eq.scheduled&reconnected_at=not.is.null&scheduled_at=lte.{now}&select=id&order=scheduled_at.asc&limit=1"
    ) or []
    if not due:
        return 0

    try:
        client = _validated_client()
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        return 1

    job = _lease("lease_instagram_story_job", 300)
    if not job:
        return 0
    try:
        result = publish_story(job, supabase, client)
        _update_job(job, "published", result=result)
        print(f"Published Instagram Story {job['id']}", flush=True)
    except StoryUploadStarted as error:
        _update_job(job, "outcome_unknown", error=f"Story upload may have started: {str(error)[:850]}")
        return 1
    except Exception as error:
        _update_job(job, "failed", error=str(error)[:900])
        return 1
    return 0


def login():
    from instagrapi import Client
    from instagrapi.exceptions import ChallengeRequired, TwoFactorRequired

    client = Client()
    saved = _session(supabase)
    if saved:
        client.set_settings(saved)
    username = input("Instagram username: ").strip()
    password = getpass.getpass("Instagram password (not stored): ")
    try:
        client.login(username, password)
    except TwoFactorRequired:
        for attempt in range(3):
            code = input(
                "Instagram 2FA code (6-digit authenticator/SMS/WhatsApp or 8-digit backup code): "
            ).strip()
            if not code:
                print("A verification code is required; the Instagram Allow prompt is not the code.")
                continue
            try:
                client.login(username, password, verification_code=code)
                break
            except TwoFactorRequired:
                if attempt == 2:
                    raise
                print("That code was not accepted or expired. Generate a new code and try again.")
        else:
            raise RuntimeError("Instagram verification code was not provided")
    except ChallengeRequired:
        input("Approve the login in the official Instagram app, then press Return here: ")
        client.challenge_bloks_redirect_dismiss()
    client.get_timeline_feed()
    supabase("rpc/save_instagram_story_session", method="POST", payload={"p_session": client.get_settings()})
    AUTH_BLOCK.unlink(missing_ok=True)
    print("Instagram device session saved. The local Story agent is ready.")


def bootstrap_session_id():
    from instagrapi import Client

    session_id = _session_id(supabase)
    if not session_id:
        raise RuntimeError("No Instagram browser sessionid is saved")
    client = Client()
    client.login_by_sessionid(session_id)
    client.get_timeline_feed()
    supabase("rpc/save_instagram_story_session", method="POST", payload={"p_session": client.get_settings()})
    AUTH_BLOCK.unlink(missing_ok=True)
    print("Instagram browser session converted to a device session. The local Story agent is ready.")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "login":
        raise SystemExit(login())
    if command == "bootstrap-session-id":
        raise SystemExit(bootstrap_session_id())
    raise SystemExit(run_once())
