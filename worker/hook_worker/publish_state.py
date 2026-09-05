def provider_request_id(detail):
    if not isinstance(detail, dict):
        return None
    request_id = detail.get("providerRequestId")
    if request_id:
        return str(request_id)
    publish = detail.get("publish")
    if isinstance(publish, dict):
        value = publish.get("taskSetId") or publish.get("requestId")
        if value:
            return str(value)
    return None


def should_resume(detail, retry_requested=False):
    if retry_requested or not isinstance(detail, dict):
        return False
    return detail.get("state") != "published" and provider_request_id(detail) is not None


def find_publish_record(data, request_id):
    rows = data.get("data") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return None
    return next((row for row in rows if str(row.get("id") or "") == request_id), None)


def publish_record_state(record):
    if not isinstance(record, dict):
        return "processing"
    status = str(record.get("taskSetStatus") or "").lower()
    if status == "allsuccessful":
        return "published"
    if int(record.get("failedTotal") or 0) > 0 or "fail" in status:
        return "failed"
    return "processing"


def terminal_operation(detail, stage, error=None):
    operation = dict(detail.get("_operation") or {}) if isinstance(detail, dict) else {}
    operation["stage"] = stage
    from datetime import datetime, timezone
    operation["finishedAt"] = operation.get("finishedAt") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if error:
        operation["error"] = str(error)[:1000]
        operation["diagnostic"] = str(error)[-1000:]
    return operation
