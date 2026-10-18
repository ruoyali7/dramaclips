from urllib.parse import urlparse


def truthy(value):
    return str(value or "").lower() in ("1", "true", "yes", "on")


def _is_local_supabase(url):
    hostname = (urlparse(url).hostname or "").lower()
    return hostname in ("localhost", "127.0.0.1", "::1")


def _remote_development_database_allowed(env, url):
    project_ref = env.get("DEV_SUPABASE_PROJECT_REF", "").strip().lower()
    hostname = (urlparse(url).hostname or "").lower()
    return truthy(env.get("ALLOW_REMOTE_DEVELOPMENT_DB")) and bool(project_ref) and hostname == f"{project_ref}.supabase.co"


def load_runtime_config(env):
    oneshot = truthy(env.get("WORKER_ONESHOT"))
    mode = env.get("WORKER_MODE", "cron" if oneshot else "continuous").strip().lower()
    if mode not in ("cron", "continuous"):
        raise RuntimeError("WORKER_MODE must be cron or continuous")
    if (mode == "cron") != oneshot:
        raise RuntimeError("WORKER_MODE=cron requires WORKER_ONESHOT=true; continuous requires false")
    try:
        idle_poll_seconds = max(5, int(env.get("IDLE_POLL_SECONDS", "30")))
        account_sync_interval_seconds = max(300, int(env.get("ACCOUNT_SYNC_INTERVAL_SECONDS", "300")))
        schedule_notification_interval_seconds = max(60, int(env.get("SCHEDULE_NOTIFICATION_INTERVAL_SECONDS", "60")))
    except ValueError as error:
        raise RuntimeError("Worker intervals must be integers") from error
    supabase_url = env.get("SUPABASE_URL", env.get("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip("/")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    production = env.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() == "production"
    social_publish_mode = env.get("SOCIAL_PUBLISH_MODE", "live").strip().lower()
    if social_publish_mode not in ("mock", "test", "live"):
        raise RuntimeError("SOCIAL_PUBLISH_MODE must be mock, test, or live")
    if production and not (supabase_url and supabase_key):
        raise RuntimeError("Production worker requires direct Supabase lease configuration")
    if production and social_publish_mode != "live":
        raise RuntimeError("Production worker requires SOCIAL_PUBLISH_MODE=live")
    if social_publish_mode in ("mock", "test"):
        if not (supabase_url and supabase_key):
            raise RuntimeError(f"SOCIAL_PUBLISH_MODE={social_publish_mode} requires direct Supabase configuration")
        if not (_is_local_supabase(supabase_url) or _remote_development_database_allowed(env, supabase_url)):
            raise RuntimeError("Local publishing requires local Supabase or an explicitly allowlisted development project")
    if social_publish_mode == "test" and not truthy(env.get("ALLOW_REAL_TEST_PUBLISH")):
        raise RuntimeError("SOCIAL_PUBLISH_MODE=test requires ALLOW_REAL_TEST_PUBLISH=true")
    if social_publish_mode == "live" and not production and supabase_url and not _is_local_supabase(supabase_url) and not truthy(env.get("ALLOW_LOCAL_LIVE_PUBLISH")):
        raise RuntimeError("A local live publisher cannot use remote Supabase unless ALLOW_LOCAL_LIVE_PUBLISH=true")
    return {
        "mode": mode,
        "oneshot": oneshot,
        "idle_poll_seconds": idle_poll_seconds,
        "account_sync_interval_seconds": account_sync_interval_seconds,
        "schedule_notification_interval_seconds": schedule_notification_interval_seconds,
        "supabase_url": supabase_url,
        "supabase_key": supabase_key,
        "social_publish_mode": social_publish_mode,
        "lease_backend": "supabase" if supabase_url and supabase_key else "control-plane",
    }
