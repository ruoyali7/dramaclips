def truthy(value):
    return str(value or "").lower() in ("1", "true", "yes", "on")


def load_runtime_config(env):
    oneshot = truthy(env.get("WORKER_ONESHOT"))
    mode = env.get("WORKER_MODE", "cron" if oneshot else "continuous").strip().lower()
    if mode not in ("cron", "continuous"):
        raise RuntimeError("WORKER_MODE must be cron or continuous")
    if (mode == "cron") != oneshot:
        raise RuntimeError("WORKER_MODE=cron requires WORKER_ONESHOT=true; continuous requires false")
    try:
        idle_poll_seconds = max(5, int(env.get("IDLE_POLL_SECONDS", "30")))
    except ValueError as error:
        raise RuntimeError("IDLE_POLL_SECONDS must be an integer") from error
    supabase_url = env.get("SUPABASE_URL", env.get("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip("/")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    production = env.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() == "production"
    if production and not (supabase_url and supabase_key):
        raise RuntimeError("Production worker requires direct Supabase lease configuration")
    return {
        "mode": mode,
        "oneshot": oneshot,
        "idle_poll_seconds": idle_poll_seconds,
        "supabase_url": supabase_url,
        "supabase_key": supabase_key,
        "lease_backend": "supabase" if supabase_url and supabase_key else "control-plane",
    }
