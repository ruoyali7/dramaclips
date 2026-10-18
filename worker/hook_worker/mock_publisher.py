import hashlib


VALID_OUTCOMES = {"success", "failed", "timeout", "processing"}


def parse_mock_outcomes(value):
    outcomes = {}
    for item in str(value or "").split(","):
        if not item.strip():
            continue
        platform, separator, outcome = item.partition(":")
        platform = platform.strip().lower()
        outcome = outcome.strip().lower()
        if not separator or not platform or outcome not in VALID_OUTCOMES:
            raise RuntimeError("MOCK_PUBLISH_OUTCOMES must contain platform:success|failed|timeout|processing entries")
        outcomes[platform] = outcome
    return outcomes


def mock_platform_result(job, platform, action, prior=None, environ=None):
    values = environ or {}
    outcome = parse_mock_outcomes(values.get("MOCK_PUBLISH_OUTCOMES", "")).get(platform, "success")
    identity = f"{job['id']}:{platform}:{(job.get('yixiaoerAccounts') or {}).get(platform, f'mock-{platform}')}"
    digest = hashlib.sha256(identity.encode()).hexdigest()[:20]
    base = {
        **(prior or {}),
        "provider": "mock",
        "accountId": (job.get("yixiaoerAccounts") or {}).get(platform, f"mock-{platform}"),
        "providerRequestId": f"mock-request-{digest}",
    }
    if action != "publish":
        return {**base, "state": "validated", "error": None}
    if outcome == "success":
        return {**base, "state": "published", "platformPostId": f"mock-post-{digest}", "error": None}
    if outcome == "timeout":
        return {**base, "state": "outcome_unknown", "error": "Simulated publishing timeout; retry is blocked pending reconciliation"}
    if outcome == "processing":
        return {**base, "state": "processing", "error": None}
    return {**base, "state": "failed", "error": "Simulated publishing failure"}
