"""Internal-secret auth — mirrors apps/server's InternalAuthFilter.

Every route except `/healthz` requires `X-Internal-Secret: <shared>`.
"""

from __future__ import annotations

from fastapi import Header, HTTPException, Request, status


async def require_internal_secret(
    request: Request,
    x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    expected = request.app.state.settings.internal_secret
    if not x_internal_secret or x_internal_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INTERNAL_AUTH", "message": "missing or invalid X-Internal-Secret"},
        )
