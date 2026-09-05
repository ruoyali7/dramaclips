import subprocess
from pathlib import Path


def _positive_float(value):
    try:
        parsed = float(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _frame_rate(value):
    if not value:
        return None
    try:
        numerator, denominator = str(value).split("/", 1)
        parsed = float(numerator) / float(denominator)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError, ZeroDivisionError):
        return _positive_float(value)


def video_timing(info):
    video = next(stream for stream in info["streams"] if stream.get("codec_type") == "video")
    duration = _positive_float(video.get("duration"))
    if duration is None:
        duration_ts = _positive_float(video.get("duration_ts"))
        time_base = _frame_rate(video.get("time_base"))
        duration = duration_ts * time_base if duration_ts and time_base else None
    if duration is None:
        duration = float(info["format"]["duration"])
    fps = _frame_rate(video.get("avg_frame_rate")) or _frame_rate(video.get("r_frame_rate")) or 30.0
    return duration, fps


def ending_frame_timestamps(start, end, video_duration, fps):
    effective_end = min(end, video_duration)
    safe_end = max(start, effective_end - max(0.08, 2 / fps))
    stamps = [max(start, safe_end - offset) for offset in (0, 0.08, 0.2, 0.5, 1.0)]
    return list(dict.fromkeys(stamps))


def extract_ending_frame(source, target, start, end, video_duration, fps):
    target = Path(target)
    last_error = "no frame was produced"
    for stamp in ending_frame_timestamps(start, end, video_duration, fps):
        target.unlink(missing_ok=True)
        result = subprocess.run(
            ["ffmpeg", "-y", "-ss", str(stamp), "-i", str(source), "-map", "0:v:0", "-frames:v", "1", "-q:v", "2", str(target)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        if result.returncode == 0 and target.exists() and target.stat().st_size:
            return stamp
        last_error = result.stderr[-1200:].strip() or f"ffmpeg exited {result.returncode}"
    raise RuntimeError(f"FFmpeg could not extract a safe ending frame: {last_error}")
