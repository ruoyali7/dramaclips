def retry_upload(operation, on_retry, attempts=2):
    for attempt in range(1, attempts + 1):
        try:
            return operation(attempt)
        except RuntimeError as error:
            if str(error) != "Yixiaoer CLI timed out" or attempt >= attempts:
                raise
            on_retry(attempt + 1)
