"""POST /login/start + GET /login/poll — QR-code login for a social account.

Both endpoints share a single pool object (`app.state.login_pool`) that hides
mock vs. real-mode behind one `start` / `poll` surface. The route layer only
decides what `mock` flag to pass; everything else (Playwright lifecycle, QR
screenshot, storage_state extraction) lives in `login_pool.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from ..auth import require_internal_secret
from ..login_pool import LoginPool, RealLoginUnsupported

router = APIRouter(prefix="/login", tags=["login"], dependencies=[Depends(require_internal_secret)])


class LoginStartRequest(BaseModel):
    ticket: str = Field(min_length=1, max_length=128)
    platform: str = Field(min_length=1, max_length=32)
    accountName: str = Field(min_length=1, max_length=128)


class LoginStartResponse(BaseModel):
    qrImagePngBase64: str | None = None
    qrImageDataUrl: str | None = None
    qrUrl: str | None = None
    expiresAt: str


class LoginPollResponse(BaseModel):
    status: str
    storageStatePlain: dict | None = None
    profile: dict | None = None


@router.post("/start", response_model=LoginStartResponse)
async def login_start(req: LoginStartRequest, request: Request) -> LoginStartResponse:
    pool: LoginPool = request.app.state.login_pool
    settings = request.app.state.settings
    try:
        session = await pool.start(
            req.ticket,
            req.platform,
            req.accountName,
            mock=settings.mock_mode,
            headless=settings.real_login_headless,
        )
    except RealLoginUnsupported as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "code": "PLATFORM_REAL_LOGIN_NOT_WIRED",
                "message": (
                    f"real-mode login for {exc.platform} is not wired; "
                    "flip to SAU_MOCK_MODE=1 or wait for a follow-up slice"
                ),
            },
        )
    return LoginStartResponse(
        qrImageDataUrl=session.qr_image_data_url,
        expiresAt=datetime.fromtimestamp(session.expires_at, tz=timezone.utc).isoformat(),
    )


@router.get("/poll", response_model=LoginPollResponse)
async def login_poll(ticket: str, request: Request) -> LoginPollResponse:
    pool: LoginPool = request.app.state.login_pool
    settings = request.app.state.settings
    result = await pool.poll(ticket, mock=settings.mock_mode)
    return LoginPollResponse(
        status=result["status"],
        storageStatePlain=result.get("storage_state"),
        profile=result.get("profile"),
    )


@router.post("/cancel", response_class=Response)
async def login_cancel(ticket: str, request: Request) -> Response:
    # 用户在前端关掉/取消扫码弹窗时调用。pool.drop() 会触发
    # _teardown_handles → 关 context / browser / playwright，
    # 进而杀掉 patchright 拉起的 chromium 进程。
    # 幂等：ticket 不存在（已 expire / 已 success）时静默成功。
    pool: LoginPool = request.app.state.login_pool
    await pool.drop(ticket)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
