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
import os
import time
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..auth import require_internal_secret
from ..browser_runtime import chromium_launch_kwargs
from ..login_pool import DRIVERS, _safe_close

log = logging.getLogger(__name__)

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_internal_secret)])


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        log.warning("Invalid integer env %s=%r; using default %s", name, raw, default)
        return default


LOGIN_NAV_TIMEOUT_MS = _env_int("SAU_LOGIN_NAV_TIMEOUT_MS", 90_000)


class VerifyRequest(BaseModel):
    platform: str
    storageState: dict


class VerifyResponse(BaseModel):
    valid: bool
    refreshedStorageState: dict | None = None
    profile: dict | None = None


class VerifyLiteResponse(BaseModel):
    status: str
    errorCode: str | None = None
    message: str | None = None
    diagnosticId: str | None = None


@router.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest, request: Request) -> VerifyResponse:
    settings = request.app.state.settings
    if settings.mock_mode:
        # Synthetic: every non-empty storage_state is valid in mock mode.
        valid = bool(req.storageState)
        return VerifyResponse(
            valid=valid,
            profile={
                "displayName": "mock",
                "platformAccountId": f"mock-{req.platform}",
                "avatarUrl": None,
            } if valid else None,
        )

    platform = (req.platform or "").lower()
    driver_cls = DRIVERS.get(platform)
    if driver_cls is None:
        # Platform not in DRIVERS (e.g. bilibili / tiktok / baijiahao / youtube
        # — not yet wired). We can't prove the cookie works, so report invalid
        # to nudge the user/operator to re-bind via whatever flow does exist.
        # Erring on the safe side: a false positive would let jobs start
        # against a dead cookie and burn credits.
        log.warning("verify: platform=%s not wired in real-mode; returning valid=false", platform)
        return VerifyResponse(valid=False)

    return await _verify_real(driver_cls, req.storageState, headless=settings.real_login_headless)


@router.post("/verify-lite", response_model=VerifyLiteResponse)
async def verify_lite(req: VerifyRequest, request: Request) -> VerifyLiteResponse:
    """Cheap cookie probe before dispatching a publish job.

    Only return `invalid` when the HTTP response clearly proves the session is
    gone. Ambiguous anti-bot / SPA / network states return `unknown` so the
    server can fall back to the heavier Patchright verification path.
    """
    settings = request.app.state.settings
    if settings.mock_mode:
        return VerifyLiteResponse(status="valid" if bool(req.storageState) else "invalid")

    platform = (req.platform or "").lower()
    if platform != "douyin":
        return VerifyLiteResponse(
            status="unknown",
            errorCode="VERIFY_LITE_NOT_IMPLEMENTED",
            message=f"{platform} 暂未实现轻量 cookie 校验，需回退浏览器验证",
        )
    return await _verify_douyin_lite(req.storageState)


