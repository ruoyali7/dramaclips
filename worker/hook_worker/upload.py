def retry_upload(operation, on_retry, attempts=2):
    for attempt in range(1, attempts + 1):
        try:
            return operation(attempt)
        except RuntimeError as error:
            if not str(error).startswith("Yixiaoer CLI timed out") or attempt >= attempts:
                raise
            on_retry(attempt + 1)


def video_upload_timeout(size_bytes):
    """Allow large source episodes more time without slowing normal hook failures."""
    fifteen_megabytes = 15 * 1024 * 1024
    size_tiers = max(1, (size_bytes + fifteen_megabytes - 1) // fifteen_megabytes)
    return min(5400, size_tiers * 1800)


def should_optimize_publish_video(video_kind, size_bytes):
    return video_kind == "original" and size_bytes > 20 * 1024 * 1024


def primary_publish_channel(requested, client_id):
    return "local" if requested.lower() == "local" and client_id.strip() else "cloud"
