import requests


def is_transient_network_error(error):
    return isinstance(error, (requests.Timeout, requests.ConnectionError))


def retry_upload(operation, on_retry, attempts=2):
    for attempt in range(1, attempts + 1):
        try:
            return operation(attempt)
        except RuntimeError as error:
            message = str(error).lower()
            retryable = message.startswith("yixiaoer cli timed out") or "tls handshake timeout" in message
            if not retryable or attempt >= attempts:
                raise
            on_retry(attempt + 1)


def video_upload_timeout(size_bytes):
    """Allow large source episodes more time without slowing normal hook failures."""
    fifteen_megabytes = 15 * 1024 * 1024
    size_tiers = max(1, (size_bytes + fifteen_megabytes - 1) // fifteen_megabytes)
    return min(5400, size_tiers * 1800)


def should_optimize_publish_video(video_kind, size_bytes):
    return video_kind == "original" and size_bytes > 20 * 1024 * 1024


def publish_video_optimization_command(source, target):
    return [
        "ffmpeg", "-y", "-filter_threads", "1", "-filter_complex_threads", "1",
        "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p",
        "-c:v", "libx264", "-threads:v", "1", "-preset", "veryfast", "-crf", "26",
        "-maxrate", "1800k", "-bufsize", "3600k", "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart", str(target),
    ]


def primary_publish_channel(requested, client_id):
    return "local" if requested.lower() == "local" and client_id.strip() else "cloud"
