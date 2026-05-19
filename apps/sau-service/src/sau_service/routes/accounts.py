"""POST /accounts/verify — does an existing storage_state still work?

In mock mode the answer is always "yes" (with no refreshed cookie). Real mode
will spin up a Playwright context with the storage_state, hit a "me" endpoint
on the target platform, and return whether the cookie is still valid.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..auth import require_internal_secret

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_internal_secret)])


class VerifyRequest(BaseModel):
    platform: str
    storageState: dict


class VerifyResponse(BaseModel):
    valid: bool
    refreshedStorageState: dict | None = None
    profile: dict | None = None


@router.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest, request: Request) -> VerifyResponse:
    settings = request.app.state.settings
    if settings.mock_mode:
        # Synthetic: every non-empty storage_state is valid in mock mode.
        valid = bool(req.storageState)
        return VerifyResponse(
            valid=valid,
            profile={"displayName": "mock", "avatarUrl": None} if valid else None,
        )
    # Slice 5 will run Playwright with the storage_state and probe the
    # platform's session API. Until then advertise the fact loudly.
    return VerifyResponse(valid=False)
