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
import re
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


def _empty_profile() -> dict[str, Any]:
    return {"displayName": None, "platformAccountId": None, "avatarUrl": None}


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = " ".join(value.split())
    return text or None


async def _first_text(page: Any, selectors: tuple[str, ...]) -> str | None:
    for selector in selectors:
        try:
            el = await page.query_selector(selector)
            if not el:
                continue
            text = _clean_text(await el.inner_text())
            if text:
                return text
        except Exception:  # noqa: BLE001
            continue
    return None


async def _first_attr(page: Any, selectors: tuple[str, ...], attr: str) -> str | None:
    for selector in selectors:
        try:
            el = await page.query_selector(selector)
            if not el:
                continue
            value = _clean_text(await el.get_attribute(attr))
            if value:
                return value
        except Exception:  # noqa: BLE001
            continue
    return None


async def _body_text(page: Any) -> str:
    try:
        text = await page.locator("body").inner_text(timeout=1500)
        return text or ""
    except Exception:  # noqa: BLE001
        return ""


def _extract_labeled_account_id(text: str, labels: tuple[str, ...]) -> str | None:
    for label in labels:
        pattern = rf"{re.escape(label)}\s*[:：]?\s*([A-Za-z0-9_.-]{{2,80}})"
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def _extract_text_before_label(text: str, label: str) -> str | None:
    pattern = rf"([^\n|｜]{{1,80}}?)\s*[|｜]\s*{re.escape(label)}"
    match = re.search(pattern, text)
    if match:
        return _clean_text(match.group(1))
    if label not in text:
        return None
    before = text.split(label, 1)[0]
    parts = before.split()
    return _clean_text(parts[-1] if parts else None)


