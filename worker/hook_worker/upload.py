def retry_upload(operation, on_retry, attempts=2):
    for attempt in range(1, attempts + 1):
        try:
            return operation(attempt)
        except RuntimeError as error:
            if not str(error).startswith("Yixiaoer CLI timed out") or attempt >= attempts:
                raise
            on_retry(attempt + 1)


def primary_publish_channel(requested, client_id):
    return "local" if requested.lower() == "local" and client_id.strip() else "cloud"
