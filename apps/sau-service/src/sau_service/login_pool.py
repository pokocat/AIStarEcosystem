"""In-memory login session pool — backs both mock and real-mode QR login.

Mock mode (default):
  - `start` (mock=True) mints a synthetic QR + storage_state pair inline.
  - `poll` (mock=True) walks a deterministic 2-step pending → success path.

Real mode (SAU_MOCK_MODE=0):
  - `start` (mock=False) launches a patchright (stealth Playwright fork)
    browser, navigates to the platform's creator login page, screenshots the
    visible viewport (which contains the scan-this-with-the-app QR), and
    stashes {playwright, browser, context, page} on the session so
    subsequent polls can re-check the page state.
  - `poll` (mock=False) checks `page.url` against a logged-in URL fragment;
    if it matches we dump `context.storage_state()` and tear the browser
    down. Otherwise we return "pending".
  - Sessions that expire / are dropped trigger the same teardown.

`patchright` is a function-local import so the slim mock-mode container
(which doesn't install the [real] extra) keeps importing this module fine.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from .qr import build_mock_qr

log = logging.getLogger(__name__)


# Per-platform creator login URL + "you're logged in now" URL substrings.
# Adding a new v1-enabled platform = add an entry here + verify the fragments
# match what creator.<platform>.com redirects to post-scan.
LOGIN_PAGE_URLS: dict[str, str] = {
    "douyin": "https://creator.douyin.com/",
    # 视频号 (channels) — 微信生态的创作者中心，登录走标准的微信开放平台扫码
    # widget（嵌在 iframe 里，内部由 open.weixin.qq.com 渲染）。打开根路径
    # 即触发 redirect 到 /login 显示 QR。
    "shipinhao": "https://channels.weixin.qq.com/",
}
LOGGED_IN_URL_FRAGMENTS: dict[str, tuple[str, ...]] = {
    # Once the operator scans the QR, douyin's creator hub redirects into
    # `/creator-micro/home` (or sometimes `/creator/home` on legacy builds).
    "douyin": ("creator-micro", "/creator/home", "/creator-center"),
    # 视频号扫码 → 跳到 /platform/post-create 或 /platform/post-list /
    # /platform/home / /platform/profile。所有已登录页都包含 `/platform`，
    # 用它做 catch-all；登录页本身路径是 `/login`，不会误中。
    "shipinhao": ("/platform/post-create", "/platform/post-list", "/platform/home", "/platform/profile", "/platform/account"),
}

# Per-platform QR locator hints, tried in order before falling back to a
# viewport screenshot. iframe-aware: if the strategy starts with `iframe::`
# we'll dive into the frame first.
QR_SELECTORS: dict[str, tuple[str, ...]] = {
    "douyin": (
        "div.web-login-scan-code__content canvas",
        "div.web-login-scan-code__content",
        "div.qrcode-wrapper",
        "canvas.qrcode",
    ),
    # 视频号: QR 通常在 iframe[src*="open.weixin.qq.com/connect/qrconnect"]
    # 里。我们先尝试 iframe 内部 img.qrcode，再 fallback 到 iframe 元素
    # 整体截图，最后才是 viewport。
    "shipinhao": (
        "iframe::img.qrcode",
        "iframe[src*='qrconnect']",
        "img.qrcode",
        "div.qrcode_login_main",
    ),
}


@dataclass
class LoginSession:
    ticket: str
    platform: str
    account_name: str
    expires_at: float
    real_mode: bool = False
    # plaintext storage_state returned exactly once on poll success (mock & real share this)
    storage_state_plain: dict[str, Any] | None = None
    profile: dict[str, Any] | None = None
    qr_image_data_url: str | None = None
    # mock-only: number of polls before flipping to success
    polls_until_success: int = 2
    polls_seen: int = 0
    # real-mode handles: {playwright, browser, context, page}.
    # Kept open between /login/start and /login/poll; closed on success/expire/drop.
    handles: dict[str, Any] = field(default_factory=dict)


class LoginPool:
    """Async-safe ticket → LoginSession registry covering mock + real modes."""

    def __init__(self, ttl_seconds: int) -> None:
        self._sessions: dict[str, LoginSession] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl_seconds

    # ── start / poll ─────────────────────────────────────────────────

    async def start(
        self,
        ticket: str,
        platform: str,
        account_name: str,
        *,
        mock: bool,
        headless: bool = True,
    ) -> LoginSession:
        if mock:
            return await self._start_mock(ticket, platform, account_name)
        return await self._start_real(ticket, platform, account_name, headless=headless)

    async def poll(self, ticket: str, *, mock: bool) -> dict[str, Any]:
        """Return `{"status": "pending" | "success" | "expired", ...}`.

        On success the caller gets `storage_state` + `profile` exactly once;
        the session is then dropped. Both modes share the same surface so the
        FastAPI handler doesn't have to branch.
        """
        async with self._lock:
            self._sweep_locked()
            session = self._sessions.get(ticket)
        if session is None:
            return {"status": "expired"}
        if time.time() > session.expires_at:
            await self.drop(ticket)
            return {"status": "expired"}
        if mock:
            return await self._poll_mock(session)
        return await self._poll_real(session)

    # Legacy accessor still used by a couple of inline tests; keep it cheap.
    async def get(self, ticket: str) -> LoginSession | None:
        async with self._lock:
            self._sweep_locked()
            return self._sessions.get(ticket)

    # ── teardown ─────────────────────────────────────────────────────

    async def drop(self, ticket: str) -> None:
        async with self._lock:
            session = self._sessions.pop(ticket, None)
        if session is not None:
            await self._teardown_handles(session)

    async def mark_success_and_drop(self, ticket: str) -> LoginSession | None:
        """Compat shim retained for older callers that consumed sessions directly."""
        async with self._lock:
            session = self._sessions.pop(ticket, None)
        if session is not None:
            await self._teardown_handles(session)
        return session

    async def sweep_expired(self) -> int:
        """Drop expired sessions; teardown their browser handles outside the lock."""
        async with self._lock:
            now = time.time()
            expired = [t for t, s in self._sessions.items() if s.expires_at < now]
            taken = [self._sessions.pop(t) for t in expired]
        for session in taken:
            await self._teardown_handles(session)
        return len(taken)

    async def shutdown_all(self) -> None:
        """Tear down every open browser handle; used by FastAPI lifespan exit."""
        async with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for session in sessions:
            await self._teardown_handles(session)

    # ── internal: mock-mode ───────────────────────────────────────────

    async def _start_mock(self, ticket: str, platform: str, account_name: str) -> LoginSession:
        async with self._lock:
            session = LoginSession(
                ticket=ticket,
                platform=platform,
                account_name=account_name,
                expires_at=time.time() + self._ttl,
                real_mode=False,
                qr_image_data_url=build_mock_qr(platform, account_name),
                storage_state_plain=_mock_storage_state(platform, account_name),
                profile={
                    "displayName": f"mock-{account_name}",
                    "avatarUrl": f"https://picsum.photos/seed/{account_name}/64",
                },
            )
            self._sessions[ticket] = session
            return session

    async def _poll_mock(self, session: LoginSession) -> dict[str, Any]:
        session.polls_seen += 1
        if session.polls_seen < session.polls_until_success:
            return {"status": "pending"}
        # consume the session; cookie returned exactly once
        await self.drop(session.ticket)
        return {
            "status": "success",
            "storage_state": session.storage_state_plain,
            "profile": session.profile,
        }

    # ── internal: real-mode (patchright) ──────────────────────────────

    async def _start_real(
        self,
        ticket: str,
        platform: str,
        account_name: str,
        *,
        headless: bool,
    ) -> LoginSession:
        if platform not in LOGIN_PAGE_URLS:
            raise RealLoginUnsupported(platform)
        from patchright.async_api import async_playwright  # type: ignore[import-not-found]

        playwright = await async_playwright().start()
        browser = None
        context = None
        page = None
        try:
            browser = await playwright.chromium.launch(headless=headless)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()
            await page.goto(LOGIN_PAGE_URLS[platform], wait_until="domcontentloaded")
            # Allow the SPA + QR widget time to render before screenshot.
            # 视频号 the QR sits inside an open.weixin.qq.com iframe, so it
            # needs a touch longer than douyin's pure-canvas widget.
            await page.wait_for_timeout(3500 if platform == "shipinhao" else 2500)
            qr_data_url = await _screenshot_qr(page, platform)
        except Exception:
            # Tear partial handles back down so we don't leak browsers on bad start.
            await _safe_close(context, "context")
            await _safe_close(browser, "browser")
            await _safe_close(playwright, "playwright", method="stop")
            raise

        session = LoginSession(
            ticket=ticket,
            platform=platform,
            account_name=account_name,
            expires_at=time.time() + self._ttl,
            real_mode=True,
            qr_image_data_url=qr_data_url,
            handles={"playwright": playwright, "browser": browser, "context": context, "page": page},
        )
        async with self._lock:
            self._sessions[ticket] = session
        return session

    async def _poll_real(self, session: LoginSession) -> dict[str, Any]:
        page = session.handles.get("page")
        context = session.handles.get("context")
        if page is None or context is None:
            await self.drop(session.ticket)
            return {"status": "expired"}

        try:
            current_url = page.url
        except Exception:  # noqa: BLE001
            log.exception("login_pool: reading page.url failed ticket=%s", session.ticket)
            await self.drop(session.ticket)
            return {"status": "expired"}

        fragments = LOGGED_IN_URL_FRAGMENTS.get(session.platform, ())
        if not any(frag in current_url for frag in fragments):
            return {"status": "pending"}

        # Logged in — dump storage_state + best-effort profile, then teardown.
        try:
            storage_state = await context.storage_state()
        except Exception:  # noqa: BLE001
            log.exception("login_pool: storage_state() failed ticket=%s", session.ticket)
            await self.drop(session.ticket)
            return {"status": "expired"}

        profile = await _extract_profile_safely(page, session.platform, session.account_name)
        await self.drop(session.ticket)
        return {
            "status": "success",
            "storage_state": storage_state,
            "profile": profile,
        }

    # ── internal: shared ─────────────────────────────────────────────

    async def _teardown_handles(self, session: LoginSession) -> None:
        if not session.handles:
            return
        context = session.handles.pop("context", None)
        browser = session.handles.pop("browser", None)
        playwright = session.handles.pop("playwright", None)
        await _safe_close(context, "context")
        await _safe_close(browser, "browser")
        await _safe_close(playwright, "playwright", method="stop")

    def _sweep_locked(self) -> int:
        """Lock-held sweep used inside `poll`; teardown of browser handles is
        deferred to the public `sweep_expired` outside the lock so we don't
        nest async work inside the critical section."""
        now = time.time()
        expired = [t for t, s in self._sessions.items() if s.expires_at < now]
        for t in expired:
            self._sessions.pop(t, None)
        return len(expired)


class RealLoginUnsupported(Exception):
    """Raised when real-mode login is requested for a platform we haven't wired."""

    def __init__(self, platform: str) -> None:
        super().__init__(platform)
        self.platform = platform