async def _verify_douyin_lite(storage_state: dict) -> VerifyLiteResponse:
    if not _has_cookie_for_host(storage_state, "douyin.com"):
        return VerifyLiteResponse(
            status="invalid",
            errorCode="COOKIE_EMPTY",
            message="storage_state 中没有抖音域名 cookie",
        )

    url = "https://creator.douyin.com/creator-micro/home"
    diagnostic_id = f"douyin-lite-{int(time.time())}"
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=4.0),
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        ) as client:
            _install_storage_state_cookies(client, storage_state)
            resp = await client.get(url)
        status, error_code, message = _classify_douyin_lite_response(
            str(resp.url), resp.status_code, resp.text or "",
        )
        return VerifyLiteResponse(
            status=status,
            errorCode=error_code,
            message=message,
            diagnosticId=diagnostic_id if status == "unknown" else None,
        )
    except httpx.TimeoutException:
        return VerifyLiteResponse(
            status="unknown",
            errorCode="VERIFY_LITE_TIMEOUT",
            message="轻量 cookie 校验请求超时",
            diagnosticId=diagnostic_id,
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("verify-lite douyin crashed")
        return VerifyLiteResponse(
            status="unknown",
            errorCode="VERIFY_LITE_CRASHED",
            message=f"轻量 cookie 校验异常：{exc}",
            diagnosticId=diagnostic_id,
        )


def _classify_douyin_lite_response(url: str, status_code: int, body: str) -> tuple[str, str | None, str | None]:
    lowered_url = (url or "").lower()
    text = (body or "")[:120_000]
    login_markers = ("扫码登录", "手机号登录", "二维码失效", "登录后可使用", "请登录")

    if status_code in {401}:
        return "invalid", "COOKIE_REJECTED", "抖音轻量校验返回未登录"
    if "passport.douyin.com" in lowered_url or "/login" in lowered_url:
        return "invalid", "COOKIE_REDIRECT_LOGIN", "抖音轻量校验跳转到登录页"
    if any(marker in text for marker in login_markers):
        return "invalid", "COOKIE_LOGIN_PAGE", "抖音轻量校验页面仍显示登录入口"
    if status_code in {403, 429}:
        return "unknown", "VERIFY_LITE_BLOCKED", "抖音轻量校验被平台风控或限流"
    if status_code >= 500:
        return "unknown", "VERIFY_LITE_PLATFORM_5XX", "抖音轻量校验返回平台错误"
    if status_code >= 400:
        return "unknown", "VERIFY_LITE_HTTP_ERROR", f"抖音轻量校验返回 HTTP {status_code}"
    if "creator.douyin.com/creator-micro" in lowered_url:
        return "valid", None, None
    if "__ac_nonce" in text or "creator-micro" in text:
        return "valid", None, None
    return "unknown", "VERIFY_LITE_UNRECOGNIZED", "抖音轻量校验无法识别页面登录态"


def _has_cookie_for_host(storage_state: dict, host_suffix: str) -> bool:
    cookies = storage_state.get("cookies") if isinstance(storage_state, dict) else None
    if not isinstance(cookies, list):
        return False
    suffix = host_suffix.lstrip(".").lower()
    for cookie in cookies:
        if not isinstance(cookie, dict):
            continue
        domain = str(cookie.get("domain") or "").lstrip(".").lower()
        value = str(cookie.get("value") or "")
        if value and (domain == suffix or domain.endswith("." + suffix)):
            return True
    return False


def _install_storage_state_cookies(client: httpx.AsyncClient, storage_state: dict) -> None:
    cookies = storage_state.get("cookies") if isinstance(storage_state, dict) else None
    if not isinstance(cookies, list):
        return
    for cookie in cookies:
        if not isinstance(cookie, dict):
            continue
        name = str(cookie.get("name") or "")
        value = str(cookie.get("value") or "")
        domain = str(cookie.get("domain") or "").lstrip(".")
        path = str(cookie.get("path") or "/")
        if not name or not value or not domain:
            continue
        # Keep cookies scoped to their original host suffix. httpx accepts the
        # browser storage_state domain once the leading dot is removed.
        parsed = urlparse("https://" + domain)
        if not parsed.hostname:
            continue
        client.cookies.set(name, value, domain=domain, path=path)


async def _verify_real(driver_cls, storage_state: dict, *, headless: bool) -> VerifyResponse:
    """Spawn a fresh chromium, preload storage_state, ask the driver if logged in.

    On success we return a `refreshedStorageState` so the server can rotate
    its encrypted blob (most platforms refresh session/csrf cookies on every
    visit — effective auto-renewal). On any exception we return valid=False
    — false positives would let users start jobs against a dead cookie and
    burn credits, which is much worse than the rare false-negative.
    """
    from patchright.async_api import async_playwright  # type: ignore[import-not-found]

    playwright = await async_playwright().start()
    browser = None
    context = None
    try:
        browser = await playwright.chromium.launch(**chromium_launch_kwargs(headless=headless))
        # storage_state arrives as plain dict — patchright accepts it directly.
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            storage_state=storage_state,
        )
        page = await context.new_page()
        await page.goto(
            driver_cls.LOGIN_URL,
            wait_until="domcontentloaded",
            timeout=LOGIN_NAV_TIMEOUT_MS,
        )
        # Settle for SPA redirect post-cookie-load before the driver samples
        # URL + login markers. 2.5s is what the bind path uses; matches.
        await page.wait_for_timeout(2500)

        if not await driver_cls.is_logged_in(page):
            log.info("verify: cookie rejected platform=%s landed_on=%s",
                     driver_cls.__name__, page.url)
            return VerifyResponse(valid=False)

        # Mirror login_pool._poll_real — let the driver navigate / interact to
        # expose profile fields before we snapshot storage_state + extract.
        try:
            await driver_cls.prepare_profile_view(page)
        except Exception:  # noqa: BLE001
            log.exception("verify: prepare_profile_view crashed platform=%s",
                          driver_cls.__name__)

        refreshed = await context.storage_state()
        profile = await driver_cls.extract_profile(page, "")
        return VerifyResponse(
            valid=True,
            refreshedStorageState=refreshed,
            profile=profile,
        )
    except Exception:  # noqa: BLE001
        log.exception("verify: real-mode probe crashed platform=%s — treating as invalid", driver_cls.__name__)
        return VerifyResponse(valid=False)
    finally:
        await _safe_close(context, "verify-context")
        await _safe_close(browser, "verify-browser")
        await _safe_close(playwright, "verify-playwright", method="stop")
