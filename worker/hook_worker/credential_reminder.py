from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")
AWAKE_START = time(10, 30)
AWAKE_END = time(23, 30)
BEDTIME_REMINDER = time(22, 30)


def parse_timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def credential_times(updated_at):
    expires_at = parse_timestamp(updated_at) + timedelta(hours=24)
    normal_reminder = expires_at - timedelta(hours=1)
    local_reminder = normal_reminder.astimezone(PACIFIC)
    if local_reminder.time() < AWAKE_START:
        local_reminder = datetime.combine(local_reminder.date() - timedelta(days=1), BEDTIME_REMINDER, PACIFIC)
    elif local_reminder.time() > AWAKE_END:
        local_reminder = datetime.combine(local_reminder.date(), BEDTIME_REMINDER, PACIFIC)
    return local_reminder.astimezone(timezone.utc), expires_at


def is_awake(now):
    local_time = now.astimezone(PACIFIC).time()
    return AWAKE_START <= local_time <= AWAKE_END


def notification_due(now, updated_at, upcoming_sent_at=None, expired_sent_at=None):
    now = now.astimezone(timezone.utc)
    reminder_at, expires_at = credential_times(updated_at)
    if now >= expires_at:
        if not expired_sent_at and is_awake(now):
            return "expired", reminder_at, expires_at
        return None, reminder_at, expires_at
    if not upcoming_sent_at and now >= reminder_at and is_awake(now):
        return "upcoming", reminder_at, expires_at
    return None, reminder_at, expires_at
