"""In-memory login session pool — backs both mock and real-mode QR login.

Mock mode (default):
  - `start` (mock=True) mints a synthetic QR + storage_state pair inline.
  - `poll` (mock=True) walks a deterministic 2-step pending → success path.

Real mode (SAU_MOCK_MODE=0):
  - `start` (mock=False) launches a patchright (stealth Playwright fork)
    browser, navigates to the platform's creator login page, and reads the
    QR `<img>`'s `src` attribute (which is a `data:image/...` URL already
    rendered by the platform's own login widget — same approach the
    upstream sau library uses). Stashes {playwright, browser, context,
    page} on the session so subsequent polls can re-check the page state.
  - `poll` (mock=False) asks the platform driver whether the page is
    showing "logged in" markers (URL prefix + scan-prompt elements
    invisible). If yes we dump `context.storage_state()` and tear the
    browser down. Otherwise we return "pending".
  - Sessions that expire / are dropped trigger the same teardown.

`patchright` is a function-local import so the slim mock-mode container
(which doesn't install the [real] extra) keeps importing this module fine.

## Per-platform logic

All platform-specific selectors live on `PlatformDriver` subclasses (one
per platform). To add a new v1-enabled platform:
  1. Subclass PlatformDriver, override LOGIN_URL + the 3 async methods.
  2. Register the class in DRIVERS.
That's the entire wire-up — `_start_real` / `_poll_real` / verify all
dispatch through the driver.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from .qr import build_mock_qr

log = logging.getLogger(__name__)


# ─── Platform drivers ────────────────────────────────────────────────────
#
# Selectors mirror the pinned upstream `pokocat/social-auto-upload`
# (`uploader.<platform>_uploader.main._extract_*_qrcode_src` +
# `_is_*_login_completed`). If a platform redesigns its login page the fix
# is here, in one file, in one class — no cross-cutting dict updates.


class PlatformDriver:
    """Abstract driver — one subclass per v1-enabled platform."""

    #: URL we navigate to at /login/start; usually the creator-center root.
    LOGIN_URL: str = ""

    @classmethod
    async def extract_qr_data_url(cls, page: Any) -> str:
        """Return the QR as a `data:image/...` URL.

        The platform's own login widget already renders the QR as an
        `<img>` whose `src` is a data URL — we just read that attribute.
        No screenshot needed (and no cropping math to maintain).
        """
        raise NotImplementedError

    @classmethod
    async def is_logged_in(cls, page: Any) -> bool:
        """True iff the page shows a logged-in state.

        Used by /login/poll (does the in-flight bind session see the user
        finishing the scan?) AND /accounts/verify (does an existing
        storage_state still work when preloaded into a fresh context?).
        """
        raise NotImplementedError

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        """Best-effort profile pull post-login. Never raises — falls back to
        `{displayName: account_name, avatarUrl: None}` if probing fails."""
        return {"displayName": account_name, "avatarUrl": None}


class DouyinDriver(PlatformDriver):
    """抖音 creator center.

    QR widget: `<img aria-label="二维码">` adjacent to the "扫码登录" tab.
    Logged-in URL: `https://creator.douyin.com/creator-micro/home`.
    """

    LOGIN_URL = "https://creator.douyin.com/"
    LOGGED_IN_URL_PREFIX = "https://creator.douyin.com/creator-micro/home"

    @classmethod
    async def extract_qr_data_url(cls, page: Any) -> str:
        # Mirror upstream's `_extract_douyin_qrcode_src`: locate the
        # "扫码登录" tab → parent → next sibling div → the QR img inside.
        # Fallback: role-based locator. 30s waits to handle slow first-load.
        scan_tab = page.get_by_text("扫码登录", exact=True).first
        await scan_tab.wait_for(timeout=30000)
        qr_img = (
            scan_tab.locator("..")
            .locator("xpath=following-sibling::div[1]")
            .locator('img[aria-label="二维码"]')
            .first
        )
        if not await qr_img.count():
            qr_img = page.get_by_role("img", name="二维码").first
        await qr_img.wait_for(state="visible", timeout=30000)
        src = await qr_img.get_attribute("src")
        if not src or not src.startswith("data:image/"):
            raise RuntimeError("douyin: QR src missing or not a data: URL")
        return src

    @classmethod
    async def is_logged_in(cls, page: Any) -> bool:
        if not page.url.startswith(cls.LOGGED_IN_URL_PREFIX):
            return False
        # URL alone isn't sufficient — the page can briefly hold this URL
        # while still painting the login modal. Also confirm no login UI
        # is visible.
        login_markers = [
            page.get_by_text("扫码登录", exact=True).first,
            page.get_by_text("手机号登录", exact=True).first,
            page.get_by_text("二维码失效", exact=True).first,
            page.get_by_role("img", name="二维码").first,
        ]
        for marker in login_markers:
            try:
                if await marker.count() and await marker.is_visible():
                    return False
            except Exception:  # noqa: BLE001
                continue
        return True

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        fallback = {"displayName": account_name, "avatarUrl": None}
        try:
            name_el = await page.query_selector("div.name, div.creator-name, span.username")
            avatar_el = await page.query_selector("img.avatar, div.avatar img, img.user-avatar")
            display = (await name_el.inner_text()).strip() if name_el else account_name
            avatar = await avatar_el.get_attribute("src") if avatar_el else None
            return {"displayName": display or account_name, "avatarUrl": avatar}
        except Exception:  # noqa: BLE001
            return fallback


class ShipinhaoDriver(PlatformDriver):
    """视频号 (WeChat Channels) creator center.

    QR widget: lives inside `iframe[src*=login-for-iframe]` as `div#app
    img.qrcode`. Logged-in URLs: `/platform/post/create`, `/platform/post/
    list` (we also accept the broader `/platform/*` since post-scan landing
    can be the dashboard or any inner page).
    """

    LOGIN_URL = "https://channels.weixin.qq.com"
    UPLOAD_URL = "https://channels.weixin.qq.com/platform/post/create"
    MANAGE_URL = "https://channels.weixin.qq.com/platform/post/list"

    @classmethod
    async def extract_qr_data_url(cls, page: Any) -> str:
        # iframe first — that's where the widget is on the current build.
        if hasattr(page, "frame_locator"):
            try:
                iframe = page.frame_locator('[src*="login-for-iframe"]')
                qr = iframe.locator("div#app img.qrcode").first
                await qr.wait_for(state="visible", timeout=30000)
                src = await qr.get_attribute("src")
                if src and src.startswith("data:image/"):
                    return src
            except Exception:  # noqa: BLE001
                pass
        # Fallback CSS — covers legacy builds and "QR escaped iframe" states.
        for selector in (
            "div.login-qrcode-wrap img.qrcode",
            "div.qrcode-wrap img.qrcode",
            "img.qrcode",
            'img[src^="data:image/"]',
        ):
            qr = page.locator(selector).first
            try:
                if not await qr.count() or not await qr.is_visible():
                    continue
                src = await qr.get_attribute("src")
                if src and src.startswith("data:image/"):
                    return src
            except Exception:  # noqa: BLE001
                continue
        raise RuntimeError("shipinhao: QR src not found in iframe or fallback selectors")

    @classmethod
    async def is_logged_in(cls, page: Any) -> bool:
        # Strong signal: publish-page chrome is visible.
        publish_markers = [
            page.locator('div:has-text("发表视频")').first,
            page.locator('button:has-text("发表")').first,
            page.locator('button:has-text("保存草稿")').first,
        ]
        for marker in publish_markers:
            try:
                if await marker.count() and await marker.is_visible():
                    return True
            except Exception:  # noqa: BLE001
                continue
        # Weaker signal: URL is inside /platform/* AND no login UI showing.
        if not page.url.startswith("https://channels.weixin.qq.com/platform"):
            return False
        login_markers = [
            page.locator("div.login-qrcode-wrap").first,
            page.locator("div.qrcode-wrap").first,
            page.locator("img.qrcode").first,
            page.locator('span:has-text("微信扫码登录 视频号助手")').first,
        ]
        for marker in login_markers:
            try:
                if await marker.count() and await marker.is_visible():
                    return False
            except Exception:  # noqa: BLE001
                continue
        return True

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        fallback = {"displayName": account_name, "avatarUrl": None}
        try:
            name_el = await page.query_selector(
                "div.finder-nickname, span.finder-nickname, div.account-name, div.user-name"
            )
            avatar_el = await page.query_selector(
                "img.finder-avatar, div.avatar img, img.user-avatar"
            )
            display = (await name_el.inner_text()).strip() if name_el else account_name
            avatar = await avatar_el.get_attribute("src") if avatar_el else None
            return {"displayName": display or account_name, "avatarUrl": avatar}
        except Exception:  # noqa: BLE001
            return fallback


DRIVERS: dict[str, type[PlatformDriver]] = {
    "douyin": DouyinDriver,
    "shipinhao": ShipinhaoDriver,
}


# Back-compat surface for callers that still want the old-style dicts.
# routes/accounts.py uses these to short-circuit unsupported platforms
# before touching patchright.
LOGIN_PAGE_URLS: dict[str, str] = {p: d.LOGIN_URL for p, d in DRIVERS.items()}


# ─── Session model ──────────────────────────────────────────────────────


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
        driver_cls = DRIVERS.get(platform)
        if driver_cls is None:
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
            await page.goto(driver_cls.LOGIN_URL, wait_until="domcontentloaded")
            # The driver's wait_for() calls inside extract_qr_data_url() are
            # the real timing gate (up to 30s); we don't need a hard sleep.
            qr_data_url = await driver_cls.extract_qr_data_url(page)
        except Exception:
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
        driver_cls = DRIVERS.get(session.platform)
        page = session.handles.get("page")
        context = session.handles.get("context")
        if driver_cls is None or page is None or context is None:
            await self.drop(session.ticket)
            return {"status": "expired"}

        try:
            logged_in = await driver_cls.is_logged_in(page)
        except Exception:  # noqa: BLE001
            log.exception("login_pool: is_logged_in failed ticket=%s", session.ticket)
            await self.drop(session.ticket)
            return {"status": "expired"}

        if not logged_in:
            return {"status": "pending"}

        try:
            storage_state = await context.storage_state()
        except Exception:  # noqa: BLE001
            log.exception("login_pool: storage_state() failed ticket=%s", session.ticket)
            await self.drop(session.ticket)
            return {"status": "expired"}

        profile = await driver_cls.extract_profile(page, session.account_name)
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