# ── helpers ──────────────────────────────────────────────────────────


async def _screenshot_qr(page: Any, platform: str) -> str:
    """Capture a base64-encoded PNG of the login page so the operator can scan.

    Tries platform-specific QR locators first (smaller payload + clearer image),
    falls back to a viewport screenshot when nothing resolves — login pages
    occasionally swap which canvas/img/iframe hosts the QR, and a fallback
    keeps `/login/start` from 500'ing instead of just showing the operator a
    slightly-bigger picture.

    Supports an `iframe::<inner-selector>` strategy for platforms whose QR is
    rendered inside a cross-origin frame (视频号 uses open.weixin.qq.com).
    """
    selectors = QR_SELECTORS.get(platform, ())
    for sel in selectors:
        try:
            if sel.startswith("iframe::"):
                inner = sel.removeprefix("iframe::")
                png = await _shot_in_iframe(page, inner)
                if png is not None:
                    return _png_to_data_url(png)
                continue
            element = await page.query_selector(sel)
            if element is None:
                continue
            png_bytes = await element.screenshot(type="png")
            return _png_to_data_url(png_bytes)
        except Exception:  # noqa: BLE001
            continue
    png_bytes = await page.screenshot(full_page=False, type="png")
    return _png_to_data_url(png_bytes)


