import os

import requests


def send_telegram(message):
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return False
    response = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": message},
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"Telegram sendMessage returned {response.status_code}")
    return True


def notify_publish_failure(job, status, results, error=None):
    affected = []
    details = []
    for platform, value in (results or {}).items():
        if platform.startswith("_") or not isinstance(value, dict):
            continue
        state = str(value.get("state") or "")
        if state not in ("failed", "outcome_unknown"):
            continue
        affected.append(f"{platform}: {state}")
        if value.get("error"):
            details.append(str(value["error"]))
    summary = str(error or (details[0] if details else "No provider error was recorded"))[:500]
    title = str(job.get("dramaTitle") or job.get("dramaSlug") or "Unknown drama")
    platforms = ", ".join(affected) or status
    return send_telegram(
        f"🚨 DramaClips publish needs attention\n"
        f"{title} · EP {job.get('episodeNumber', '?')}\n"
        f"Status: {status}\nPlatforms: {platforms}\n"
        f"Error: {summary}\nPackage: {job.get('id', 'unknown')}"
    )


def notify_scheduled_queue_nearly_finished(remaining, last_scheduled_at):
    return send_telegram(
        "📦 DramaClips 排期即将发布完，请补货\n"
        f"未来 scheduled original 剩余：{remaining} 条\n"
        f"最后一条计划发布时间：{last_scheduled_at or '?'}\n"
        "请现在补充 Drama Library，因为马上需要安排下一个 week。"
    )
