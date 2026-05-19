"""POST /accounts/verify — does an existing storage_state still work?

Mock mode (SAU_MOCK_MODE=1): every non-empty storage_state is "valid". Used
by apps/server's integration tests so they can exercise the post-bind
verify path without a real browser.

Real mode (SAU_MOCK_MODE=0): spin up a patchright chromium context with the
cookie preloaded, navigate to the platform's creator URL, and check whether
the page URL ends up on a logged-in fragment (same heuristic as
`_poll_real`). If yes, dump a fresh `context.storage_state()` so the server
can rotate the encrypted blob — that's effectively cookie auto-renewal
since most platforms refresh session / csrf cookies on every page load.

We could call into upstream's `uploader.douyin_uploader.main.cookie_auth`
(and the tencent equivalent), but they only return a bool and need
per-platform imports that drift when the fork is re-pinned. The
URL-fragment check is platform-uniform, refresh-aware, and shares its
selector list with `_poll_real` (so any later DOM-change fix benefits both
paths automatically).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..auth import require_internal_secret
from ..login_pool import (
    LOGGED_IN_URL_FRAGMENTS,
    LOGIN_PAGE_URLS,
    _extract_profile_safely,
    _safe_close,
)

log = logging.getLogger(__name__)

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

    platform = (req.platform or "").lower()
    if platform not in LOGIN_PAGE_URLS:
        # Platform not wired in real mode (kuaishou / xhs / unknown). We
        # can't prove the cookie works, so report invalid — this nudges the
        # user / operator to re-bind via whatever flow does exist for that
        # platform (currently: manual import for kuaishou/xhs), which is
        # the safer side to err on.
        log.warning("verify: platform=%s not wired in real-mode; returning valid=false", platform)
        return VerifyResponse(valid=False)

    return await _verify_real(platform, req.storageState, headless=settings.real_login_headless)


async def _verify_real(platform: str, storage_state: dict, *, headless: bool) -> VerifyResponse:
    """Spawn a fresh chromium, preload storage_state, check page URL.

    On success we return a `refreshedStorageState` so the server can rotate
    its encrypted blob. On any exception we return valid=False — false
    positives would let users start jobs against a dead cookie and burn
    credits, which is much worse than the rare false-negative.
    """
    from patchright.async_api import async_playwright  # type: ignore[import-not-found]

    playwright = await async_playwright().start()
    browser = None
    context = None
    try:
        browser = await playwright.chromium.launch(headless=headless)
        # storage_state arrives as plain dict — patchright accepts it directly.
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            storage_state=storage_state,
        )
        page = await context.new_page()
        await page.goto(LOGIN_PAGE_URLS[platform], wait_until="domcontentloaded")
        # Same 2.5s settle as _start_real — gives the SPA time to redirect
        # post-cookie-load before we sample the URL.
        await page.wait_for_timeout(2500)

        fragments = LOGGED_IN_URL_FRAGMENTS.get(platform, ())
        current_url = page.url
        valid = any(frag in current_url for frag in fragments)
        if not valid:
            log.info(
                "verify: cookie rejected platform=%s landed_on=%s (no logged-in fragment match)",
                platform, current_url,
            )
            return VerifyResponse(valid=False)

        refreshed = await context.storage_state()
        profile = await _extract_profile_safely(page, platform, "")
        return VerifyResponse(
            valid=True,
            refreshedStorageState=refreshed,
            profile=profile,
        )
    except Exception:  # noqa: BLE001
        log.exception("verify: real-mode probe crashed platform=%s — treating as invalid", platform)
        return VerifyResponse(valid=False)
    finally:
        await _safe_close(context, "verify-context")
        await _safe_close(browser, "verify-browser")
        await _safe_close(playwright, "verify-playwright", method="stop")
