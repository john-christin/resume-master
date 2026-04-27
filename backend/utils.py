from starlette.requests import Request


def get_client_ip(request: Request) -> str | None:
    """Return the real client IP, respecting X-Forwarded-For from nginx."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else None
