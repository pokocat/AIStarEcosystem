"""POST /login/start + GET /login/poll — QR-code login for a social account.

Both endpoints share a single pool object (`app.state.login_pool`) that hides
mock vs. real-mode behind one `start` / `poll` surface. The route layer only
decides what `mock` flag to pass; everything else (Playwright lifecycle, QR
screenshot, storage_state extraction) lives in `login_pool.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from ..auth import require_internal_secret
from ..login_pool import LoginPool, RealLoginUnsupported

router = APIRouter(prefix="/login", tags=["login"], dependencies=[Depends(require_internal_secret)])
log = logging.getLogger(__name__)


class LoginStartRequest(BaseModel):
    ticket: str = Field(min_length=1, max_length=128)
    platform: str = Field(min_length=1, max_length=32)
    accountName: str = Field(min_length=1, max_length=128)


class LoginStartResponse(BaseModel):
    qrImagePngBase64: str | None = None
    qrImageDataUrl: str | None = None
    qrUrl: str | None = None
    alreadyLoggedIn: bool = False
    expiresAt: str


class LoginPollResponse(BaseModel):
    status: str
    storageStatePlain: dict | None = None
    profile: dict | None = None
    interactionRequired: dict | None = None
    errorCode: str | None = None
    message: str | None = None
    diagnosticId: str | None = None


class LoginInteractionRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)


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
    except Exception as exc:
        log.exception("login/start failed ticket=%s platform=%s", req.ticket, req.platform)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "LOGIN_START_FAILED",
                "message": f"启动{req.platform}扫码登录失败：{exc}",
            },
        ) from exc
    return LoginStartResponse(
        qrImageDataUrl=session.qr_image_data_url,
        alreadyLoggedIn=session.already_logged_in,
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
        interactionRequired=result.get("interaction_required"),
        errorCode=result.get("error_code"),
        message=result.get("message"),
        diagnosticId=result.get("diagnostic_id"),
    )


@router.post("/interaction", response_class=Response)
async def login_interaction(ticket: str, payload: LoginInteractionRequest, request: Request) -> Response:
    pool: LoginPool = request.app.state.login_pool
    settings = request.app.state.settings
    result = await pool.submit_interaction(
        ticket,
        {"code": payload.code},
        mock=settings.mock_mode,
    )
    if result == "accepted":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if result == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LOGIN_SESSION_NOT_FOUND", "message": f"ticket {ticket} not found"},
        )
    if result == "submit_failed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INTERACTION_SUBMIT_FAILED",
                "message": "验证码没有填入平台页面，请重新提交或重新生成 QR。",
            },
        )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "INTERACTION_NOT_PENDING",
            "message": f"ticket {ticket} is not currently awaiting user input",
        },
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