async def _shot_in_iframe(page: Any, inner_selector: str) -> bytes | None:
    """Walk every frame on the page, return the first matching element's PNG."""
    for frame in page.frames:
        try:
            element = await frame.query_selector(inner_selector)
            if element is None:
                continue
            return await element.screenshot(type="png")
        except Exception:  # noqa: BLE001
            continue
    return None


async def _extract_profile_safely(page: Any, platform: str, account_name: str) -> dict[str, Any]:
    """Best-effort post-login profile pull. Never raises — we already have the cookie."""
    fallback = {"displayName": account_name, "avatarUrl": None}
    # Per-platform best-effort selectors. Order = [displayName, avatarUrl].
    # If any platform's site changes its DOM we silently drop to fallback;
    # storage_state was already collected so the bind succeeded either way.
    selectors: dict[str, tuple[str, str]] = {
        "douyin": (
            "div.name, div.creator-name, span.username",
            "img.avatar, div.avatar img, img.user-avatar",
        ),
        "shipinhao": (
            "div.finder-nickname, span.finder-nickname, div.account-name, div.user-name",
            "img.finder-avatar, div.avatar img, img.user-avatar",
        ),
    }
    pair = selectors.get(platform)
    if pair is None:
        return fallback
    name_sel, avatar_sel = pair
    try:
        name_el = await page.query_selector(name_sel)
        avatar_el = await page.query_selector(avatar_sel)
        display = (await name_el.inner_text()).strip() if name_el else account_name
        avatar = await avatar_el.get_attribute("src") if avatar_el else None
        return {"displayName": display or account_name, "avatarUrl": avatar}
    except Exception:  # noqa: BLE001
        log.debug("login_pool: profile probe failed; returning fallback")
        return fallback


async def _safe_close(handle: Any, label: str, *, method: str = "close") -> None:
    if handle is None:
        return
    try:
        fn = getattr(handle, method)
        result = fn()
        if asyncio.iscoroutine(result):
            await result
    except Exception:  # noqa: BLE001
        log.exception("login_pool: closing %s failed", label)


def _png_to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def _mock_storage_state(platform: str, account_name: str) -> dict[str, Any]:
    """A minimally-shaped Playwright storage_state dict for offline testing."""
    return {
        "cookies": [
            {
                "name": f"mock_{platform}_session",
                "value": f"mock-token-for-{account_name}",
                "domain": f".{platform}.example",
                "path": "/",
                "expires": -1,
                "httpOnly": True,
                "secure": True,
                "sameSite": "Lax",
            }
        ],
        "origins": [],
    }
