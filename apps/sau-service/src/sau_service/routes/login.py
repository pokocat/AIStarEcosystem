"""POST /login/start + GET /login/poll — QR-code login for a social account.

Mock-mode semantics (Slice 3):
  - /login/start mints a synthetic QR PNG; the synthetic storage_state is
    stashed inside the LoginSession.
  - /login/poll returns "pending" once, then "success" with the synthetic
    storage_state (and removes the session). This is enough for apps/server
    to exercise the full bind flow in tests.

Real-mode (Slice 5) will:
  - Open a Playwright context, navigate to the platform's login page, take a
    screenshot of the QR box, and stash {browser, context} on the session.
  - On poll, check whether the login redirected; if so, dump
    context.storage_state() to JSON and return it.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..auth import require_internal_secret
from ..login_pool import LoginPool

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
    session = await pool.start(req.ticket, req.platform, req.accountName, mock=settings.mock_mode)
    return LoginStartResponse(
        qrImageDataUrl=session.qr_image_data_url,
        expiresAt=datetime.fromtimestamp(session.expires_at, tz=timezone.utc).isoformat(),
    )


@router.get("/poll", response_model=LoginPollResponse)
async def login_poll(ticket: str, request: Request) -> LoginPollResponse:
    pool: LoginPool = request.app.state.login_pool
    settings = request.app.state.settings
    session = await pool.get(ticket)
    if session is None:
        # never started, or already expired/dropped
        return LoginPollResponse(status="expired")
    if datetime.now(tz=timezone.utc).timestamp() > session.expires_at:
        await pool.drop(ticket)
        return LoginPollResponse(status="expired")

    if settings.mock_mode:
        session.polls_seen += 1
        if session.polls_seen < session.polls_until_success:
            return LoginPollResponse(status="pending")
        # consume the session; cookie returned exactly once
        await pool.mark_success_and_drop(ticket)
        return LoginPollResponse(
            status="success",
            storageStatePlain=session.storage_state_plain,
            profile=session.profile,
        )

    # real-mode (Slice 5) — not yet implemented
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "REAL_LOGIN_NOT_WIRED", "message": "Slice 5 hasn't wired Playwright login yet"},
    )