def _is_placeholder_profile_text(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return "加载中" in text or "请稍候" in text or lowered in {"loading", "loading..."}


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
        nullable fields when probing fails."""
        return _empty_profile()


class DouyinDriver(PlatformDriver):
    """抖音 creator center.

    QR widget: `<img aria-label="二维码">` adjacent to the "扫码登录" tab.
    Logged-in URL: `https://creator.douyin.com/creator-micro/home`.
    """

    LOGIN_URL = "https://creator.douyin.com/"
    LOGGED_IN_URL_PREFIX = "https://creator.douyin.com/creator-micro/home"
    PROFILE_READY_TIMEOUT_S = 10.0
    PROFILE_POLL_INTERVAL_MS = 500

    DISPLAY_SELECTORS = (
        "[class*='header-']:has([class*='unique_id']) [class*='left-']",
        "[class*='header-']:has([class*='unique-id']) [class*='left-']",
        "div.name",
        "div.creator-name",
        "span.username",
        "[class*='creator-name']",
        "[class*='nickname']",
        "[class*='Nickname']",
    )
    ACCOUNT_ID_SELECTORS = (
        "[class*='unique_id']",
        "[class*='douyin-id']",
        "[class*='douyinId']",
        "[class*='unique-id']",
        "[class*='uniqueId']",
    )
    AVATAR_SELECTORS = (
        "img.avatar",
        "div.avatar img",
        "img.user-avatar",
        "[class*='avatar'] img",
        "img[class*='avatar']",
    )

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
        try:
            deadline = time.monotonic() + cls.PROFILE_READY_TIMEOUT_S
            profile = _empty_profile()
            while True:
                profile = await cls._read_profile_fields(page)
                if profile["displayName"] or profile["platformAccountId"]:
                    return profile
                if time.monotonic() >= deadline:
                    return profile
                await page.wait_for_timeout(cls.PROFILE_POLL_INTERVAL_MS)
        except Exception:  # noqa: BLE001
            return _empty_profile()

    @classmethod
    async def _read_profile_fields(cls, page: Any) -> dict[str, Any]:
        display = await _first_text(page, cls.DISPLAY_SELECTORS)
        avatar = await _first_attr(page, cls.AVATAR_SELECTORS, "src")
        account_id = await _first_text(page, cls.ACCOUNT_ID_SELECTORS)
        body = await _body_text(page)
        if account_id and ("抖音号" in account_id or "DOUYIN ID" in account_id.upper()):
            account_id = _extract_labeled_account_id(account_id, ("抖音号", "抖音ID", "Douyin ID"))
        if not account_id:
            account_id = _extract_labeled_account_id(
                body,
                ("抖音号", "抖音ID", "Douyin ID"),
            )
        if _is_placeholder_profile_text(display):
            display = None
        if not display:
            display = _extract_text_before_label(body, "抖音号")
        if _is_placeholder_profile_text(display):
            display = None
        return {
            "displayName": display,
            "platformAccountId": account_id,
            "avatarUrl": avatar,
        }


class ShipinhaoDriver(PlatformDriver):
    """视频号 (WeChat Channels) creator center.

    Entry URL: the platform's own post-create page. Visiting it while
    unauthenticated triggers the WeChat QR login overlay (QR widget lives
    inside `iframe[src*=login-for-iframe]` as `div#app img.qrcode`). After
    a successful scan, the platform keeps us on the same `/platform/...`
    URL and the publish-page chrome (`发表视频` / `发表` buttons) becomes
    visible — that's our strong logged-in signal.

    Why /platform/post/create instead of the root domain: the root URL is
    a marketing/landing page on some flights and doesn't reliably expose
    the QR overlay. Upstream `tencent_uploader.cookie_auth` navigates to
    /platform/post/create as well — we mirror that to stay aligned.
    """

    LOGIN_URL = "https://channels.weixin.qq.com/platform/post/create"
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
        # First: is the login QR overlay still visible? If yes, not logged in.
        # The login modal title contains "发表视频" itself, so we can't use that
        # text as a positive signal — we'd false-positive while QR is still up.
        login_markers = [
            page.locator('iframe[src*="login-for-iframe"]').first,
            page.locator("div.login-qrcode-wrap").first,
            page.locator("div.qrcode-wrap").first,
            page.locator('span:has-text("微信扫码登录 视频号助手")').first,
            page.locator('span:has-text("微信扫码登录")').first,
        ]
        for marker in login_markers:
            try:
                if await marker.count() and await marker.is_visible():
                    return False
            except Exception:  # noqa: BLE001
                continue
        # If we're on the QR overlay's iframe, its img.qrcode is inside it.
        # Detect that too — the iframe itself satisfies the check above, but
        # add an explicit fallback in case some flights expose the img with
        # the iframe stripped.
        try:
            iframe_qr = page.frame_locator('[src*="login-for-iframe"]').locator("img.qrcode").first
            if await iframe_qr.count() and await iframe_qr.is_visible():
                return False
        except Exception:  # noqa: BLE001
            pass

        # Then: must be on a /platform/* URL. If unauthenticated navigation
        # redirected us off /platform/*, we're not logged in either.
        if not page.url.startswith("https://channels.weixin.qq.com/platform"):
            return False
        return True

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        try:
            display = await _first_text(page, (
                "div.finder-nickname",
                "span.finder-nickname",
                "div.account-name",
                "div.user-name",
            ))
            avatar = await _first_attr(page, (
                "img.finder-avatar",
                "div.avatar img",
                "img.user-avatar",
            ), "src")
            account_id = _extract_labeled_account_id(await _body_text(page), ("视频号", "Channels ID"))
            return {
                "displayName": display,
                "platformAccountId": account_id,
                "avatarUrl": avatar,
            }
        except Exception:  # noqa: BLE001
            return _empty_profile()


class KuaishouDriver(PlatformDriver):
    """快手 creator center (cp.kuaishou.com).

    Login flow mirrors upstream `ks_uploader.get_ks_cookie`:
      1. Navigate to passport.kuaishou.com's PC login page with a `callback`
         param pointing to cp.kuaishou.com's STS handler — that's where the
         QR widget lives at the TOP level DOM (no iframe).
      2. The login form is `main#login-form`; inside it `div.qr-login
         img[alt="qrcode"]` carries the QR data URL. If the default tab is
         not QR, click `div.platform-switch` to flip — same pattern as
         小红书's tab switcher.
      3. After scan, passport.kuaishou.com hits the callback which sets
         root-domain cookies and redirects to cp.kuaishou.com (publish
         page). We treat any cp.kuaishou.com URL with no `main#login-form`
         visible as logged-in.

    Visiting cp.kuaishou.com directly while unauthenticated wraps the
    passport login in an iframe, which is harder to drive — staying on
    passport.kuaishou.com for the QR flow keeps everything top-level.
    """

    # Upstream KUAISHOU_LOGIN_URL — opens passport.kuaishou.com PC login with a
    # callback that ultimately lands on cp.kuaishou.com/article/publish/video
    # post-scan. URL-encoded chain — `callback=cp.kuaishou.com/rest/infra/sts
    # ?followUrl=cp.kuaishou.com/article/publish/video&setRootDomain=true`.
    LOGIN_URL = (
        "https://passport.kuaishou.com/pc/account/login/"
        "?sid=kuaishou.web.cp.api"
        "&callback=https%3A%2F%2Fcp.kuaishou.com%2Frest%2Finfra%2Fsts"
        "%3FfollowUrl%3Dhttps%253A%252F%252Fcp.kuaishou.com"
        "%252Farticle%252Fpublish%252Fvideo%26setRootDomain%3Dtrue"
    )
    LOGGED_IN_URL_PREFIX = "https://cp.kuaishou.com/"

    DISPLAY_SELECTORS = (
        "div.names div.container div.name",
        "div.user-info div.name",
        "div.user-name",
        "span.user-name",
        "[class*='user-name']",
        "[class*='nickname']",
        "[class*='userName']",
    )
    ACCOUNT_ID_SELECTORS = (
        "[class*='kwai-id']",
        "[class*='kuaishou-id']",
        "span.kwai-id",
    )
    AVATAR_SELECTORS = (
        "img.avatar",
        "div.user-info img",
        "div.avatar img",
        "[class*='avatar'] img",
        "img[class*='avatar']",
    )

    @classmethod
    async def extract_qr_data_url(cls, page: Any) -> str:
        # Mirror upstream `_extract_ks_qrcode_src`. main#login-form is on the
        # top-level DOM at passport.kuaishou.com — no iframe traversal needed.
        login_form = page.locator("main#login-form").first
        await login_form.wait_for(state="visible", timeout=30000)
        qr_img = login_form.locator('div.qr-login img[alt="qrcode"]').first

        # Default tab may be 账号登录; if the QR isn't visible click the
        # platform-switch button to flip into QR mode.
        try:
            qr_present = await qr_img.count() and await qr_img.is_visible()
        except Exception:  # noqa: BLE001
            qr_present = False
        if not qr_present:
            switcher = login_form.locator("div.platform-switch").first
            try:
                await switcher.wait_for(state="visible", timeout=10000)
                await switcher.click(timeout=3000)
                await page.wait_for_timeout(1000)
            except Exception:  # noqa: BLE001
                # Switcher missing or click failed; the QR wait below will
                # surface a clearer error if we still don't see one.
                pass

        await qr_img.wait_for(state="visible", timeout=15000)
        src = await qr_img.get_attribute("src")
        if not src or not src.startswith("data:image/"):
            raise RuntimeError("kuaishou: QR src missing or not a data: URL")
        return src

    @classmethod
    async def is_logged_in(cls, page: Any) -> bool:
        # Still on passport.kuaishou.com → not yet logged in.
        if page.url.startswith("https://passport.kuaishou.com"):
            return False
        # The callback chain lands us on cp.kuaishou.com — if we're not
        # there, we're either still mid-redirect or got bounced.
        if not page.url.startswith(cls.LOGGED_IN_URL_PREFIX):
            return False
        # Extra safety: if main#login-form is somehow still visible (e.g. an
        # error mid-callback re-rendered the form), we're not logged in.
        try:
            form = page.locator("main#login-form").first
            if await form.count() and await form.is_visible():
                return False
        except Exception:  # noqa: BLE001
            pass
        return True

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        try:
            display = await _first_text(page, cls.DISPLAY_SELECTORS)
            avatar = await _first_attr(page, cls.AVATAR_SELECTORS, "src")
            account_id = await _first_text(page, cls.ACCOUNT_ID_SELECTORS)
            body = await _body_text(page)
            if not account_id:
                account_id = _extract_labeled_account_id(
                    body,
                    ("快手号", "快手 ID", "Kwai ID", "Kuaishou ID"),
                )
            if _is_placeholder_profile_text(display):
                display = None
            if not display:
                display = _extract_text_before_label(body, "快手号")
            if _is_placeholder_profile_text(display):
                display = None
            return {
                "displayName": display,
                "platformAccountId": account_id,
                "avatarUrl": avatar,
            }
        except Exception:  # noqa: BLE001
            return _empty_profile()


class XiaohongshuDriver(PlatformDriver):
    """小红书 creator.xiaohongshu.com creator center.

    Login flow: `/login` shows `div[class*='login-box']` with the QR inside.
    On scan the page navigates away from `/login` (typically into
    `/publish/publish` or the home dashboard). Profile fields are not exposed
    consistently in the upstream we mirror — best-effort selectors only.
    """

    LOGIN_URL = "https://creator.xiaohongshu.com/login"
    LOGGED_IN_URL_PREFIX = "https://creator.xiaohongshu.com/"

    DISPLAY_SELECTORS = (
        "div.user-info div.nickname",
        "[class*='nickname']",
        "[class*='user-name']",
        "span.user-name",
        "div.name",
    )
    ACCOUNT_ID_SELECTORS = (
        "[class*='red-id']",
        "[class*='xhs-id']",
        "[class*='redId']",
    )
    AVATAR_SELECTORS = (
        "img.avatar",
        "div.user-info img",
        "[class*='avatar'] img",
        "img[class*='avatar']",
    )

    @classmethod
    async def extract_qr_data_url(cls, page: Any) -> str:
        # The /login page can default to either "密码登录" or "扫码登录" tab.
        # If we're on password tab, the QR img isn't on screen — click the
        # `img.css-wemwzq` switcher to flip to QR (mirrors upstream's
        # `_open_xhs_qrcode_panel`).
        await cls._ensure_qr_panel(page)

        # Primary: upstream's chain — locate `.login-box-container` whose
        # text starts with "APP扫一扫登录", then take the QR img from the
        # following sibling div.
        try:
            scan_section = page.locator(".login-box-container").filter(
                has_text="APP扫一扫登录"
            ).first
            await scan_section.wait_for(state="visible", timeout=20000)
            qr_img = scan_section.locator("xpath=following-sibling::div//img").first
            await qr_img.wait_for(state="visible", timeout=20000)
            src = await qr_img.get_attribute("src")
            if src and src.startswith("data:image/"):
                return src
        except Exception:  # noqa: BLE001
            pass

        # Fallback selectors covering legacy page builds + tab-already-on-QR
        # flights where the upstream xpath misses.
        for selector in (
            ".login-box-container img[src^='data:image/']",
            ".login-box-container img",
            'div[class*="login-box"] img[src^="data:image/"]',
            'div[class*="qrcode"] img',
            'canvas[class*="qrcode"]',
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
        raise RuntimeError(
            "xiaohongshu: QR src not found — tab switch may have failed or "
            "the login-box DOM drifted from upstream selectors"
        )

    @classmethod
    async def _ensure_qr_panel(cls, page: Any) -> None:
        """Switch from 密码登录 tab to 扫码登录 tab if needed.

        Upstream `_open_xhs_qrcode_panel` clicks `img.css-wemwzq` to flip
        tabs and then waits for "APP扫一扫登录" / "扫一扫" text. We mirror
        that, but no-op when the QR is already on screen so we don't flip
        away from it on flights where 扫码登录 is the default tab.

        Best-effort: failures only log; extract_qr_data_url will try to
        find the QR anyway and surface its own error if it can't.
        """
        # If QR is already showing, do nothing.
        try:
            existing_qr = page.locator(
                ".login-box-container img[src^='data:image/']"
            ).first
            if await existing_qr.count() and await existing_qr.is_visible():
                return
        except Exception:  # noqa: BLE001
            pass
        try:
            scan_text = page.get_by_text("APP扫一扫登录").first
            if await scan_text.count() and await scan_text.is_visible():
                return
        except Exception:  # noqa: BLE001
            pass

        # QR tab not active — try clicking the switcher icon.
        switch_selectors = (
            "img.css-wemwzq",
            'div[class*="login-box"] img[class*="css-"]',
            'div[class*="login-box"] [class*="switch"]',
        )
        for selector in switch_selectors:
            try:
                switcher = page.locator(selector).first
                if not await switcher.count() or not await switcher.is_visible():
                    continue
                await switcher.click(timeout=3000)
                # Wait for QR label to appear; if it doesn't, fall back to
                # the next switcher candidate.
                try:
                    await page.get_by_text("APP扫一扫登录").first.wait_for(
                        state="visible", timeout=8000
                    )
                    return
                except Exception:  # noqa: BLE001
                    # Maybe the click didn't switch — try next selector.
                    continue
            except Exception:  # noqa: BLE001
                continue
        log.warning(
            "xiaohongshu: could not confirm QR tab is active after trying "
            "switch selectors; QR extraction will attempt fallbacks"
        )

    @classmethod
    async def is_logged_in(cls, page: Any) -> bool:
        if not page.url.startswith(cls.LOGGED_IN_URL_PREFIX):
            return False
        # Still on /login means QR hasn't been scanned yet.
        if page.url.rstrip("/").endswith("/login"):
            return False
        # If login-box is still on screen we're not logged in either.
        try:
            box = page.locator("div[class*='login-box']").first
            if await box.count() and await box.is_visible():
                return False
        except Exception:  # noqa: BLE001
            pass
        return True

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        try:
            display = await _first_text(page, cls.DISPLAY_SELECTORS)
            avatar = await _first_attr(page, cls.AVATAR_SELECTORS, "src")
            account_id = await _first_text(page, cls.ACCOUNT_ID_SELECTORS)
            body = await _body_text(page)
            if not account_id:
                account_id = _extract_labeled_account_id(
                    body,
                    ("小红书号", "小红书 ID", "Red ID", "XHS ID"),
                )
            if _is_placeholder_profile_text(display):
                display = None
            if not display:
                display = _extract_text_before_label(body, "小红书号")
            if _is_placeholder_profile_text(display):
                display = None
            return {
                "displayName": display,
                "platformAccountId": account_id,
                "avatarUrl": avatar,
            }
        except Exception:  # noqa: BLE001
            return _empty_profile()


DRIVERS: dict[str, type[PlatformDriver]] = {
    "douyin": DouyinDriver,
    "shipinhao": ShipinhaoDriver,
    "kuaishou": KuaishouDriver,
    "xiaohongshu": XiaohongshuDriver,
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
                    "platformAccountId": f"mock-{platform}-{account_name}",
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
