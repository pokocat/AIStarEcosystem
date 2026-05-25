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
import os
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .browser_runtime import chromium_launch_kwargs
from .interaction import SmsInteractionDriver, get_sms_driver, now_unix
from .qr import build_mock_qr

log = logging.getLogger(__name__)


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


def string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


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


async def _poll_extract_profile(
    page: Any,
    reader: Callable[[Any], Awaitable[dict[str, Any]]],
    *,
    timeout_s: float = 10.0,
    interval_ms: int = 500,
    label_hints: tuple[str, ...] = (),
    diagnostic_tag: str = "",
) -> dict[str, Any]:
    """Poll `reader(page)` until BOTH identifying fields land or `timeout_s`
    elapses. Mirrors DouyinDriver's pattern so every platform waits for SPA
    paint instead of single-shot reading an empty header.

    v0.17.2: 完整 success = displayName AND platformAccountId 都非空。
    历史行为是任一非空即 return，导致「displayName 命中但 platformAccountId
    selector 写错」的场景永远不触发诊断 dump（只 dump 全空）。改成 AND 后，
    selector 部分错的平台也会吃满 deadline → dump 真 DOM；selector 全对的
    平台还是 fast-bail（两项一起出现）。

    若到 deadline 时仍有缺字段且 `label_hints` 非空，按 label 在 DOM 里反向
    搜节点 + 头部 chrome outerHTML 一并 dump，方便回填 selector。

    Never raises — falls back to _empty_profile on any exception."""
    try:
        deadline = time.monotonic() + timeout_s
        profile = _empty_profile()
        while True:
            profile = await reader(page)
            has_display = bool(profile.get("displayName"))
            has_account_id = bool(profile.get("platformAccountId"))
            if has_display and has_account_id:
                return profile
            if time.monotonic() >= deadline:
                missing = []
                if not has_display:
                    missing.append("displayName")
                if not has_account_id:
                    missing.append("platformAccountId")
                if label_hints and missing:
                    await _dump_profile_dom_hints(
                        page, label_hints, diagnostic_tag, missing_fields=tuple(missing),
                    )
                return profile
            await page.wait_for_timeout(interval_ms)
    except Exception:  # noqa: BLE001
        return _empty_profile()


async def _dump_profile_dom_hints(
    page: Any,
    label_hints: tuple[str, ...],
    diagnostic_tag: str,
    *,
    missing_fields: tuple[str, ...] = (),
) -> None:
    """Log WARNING with DOM nodes whose text contains any `label_hints` token,
    plus the head/avatar chrome's outerHTML.

    Triggered when `_poll_extract_profile` exhausts its retry budget with one
    or both identifying fields still empty. The dump is what an operator
    pastes back to refine the driver's `*_SELECTORS` / body-text label list —
    avoids needing to repeat the manual QR bind just to inspect the page.

    Best-effort. Never raises. Capped node count + outerHTML length to
    keep logs human-readable."""
    try:
        url = getattr(page, "url", None)
        body = await _body_text(page)
        body_snippet = (body or "")[:800]

        # Pass 1: 含 label_hints 文本的节点（最佳 selector 候选；带 label = 平台
        # 在 DOM 里明示了这是 "小红书号 / 快手号 / 视频号 ID"）
        candidates_js = """
        (labels) => {
          const out = [];
          const walker = document.createTreeWalker(
            document.body, NodeFilter.SHOW_TEXT, null
          );
          let node;
          while ((node = walker.nextNode())) {
            const t = (node.textContent || '').trim();
            if (!t) continue;
            if (!labels.some(l => t.includes(l))) continue;
            const el = node.parentElement;
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            out.push({
              tag: el.tagName,
              cls: typeof el.className === 'string' ? el.className : '',
              text: t.slice(0, 160),
              parentTag: el.parentElement ? el.parentElement.tagName : null,
              parentCls: el.parentElement && typeof el.parentElement.className === 'string'
                ? el.parentElement.className : '',
              outerHTML: (el.outerHTML || '').slice(0, 800),
            });
            if (out.length >= 6) break;
          }
          return out;
        }
        """
        try:
            hits = await page.evaluate(candidates_js, list(label_hints))
        except Exception:  # noqa: BLE001
            hits = []

        # Pass 2: 头部 / 用户菜单 chrome —— XHS / 视频号 / 快手 上 platform_account_id
        # 经常藏在 header 或下拉菜单里，label 在 DOM 里又不在 body innerText 顶层
        # 触手可及（被 transform / visibility 遮挡）。把头部 chrome 拍一份照让运维
        # 一眼看到 nickname / id 的容器 class。
        header_js = """
        () => {
          const heads = [];
          const sels = [
            'header', '[class*="Header"]', '[class*="header"]',
            '[class*="userInfo"]', '[class*="user-info"]',
            '[class*="avatar"]', '[class*="Avatar"]',
            '[class*="account-info"]', '[class*="UserPanel"]',
          ];
          const seen = new Set();
          for (const s of sels) {
            const nodes = document.querySelectorAll(s);
            for (const el of nodes) {
              if (seen.has(el)) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              // 顶部 200px 内 + 不是巨大容器（避免 dump 整个 layout）
              if (r.top > 200 || r.width > 800 || r.height > 400) continue;
              seen.add(el);
              heads.push({
                sel: s,
                tag: el.tagName,
                cls: typeof el.className === 'string' ? el.className : '',
                rect: {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)},
                text: (el.innerText || '').slice(0, 200),
                outerHTML: (el.outerHTML || '').slice(0, 1200),
              });
              if (heads.length >= 6) break;
            }
            if (heads.length >= 6) break;
          }
          return heads;
        }
        """
        try:
            heads = await page.evaluate(header_js)
        except Exception:  # noqa: BLE001
            heads = []

        missing_summary = ",".join(missing_fields) if missing_fields else "<all>"
        log.warning(
            "[%s] extract_profile incomplete after retry budget; missing=%s url=%s "
            "body[:800]=%r label_hits=%d header_hits=%d",
            diagnostic_tag or "profile",
            missing_summary,
            url,
            body_snippet,
            len(hits) if isinstance(hits, list) else 0,
            len(heads) if isinstance(heads, list) else 0,
        )
        if isinstance(hits, list):
            for i, h in enumerate(hits):
                log.warning(
                    "  [%s][label#%d] tag=%s cls=%r text=%r parentTag=%s parentCls=%r outerHTML=%r",
                    diagnostic_tag or "profile",
                    i,
                    h.get("tag"),
                    (h.get("cls") or "")[:160],
                    h.get("text"),
                    h.get("parentTag"),
                    (h.get("parentCls") or "")[:160],
                    h.get("outerHTML"),
                )
        if isinstance(heads, list):
            for i, h in enumerate(heads):
                log.warning(
                    "  [%s][head#%d] sel=%s tag=%s cls=%r rect=%s text=%r outerHTML=%r",
                    diagnostic_tag or "profile",
                    i,
                    h.get("sel"),
                    h.get("tag"),
                    (h.get("cls") or "")[:160],
                    h.get("rect"),
                    h.get("text"),
                    h.get("outerHTML"),
                )
    except Exception:  # noqa: BLE001
        log.exception("[%s] _dump_profile_dom_hints crashed", diagnostic_tag or "profile")


# ─── QR-extraction failure diagnostic ────────────────────────────────────


def _snapshot_dir() -> Path:
    """Where QR-failure snapshots get written. Configurable via env so
    operator can point it at a mounted volume in docker."""
    return Path(os.environ.get("SAU_DEBUG_SNAPSHOT_DIR", "./sau-debug-snapshots"))


async def _dump_qr_extraction_failure(
    page: Any,
    platform: str,
    error_msg: str,
) -> dict[str, Any]:
    """Snapshot + DOM dump when a driver's `extract_qr_data_url` raises.

    XHS / 视频号 / 快手 这些站时不时改 /login 页 DOM —— class hash 漂、tab
    布局换、整页改成 modal 之类的。出错时一张 screenshot + 一份 HTML 比
    任何 selector 猜测都管用。

    输出：
      - ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.png     页面截图
      - ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.html    HTML outerHTML
      - WARNING log 含上述路径 + URL + body[:500] + 所有 data:image/<img> 的 size/class

    Best-effort：本身不抛；返回 {screenshot_path, html_path, url} 让 caller
    把路径塞到 raise 的 message 里。"""
    result: dict[str, Any] = {
        "diagnostic_id": None,
        "screenshot_path": None,
        "html_path": None,
        "url": None,
    }
    try:
        url = getattr(page, "url", None)
        result["url"] = url

        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        result["diagnostic_id"] = f"{platform}-{ts}"
        base_dir = _snapshot_dir()
        try:
            base_dir.mkdir(parents=True, exist_ok=True)
        except Exception:  # noqa: BLE001
            log.exception("[%s] snapshot dir create failed: %s", platform, base_dir)
            return result

        png_path = base_dir / f"{platform}-{ts}.png"
        html_path = base_dir / f"{platform}-{ts}.html"

        # 1. Screenshot
        try:
            await page.screenshot(path=str(png_path), full_page=True)
            result["screenshot_path"] = str(png_path)
        except Exception:  # noqa: BLE001
            log.exception("[%s] screenshot failed", platform)

        # 2. HTML
        try:
            html = await page.content()
            html_path.write_text(html or "", encoding="utf-8", errors="replace")
            result["html_path"] = str(html_path)
        except Exception:  # noqa: BLE001
            log.exception("[%s] page.content() failed", platform)

        # 3. DOM inventory of data: image elements (typical QR carriers)
        # —— sizes + class. Helps spot which `<img src="data:image/...">` is
        # the actual QR even if the upstream selector misses.
        img_inventory_js = """
        () => {
          const out = [];
          for (const img of document.querySelectorAll('img')) {
            const src = img.getAttribute('src') || '';
            if (!src.startsWith('data:image/')) continue;
            const r = img.getBoundingClientRect();
            out.push({
              w: Math.round(r.width),
              h: Math.round(r.height),
              top: Math.round(r.top),
              left: Math.round(r.left),
              cls: typeof img.className === 'string' ? img.className : '',
              alt: img.getAttribute('alt') || '',
              ariaLabel: img.getAttribute('aria-label') || '',
              parentTag: img.parentElement ? img.parentElement.tagName : null,
              parentCls: img.parentElement && typeof img.parentElement.className === 'string'
                ? img.parentElement.className : '',
            });
            if (out.length >= 20) break;
          }
          return out;
        }
        """
        try:
            imgs = await page.evaluate(img_inventory_js)
        except Exception:  # noqa: BLE001
            imgs = []

        body = await _body_text(page)
        body_snippet = (body or "")[:500]

        log.warning(
            "[%s] extract_qr_data_url FAILED url=%s error=%r\n"
            "  screenshot=%s\n  html=%s\n  body[:500]=%r\n"
            "  data:image candidates=%d",
            platform,
            url,
            error_msg,
            result["screenshot_path"] or "<not-saved>",
            result["html_path"] or "<not-saved>",
            body_snippet,
            len(imgs) if isinstance(imgs, list) else 0,
        )
        if isinstance(imgs, list):
            for i, img in enumerate(imgs):
                log.warning(
                    "  [%s][img#%d] size=%sx%s pos=(%s,%s) cls=%r alt=%r parentTag=%s parentCls=%r",
                    platform,
                    i,
                    img.get("w"),
                    img.get("h"),
                    img.get("left"),
                    img.get("top"),
                    (img.get("cls") or "")[:120],
                    img.get("alt"),
                    img.get("parentTag"),
                    (img.get("parentCls") or "")[:120],
                )
    except Exception:  # noqa: BLE001
        log.exception("[%s] _dump_qr_extraction_failure crashed", platform)
    return result


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
    async def prepare_profile_view(cls, page: Any) -> None:
        """Optional hook: navigate / interact with the page so the profile
        fields become visible before extract_profile runs. Default = noop.

        Drivers can override to e.g. navigate to the creator homepage or open a
        menu where nickname + platform_account_id are guaranteed to render.

        Best-effort: must NEVER raise; failure falls through to whatever
        the post-login landing page exposes. Storage_state is captured
        AFTER this runs so any cookies refreshed during navigation are
        baked into the persisted blob."""
        return None

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        """Best-effort profile pull post-login. Never raises — falls back to
        nullable fields when probing fails."""
        return _empty_profile()


class _AlreadyLoggedInForBind(Exception):
    """Internal signal: login/start reached an authenticated creator page."""

    def __init__(self, platform: str) -> None:
        super().__init__(platform)
        self.platform = platform


async def _is_logged_in_safely(
    driver_cls: type[PlatformDriver],
    page: Any,
    *,
    ticket: str | None = None,
) -> bool:
    try:
        return bool(await driver_cls.is_logged_in(page))
    except Exception:  # noqa: BLE001
        log.exception(
            "login_pool: is_logged_in precheck failed ticket=%s platform=%s",
            ticket,
            driver_cls.__name__,
        )
        return False


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
        return await _poll_extract_profile(
            page,
            cls._read_profile_fields,
            timeout_s=cls.PROFILE_READY_TIMEOUT_S,
            interval_ms=cls.PROFILE_POLL_INTERVAL_MS,
            label_hints=("抖音号", "Douyin ID"),
            diagnostic_tag="douyin",
        )

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
    PROFILE_READY_TIMEOUT_S = 10.0
    PROFILE_POLL_INTERVAL_MS = 500
    PROFILE_VIEW_URL_CANDIDATES = (
        MANAGE_URL,
        "https://channels.weixin.qq.com/platform",
    )
    PROFILE_VIEW_NAVIGATE_TIMEOUT_MS = 10_000
    PROFILE_VIEW_READY_TIMEOUT_S = 12.0
    PROFILE_VIEW_READY_POLL_MS = 500

    # 视频号助手 (channels.weixin.qq.com/platform) 创作者中心左上角：
    #   头像 + 视频号昵称 + 一行 "视频号 ID: <id>" / "原始 ID: <id>"。
    # 当前 build 用 emotion / module-css 哈希 class（finder-nickname-* 之类），
    # 历史上也见过裸 `.finder-nickname`。多套模糊兜底 + body 文本兜底。
    DISPLAY_SELECTORS = (
        "[class*='finder-nickname']",
        "[class*='FinderNickname']",
        "[class*='channel-nickname']",
        "[class*='nickname-text']",
        "[class*='nickname']",
        "[class*='userName']",
        "[class*='user-name']",
        "div.account-name",
        "div.user-name",
        "div.name",
    )
    ACCOUNT_ID_SELECTORS = (
        "[class*='finder-uniq-id']",
        "[class*='finder-id']",
        "[class*='finderId']",
        "[class*='channel-id']",
        "[class*='channelId']",
        "[class*='uniq-id']",
        "[class*='uniqId']",
        "[class*='account-info-uin']",
    )
    AVATAR_SELECTORS = (
        "img.finder-avatar",
        "img[class*='finder-avatar']",
        "img[class*='avatar']",
        "div.avatar img",
        "[class*='avatar'] img",
    )
    ACCOUNT_ID_LABELS = (
        "视频号 ID",
        "视频号ID",
        "视频号账号",
        "视频号",
        "原始 ID",
        "原始ID",
        "Channels ID",
        "Channel ID",
    )

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
    async def prepare_profile_view(cls, page: Any) -> None:
        """Hold the browser on a page where 视频号助手 renders account chrome.

        The post-create page is a reliable QR entry, but after login its first
        paint can show only the editor shell. The account identity usually
        appears in the persistent sidebar/header or avatar popover. We first
        wait on the current page, then try the post list and platform home.
        """
        if await cls._wait_profile_surface_ready(page):
            log.info(
                "[shipinhao] prepare_profile_view ok on current page url=%s",
                getattr(page, "url", None),
            )
            return
        if await cls._open_profile_popover(page) and await cls._wait_profile_surface_ready(page):
            log.info(
                "[shipinhao] prepare_profile_view ok after opening profile popover url=%s",
                getattr(page, "url", None),
            )
            return

        for url in cls.PROFILE_VIEW_URL_CANDIDATES:
            try:
                await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=cls.PROFILE_VIEW_NAVIGATE_TIMEOUT_MS,
                )
                if not await cls.is_logged_in(page):
                    log.warning(
                        "[shipinhao] prepare_profile_view: %s did not stay logged in; landed=%s",
                        url,
                        getattr(page, "url", None),
                    )
                    continue
                if await cls._wait_profile_surface_ready(page):
                    log.info("[shipinhao] prepare_profile_view ok via %s", url)
                    return
                if await cls._open_profile_popover(page) and await cls._wait_profile_surface_ready(page):
                    log.info("[shipinhao] prepare_profile_view ok via %s after profile popover", url)
                    return
                log.info(
                    "[shipinhao] prepare_profile_view: %s loaded but profile surface not ready; trying next",
                    url,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "[shipinhao] prepare_profile_view navigate failed url=%s err=%s",
                    url,
                    exc,
                )
        log.warning(
            "[shipinhao] prepare_profile_view: all candidates failed; "
            "extract_profile will run against current page"
        )

    @classmethod
    async def _wait_profile_surface_ready(cls, page: Any) -> bool:
        deadline = time.monotonic() + cls.PROFILE_VIEW_READY_TIMEOUT_S
        while time.monotonic() < deadline:
            try:
                fields = await cls._read_profile_surface_fields(page)
                if fields.get("displayName") and fields.get("platformAccountId"):
                    return True
                body = await _body_text(page)
                if _extract_labeled_account_id(body, cls.ACCOUNT_ID_LABELS):
                    return True
            except Exception:  # noqa: BLE001
                pass
            await page.wait_for_timeout(cls.PROFILE_VIEW_READY_POLL_MS)
        return False

    @classmethod
    async def _open_profile_popover(cls, page: Any) -> bool:
        """Best-effort click on the account/avatar chrome.

        Some 视频号 builds keep the platform id in the user popover instead of
        the always-visible sidebar. Restrict candidates to top/left account-like
        elements so this does not touch publish-form controls.
        """
        candidates_js = """
        () => {
          const selectors = [
            '[class*="finder"]',
            '[class*="account"]',
            '[class*="Account"]',
            '[class*="user"]',
            '[class*="User"]',
            '[class*="avatar"]',
            '[class*="Avatar"]',
            'img'
          ];
          const seen = new Set();
          const out = [];
          for (const selector of selectors) {
            for (const el of document.querySelectorAll(selector)) {
              if (seen.has(el)) continue;
              seen.add(el);
              if (!(el instanceof HTMLElement)) continue;
              const rect = el.getBoundingClientRect();
              if (!rect.width || !rect.height) continue;
              if (rect.width > 320 || rect.height > 160) continue;
              const inLikelyChrome = rect.top <= 220 || rect.left <= 320;
              if (!inLikelyChrome) continue;
              const style = window.getComputedStyle(el);
              const text = (el.innerText || el.textContent || '').trim();
              const clickable =
                style.cursor === 'pointer' ||
                el.tagName === 'IMG' ||
                el.getAttribute('role') === 'button' ||
                typeof el.onclick === 'function';
              const accountLike = /视频号|原始 ID|ID|账号|nickname|avatar|user|account|finder/i
                .test(`${selector} ${el.className || ''} ${text}`);
              if (!clickable && !accountLike) continue;
              out.push({
                cx: rect.left + rect.width / 2,
                cy: rect.top + rect.height / 2,
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
                tag: el.tagName,
                cls: typeof el.className === 'string' ? el.className : '',
                text: text.slice(0, 120),
              });
            }
          }
          out.sort((a, b) => a.y - b.y || a.x - b.x);
          return out.slice(0, 8);
        }
        """
        try:
            candidates = await page.evaluate(candidates_js)
        except Exception:  # noqa: BLE001
            return False
        if not isinstance(candidates, list):
            return False
        for candidate in candidates:
            try:
                await page.mouse.click(candidate["cx"], candidate["cy"])
                await page.wait_for_timeout(800)
                fields = await cls._read_profile_surface_fields(page)
                if fields.get("displayName") or fields.get("platformAccountId"):
                    return True
            except Exception:  # noqa: BLE001
                continue
        return False

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        return await _poll_extract_profile(
            page,
            cls._read_profile_fields,
            timeout_s=cls.PROFILE_READY_TIMEOUT_S,
            interval_ms=cls.PROFILE_POLL_INTERVAL_MS,
            label_hints=cls.ACCOUNT_ID_LABELS,
            diagnostic_tag="shipinhao",
        )

    @classmethod
    async def _read_profile_fields(cls, page: Any) -> dict[str, Any]:
        surface_fields = await cls._read_profile_surface_fields(page)
        display = cls._clean_display_name(
            surface_fields.get("displayName") or await _first_text(page, cls.DISPLAY_SELECTORS)
        )
        avatar = surface_fields.get("avatarUrl") or await _first_attr(page, cls.AVATAR_SELECTORS, "src")
        account_id = surface_fields.get("platformAccountId") or await _first_text(page, cls.ACCOUNT_ID_SELECTORS)
        body = await _body_text(page)
        # 视频号有时把 "视频号 ID：<id>" 整段塞进同一个 div —— 反向再抽一次。
        if account_id and ("视频号" in account_id or "ID" in account_id.upper()):
            extracted = _extract_labeled_account_id(
                account_id, cls.ACCOUNT_ID_LABELS,
            )
            if extracted:
                account_id = extracted
        if not account_id:
            account_id = _extract_labeled_account_id(body, cls.ACCOUNT_ID_LABELS)
        if _is_placeholder_profile_text(display):
            display = None
        if not display:
            display = cls._clean_display_name(
                _extract_text_before_label(body, "视频号 ID")
                or _extract_text_before_label(body, "原始 ID")
                or _extract_text_before_label(body, "视频号")
            )
        if _is_placeholder_profile_text(display):
            display = None
        return {
            "displayName": display,
            "platformAccountId": account_id,
            "avatarUrl": avatar,
        }

    @staticmethod
    def _clean_display_name(value: str | None) -> str | None:
        text = _clean_text(value)
        if not text:
            return None
        # 视频号账号卡可能把昵称、认证入口按钮合在同一个 DOM 容器里：
        #   "阿哐6299 申请认证"
        # 这些是平台操作文案，不属于账号昵称。
        text = re.sub(r"\s+(申请认证|去认证|立即认证|认证)$", "", text).strip()
        return text or None

    @classmethod
    async def _read_profile_surface_fields(cls, page: Any) -> dict[str, Any]:
        """Read 视频号 identity from sidebar/header/profile popover DOM.

        The flattened body text usually contains many generic "视频号助手"
        labels before the actual account row. Anchoring on a node that contains
        "视频号 ID" / "原始 ID" keeps displayName extraction scoped to the
        surrounding profile row/card.
        """
        try:
            result = await page.evaluate(
                """
                (labels) => {
                  const empty = { displayName: null, platformAccountId: null, avatarUrl: null };
                  const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim() || null;
                  const visible = (el) => {
                    if (!el || !(el instanceof Element)) return false;
                    const rect = el.getBoundingClientRect();
                    if (!rect.width || !rect.height) return false;
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                  };
                  const escapeRe = (text) => text.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                  const anchorLabels = labels.filter((label) => label !== '视频号');
                  const rejectDisplay = (text) => {
                    if (!text) return true;
                    if (text.length > 64) return true;
                    if (/^\\d+$/.test(text)) return true;
                    if (/[：:]/.test(text) && /视频号|原始|ID|账号/.test(text)) return true;
                    return /视频号助手|微信扫码|扫码登录|发表视频|发表|发布|作品管理|数据中心|通知|设置|退出|登录|账号状态/.test(text);
                  };
                  const idFrom = (text) => {
                    const src = clean(text) || '';
                    for (const label of labels) {
                      const m = src.match(new RegExp(escapeRe(label) + '\\\\s*[:：]?\\\\s*([A-Za-z0-9_.-]{2,80})'));
                      if (m) return m[1];
                    }
                    return null;
                  };
                  const displayBeforeLabel = (text) => {
                    const src = clean(text) || '';
                    let bestIndex = -1;
                    for (const label of anchorLabels) {
                      const idx = src.indexOf(label);
                      if (idx >= 0 && (bestIndex < 0 || idx < bestIndex)) bestIndex = idx;
                    }
                    if (bestIndex <= 0) return null;
                    const before = src.slice(0, bestIndex).split(/[|｜\\n]/).pop();
                    const cleaned = clean(before);
                    return rejectDisplay(cleaned) ? null : cleaned;
                  };
                  const scoreCard = (card, labelEl) => {
                    const text = clean(card.innerText || card.textContent || '') || '';
                    const rect = card.getBoundingClientRect();
                    if (!idFrom(text) && !anchorLabels.some((label) => text.includes(label))) return null;
                    if (rect.width < 120 || rect.height < 24 || rect.width > 980 || rect.height > 520) return null;
                    const hasImg = !!card.querySelector('img');
                    let score = 0;
                    if (idFrom(text)) score += 10;
                    if (hasImg) score += 3;
                    if (rect.top <= 220 || rect.left <= 360) score += 3;
                    if (text.includes('原始 ID') || text.includes('视频号 ID')) score += 2;
                    if (labelEl) {
                      const lr = labelEl.getBoundingClientRect();
                      score -= Math.abs(rect.top - lr.top) / 200;
                    }
                    return { card, score };
                  };

                  const labelElements = [];
                  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                  let node;
                  while ((node = walker.nextNode())) {
                    const text = clean(node.textContent);
                    if (!text || (!idFrom(text) && !anchorLabels.some((label) => text.includes(label)))) continue;
                    if (!node.parentElement || !visible(node.parentElement)) continue;
                    labelElements.push(node.parentElement);
                    if (labelElements.length >= 12) break;
                  }

                  const scored = [];
                  for (const labelEl of labelElements) {
                    let card = labelEl;
                    for (let depth = 0; depth < 9 && card; depth += 1) {
                      const item = scoreCard(card, labelEl);
                      if (item) scored.push(item);
                      card = card.parentElement;
                    }
                  }
                  if (!scored.length) {
                    const fallbackSelectors = [
                      '[class*="finder"]',
                      '[class*="account"]',
                      '[class*="Account"]',
                      '[class*="profile"]',
                      '[class*="Profile"]',
                      '[class*="user"]',
                      '[class*="User"]',
                    ];
                    const seen = new Set();
                    for (const selector of fallbackSelectors) {
                      for (const el of document.querySelectorAll(selector)) {
                        if (seen.has(el) || !visible(el)) continue;
                        seen.add(el);
                        const item = scoreCard(el, null);
                        if (item) scored.push(item);
                      }
                    }
                  }
                  scored.sort((a, b) => b.score - a.score);
                  const best = scored.length ? scored[0].card : null;
                  if (!best) return empty;

                  const cardText = clean(best.innerText || best.textContent || '') || '';
                  const platformAccountId = idFrom(cardText);
                  const displayFromText = displayBeforeLabel(cardText);
                  const labelTop = labelElements.length ? labelElements[0].getBoundingClientRect().top : null;
                  const candidates = [];
                  for (const el of best.querySelectorAll('span,div,p,strong,b,a')) {
                    if (!visible(el)) continue;
                    const text = clean(el.innerText || el.textContent || '');
                    if (rejectDisplay(text)) continue;
                    if (idFrom(text)) continue;
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const fontSize = parseFloat(style.fontSize || '0');
                    const fontWeight = parseInt(style.fontWeight || '400', 10) || 400;
                    let score = 0;
                    if (labelTop === null || rect.top <= labelTop + 10) score += 4;
                    if (fontSize >= 16) score += 3;
                    if (fontWeight >= 500) score += 2;
                    if (rect.left <= best.getBoundingClientRect().left + 220) score += 1;
                    candidates.push({ text, score, top: rect.top, left: rect.left });
                  }
                  candidates.sort((a, b) => b.score - a.score || a.top - b.top || a.left - b.left);

                  let avatarUrl = null;
                  for (const img of best.querySelectorAll('img')) {
                    if (!visible(img)) continue;
                    const rect = img.getBoundingClientRect();
                    if (rect.width < 24 || rect.height < 24) continue;
                    avatarUrl = img.getAttribute('src') || null;
                    if (avatarUrl) break;
                  }
                  if (!avatarUrl) {
                    for (const img of document.querySelectorAll('img[class*="avatar"], [class*="avatar"] img, img[class*="finder"]')) {
                      if (!visible(img)) continue;
                      const rect = img.getBoundingClientRect();
                      if (rect.width < 24 || rect.height < 24 || rect.width > 160 || rect.height > 160) continue;
                      avatarUrl = img.getAttribute('src') || null;
                      if (avatarUrl) break;
                    }
                  }

                  return {
                    displayName: displayFromText || (candidates.length ? candidates[0].text : null),
                    platformAccountId,
                    avatarUrl,
                  };
                }
                """,
                list(cls.ACCOUNT_ID_LABELS),
            )
            return result if isinstance(result, dict) else _empty_profile()
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
    PROFILE_READY_TIMEOUT_S = 10.0
    PROFILE_POLL_INTERVAL_MS = 500

    DISPLAY_SELECTORS = (
        "div.names div.container div.name",
        "div.user-info div.name",
        "div.user-name",
        "span.user-name",
        "[class*='user-name']",
        "[class*='nickname']",
        "[class*='userName']",
        "[class*='userInfo'] [class*='name']",
    )
    ACCOUNT_ID_SELECTORS = (
        "[class*='kwai-id']",
        "[class*='kuaishou-id']",
        "[class*='kwaiId']",
        "[class*='kuaishouId']",
        "span.kwai-id",
        "[class*='userInfo'] [class*='id']",
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
        return await _poll_extract_profile(
            page,
            cls._read_profile_fields,
            timeout_s=cls.PROFILE_READY_TIMEOUT_S,
            interval_ms=cls.PROFILE_POLL_INTERVAL_MS,
            label_hints=("快手号", "快手 ID", "快手ID", "Kwai ID", "Kuaishou ID"),
            diagnostic_tag="kuaishou",
        )

    @classmethod
    async def _read_profile_fields(cls, page: Any) -> dict[str, Any]:
        display = await _first_text(page, cls.DISPLAY_SELECTORS)
        avatar = await _first_attr(page, cls.AVATAR_SELECTORS, "src")
        account_id = await _first_text(page, cls.ACCOUNT_ID_SELECTORS)
        body = await _body_text(page)
        # 命中 "快手号：xxx" 整段时反向再抽一次。
        if account_id and ("快手号" in account_id or "ID" in account_id.upper()):
            extracted = _extract_labeled_account_id(
                account_id, ("快手号", "快手 ID", "快手ID", "Kwai ID", "Kuaishou ID"),
            )
            if extracted:
                account_id = extracted
        if not account_id:
            account_id = _extract_labeled_account_id(
                body,
                ("快手号", "快手 ID", "快手ID", "Kwai ID", "Kuaishou ID"),
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


class XiaohongshuDriver(PlatformDriver):
    """小红书 creator.xiaohongshu.com creator center.

    Login flow: `/login` shows `div[class*='login-box']` with the QR inside.
    On scan the page navigates to the creator homepage. Current creator home
    (`/new/home`) exposes the avatar, display name and "小红书账号：<id>" in
    the top profile card, so profile extraction should stay on that page.
    """

    LOGIN_URL = "https://creator.xiaohongshu.com/login"
    LOGGED_IN_URL_PREFIX = "https://creator.xiaohongshu.com/"
    PROFILE_READY_TIMEOUT_S = 10.0
    PROFILE_POLL_INTERVAL_MS = 500

    DISPLAY_SELECTORS = (
        "div.user-info div.nickname",
        "[class*='user-info'] [class*='nickname']",
        "[class*='userInfo'] [class*='nickname']",
        "[class*='nickname']",
        "[class*='Nickname']",
        "[class*='user-name']",
        "[class*='userName']",
        "span.user-name",
        "div.name",
    )
    ACCOUNT_ID_SELECTORS = (
        "[class*='red-id']",
        "[class*='redId']",
        "[class*='xhs-id']",
        "[class*='xhsId']",
        "[class*='red-book-id']",
        "[class*='redBookId']",
        "[class*='user-info'] [class*='id']",
    )
    AVATAR_SELECTORS = (
        "img.avatar",
        "div.user-info img",
        "[class*='avatar'] img",
        "img[class*='avatar']",
    )
    ACCOUNT_ID_LABELS = (
        "小红书账号",
        "小红书号",
        "小红书 ID",
        "小红书ID",
        "Red ID",
        "XHS ID",
    )

    @classmethod
    async def extract_qr_data_url(cls, page: Any) -> str:
        # The /login page can default to either "密码登录" / "短信登录" 或
        # "扫码登录"。如果当前 tab 不是扫码登录，QR img 不在 DOM 里 —— 必须
        # 先点 tab 切换器。_ensure_qr_panel 内部既 best-effort 又 retry，
        # 切换失败时下面的 QR 提取会抛错，sweep_expired 会清掉 playwright。
        await cls._ensure_qr_panel(page)

        # Primary: upstream's chain — locate `.login-box-container` whose
        # text starts with "APP扫一扫登录", then take the QR img from the
        # following sibling div.
        # 注意：_ensure_qr_panel 已经把 QR 面板拉起来了（_wait_qr_visible 通过），
        # 不需要再 20s 慢等；6s 足够覆盖 React 二次 paint。
        try:
            scan_section = page.locator(".login-box-container").filter(
                has_text="APP扫一扫登录"
            ).first
            await scan_section.wait_for(state="visible", timeout=6000)
            qr_img = scan_section.locator("xpath=following-sibling::div//img").first
            await qr_img.wait_for(state="visible", timeout=6000)
            src = await qr_img.get_attribute("src")
            if src and src.startswith("data:image/"):
                return src
        except Exception:  # noqa: BLE001
            pass

        # Fallback selectors covering legacy page builds + tab-already-on-QR
        # flights where the upstream xpath misses.
        # 关键：每个 candidate 都要过 _QR_MIN_DIMENSION_PX 尺寸闸 —— 否则会把右
        # 上角的 64×64 css-wemwzq switcher icon（其 src 也是 data:image/...）
        # 错误当成 QR 返回。
        for selector in (
            ".login-box-container img[src^='data:image/']",
            ".login-box-container img",
            'div[class*="login-box"] img[src^="data:image/"]',
            'div[class*="qrcode"] img',
            'canvas[class*="qrcode"]',
            'img[src^="data:image/"]',
        ):
            try:
                count = await page.locator(selector).count()
            except Exception:  # noqa: BLE001
                continue
            for i in range(min(count, 6)):
                qr = page.locator(selector).nth(i)
                try:
                    if not await qr.is_visible():
                        continue
                    bb = await qr.bounding_box()
                    if not bb:
                        continue
                    if (bb["width"] < cls._QR_MIN_DIMENSION_PX
                            or bb["height"] < cls._QR_MIN_DIMENSION_PX):
                        continue
                    src = await qr.get_attribute("src")
                    if src and src.startswith("data:image/"):
                        return src
                except Exception:  # noqa: BLE001
                    continue
        # 走到这就是 QR 没找到 —— 落盘截图 + HTML，让运维直接看现网 /login 页
        # 长啥样，比再加 selector 猜测靠谱。
        msg = (
            "xiaohongshu: QR src not found — tab switch may have failed or "
            "the login-box DOM drifted from upstream selectors"
        )
        if await _is_logged_in_safely(cls, page):
            raise _AlreadyLoggedInForBind("xiaohongshu")
        snapshot = await _dump_qr_extraction_failure(page, "xiaohongshu", msg)
        snapshot_hint = ""
        if snapshot.get("screenshot_path") or snapshot.get("html_path"):
            snapshot_hint = (
                f" (snapshot: png={snapshot.get('screenshot_path') or 'n/a'} "
                f"html={snapshot.get('html_path') or 'n/a'})"
            )
        raise RuntimeError(msg + snapshot_hint)

    # Click candidates for switching to the QR-login tab. 多套兜底：
    #   1. 文字 locator — 最稳，覆盖 XHS 把 tab 名做成 button / div / a 的情况
    #   2. role=tab — 极少数页面把 tab 标记为正经 ARIA tab
    #   3. 历史 hashed class img.css-wemwzq — 上游 social-auto-upload 还在用
    #   4. login-box 里任意 img / [class*="switch"] — 最 loose 的兜底
    _QR_TAB_TEXT_CANDIDATES: tuple[str, ...] = (
        "扫码登录",
        "二维码登录",
        "扫一扫登录",
    )
    _QR_TAB_FALLBACK_SELECTORS: tuple[str, ...] = (
        "img.css-wemwzq",
        'div[class*="login-box"] img[class*="css-"]',
        'div[class*="login-box"] [class*="switch"]',
        'div[class*="login-box"] [class*="qrcode-icon"]',
        'div[class*="login-container"] img[class*="qrcode"]',
    )

    # 真正的 QR 二维码尺寸 ≥ 这个值。小红书短信登录态下右上角的 QR-switcher
    # 图标本身也是 `<img src="data:image/...">`、64×64 css-wemwzq —— 如果只看
    # src 前缀，会把 switcher 错认成 QR 而直接 short-circuit，整张切换流程不跑。
    _QR_MIN_DIMENSION_PX = 120

    @classmethod
    async def _qr_panel_visible(cls, page: Any) -> bool:
        """True 当且仅当 QR 面板已经亮（不是 switcher 图标）。

        判定双条件，任一满足即可：
          a) login-box 里有个 `<img src="data:image/...">` 且宽高 ≥ _QR_MIN_DIMENSION_PX
             —— 真 QR 一般是 180-220px，明显大于 64×64 的 switcher icon。
          b) 页面上有 "APP扫一扫登录" 文字（XHS QR 面板的标题）。
        """
        try:
            big_qr_size_js = """
            (minSize) => {
              const card = document.querySelector(
                'div[class*="login-box"], .login-box-container'
              );
              if (!card) return false;
              const imgs = card.querySelectorAll('img[src^="data:image/"]');
              for (const img of imgs) {
                const r = img.getBoundingClientRect();
                if (r.width >= minSize && r.height >= minSize) return true;
              }
              return false;
            }
            """
            if await page.evaluate(big_qr_size_js, cls._QR_MIN_DIMENSION_PX):
                return True
        except Exception:  # noqa: BLE001
            pass
        try:
            scan_text = page.get_by_text("APP扫一扫登录").first
            if await scan_text.count() and await scan_text.is_visible():
                return True
        except Exception:  # noqa: BLE001
            pass
        return False

    @classmethod
    async def _ensure_qr_panel(cls, page: Any) -> None:
        """Switch to 扫码登录 tab if needed.

        Real 小红书 /login 当前布局（2026-05 抓到的）：
          - 默认进的可能是 "短信登录" 卡，没有 tab 文字「扫码登录」
          - 卡片右上角有一个小 QR 图标（彩色三角 + 点阵），点它整张卡片切到
            扫码模式。该图标是个 `<img>`，class 是 emotion 哈希 (如 `css-wemwzq`)。
            哈希会随构建变 —— 不能硬靠 class。

        Strategy 五级兜底，逐级降级：
          0. 如果 QR 面板已经可见 → no-op
          1. 文字 locator 点 "扫码登录"/"二维码登录"/"扫一扫登录"（极少数
             flight 真有这个 tab 文字）
          2. ARIA role=tab 同名
          3. 历史 emotion 哈希 class + 通用 class 模糊匹配
          4. **几何**：找登录卡片右上角 ~90×90px 区域里的任意 <img>/<svg>/
             [role=button] 当 switcher 候选，逐一点 + 验证 QR 是否亮
          5. 失败只 log；extract_qr_data_url 会拿不到 QR 并明确抛错

        每点完一个候选都 _wait_qr_visible 验证；只要 QR 面板亮就立刻返回。
        """
        # 提前给 SPA 一点时间挂 login-box（domcontentloaded 不代表 React 已 mount）。
        try:
            await page.locator('div[class*="login-box"], .login-box-container').first.wait_for(
                state="visible", timeout=15000
            )
        except Exception:  # noqa: BLE001
            pass

        if await cls._qr_panel_visible(page):
            return

        tried_summary: list[str] = []

        # 1. 文字 locator —— 找 tab 上的 "扫码登录" 字样并点。
        for text in cls._QR_TAB_TEXT_CANDIDATES:
            try:
                candidate = page.get_by_text(text).first
                if not await candidate.count() or not await candidate.is_visible():
                    continue
                await candidate.click(timeout=3000)
                tried_summary.append(f"text:{text}")
                if await cls._wait_qr_visible(page, timeout_ms=8000):
                    return
            except Exception:  # noqa: BLE001
                continue

        # 2. ARIA role=tab 兜底（极少数页面把 tab 标记成正经 ARIA tab）。
        for text in cls._QR_TAB_TEXT_CANDIDATES:
            try:
                tab = page.get_by_role("tab", name=text).first
                if not await tab.count() or not await tab.is_visible():
                    continue
                await tab.click(timeout=3000)
                tried_summary.append(f"tab:{text}")
                if await cls._wait_qr_visible(page, timeout_ms=8000):
                    return
            except Exception:  # noqa: BLE001
                continue

        # 3. 历史 hashed class / 模糊 class 兜底。
        for selector in cls._QR_TAB_FALLBACK_SELECTORS:
            try:
                switcher = page.locator(selector).first
                if not await switcher.count() or not await switcher.is_visible():
                    continue
                await switcher.click(timeout=3000)
                tried_summary.append(f"sel:{selector}")
                if await cls._wait_qr_visible(page, timeout_ms=8000):
                    return
            except Exception:  # noqa: BLE001
                continue

        # 4. 几何兜底：登录卡片右上角的"corner switcher"。XHS 默认进 短信登录 时，
        #    页面上没有"扫码登录"四个字 —— 必须找右上角那个小 QR 图标点。
        if await cls._click_corner_switcher(page):
            tried_summary.append("corner-icon")
            if await cls._wait_qr_visible(page, timeout_ms=8000):
                return

        log.warning(
            "xiaohongshu: QR tab switch failed; tried=%s. "
            "Run with SAU_REAL_LOGIN_HEADLESS=0 and inspect the login card's "
            "top-right icon to identify the current switcher selector.",
            tried_summary or "<nothing visible>",
        )

    @classmethod
    async def _click_corner_switcher(cls, page: Any) -> bool:
        """XHS 短信登录默认态下，QR 切换器是登录卡右上角的小图标。

        实现：用一次 page.evaluate 在浏览器里扫描登录卡内所有 element，按
        几何 + 可点性筛出 corner-zone 候选；然后回到 Python 用 mouse.click()
        按坐标依次点，每次都让 _wait_qr_visible 验证。

        相比枚举 Locator + DOM-order 抽样，这条路：
          - 不会被「页面里上千个 nested div」拖慢
          - 不依赖 emotion 哈希 class（class 改名不影响）
          - 能命中用 CSS background-image 画 QR 图标的纯 <div>
        """
        candidates_js = """
        () => {
          const card = document.querySelector(
            'div[class*="login-box"], .login-box-container'
          );
          if (!card) return { error: 'no-login-box', candidates: [] };
          const cr = card.getBoundingClientRect();
          const zoneRight = cr.right;
          const zoneTop = cr.top;
          const zoneLeft = cr.right - 160;
          const zoneBottom = cr.top + 160;

          const out = [];
          const all = card.querySelectorAll('*');
          for (const el of all) {
            if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.width > 80 || r.height > 80) continue;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (cx < zoneLeft || cx > zoneRight) continue;
            if (cy < zoneTop || cy > zoneBottom) continue;
            const style = window.getComputedStyle(el);
            const clickable =
              el.tagName === 'IMG' ||
              el.tagName === 'SVG' ||
              el.getAttribute('role') === 'button' ||
              style.cursor === 'pointer' ||
              style.backgroundImage !== 'none';
            if (!clickable) continue;
            out.push({
              cx, cy,
              x: r.left, y: r.top, w: r.width, h: r.height,
              tag: el.tagName,
              cls: typeof el.className === 'string' ? el.className : '',
              src: el.getAttribute('src') || '',
              aria: el.getAttribute('aria-label') || '',
              cursor: style.cursor,
              hasBg: style.backgroundImage !== 'none',
            });
          }
          // 离右上角越近排越前
          out.sort((a, b) =>
            (zoneRight - (a.x + a.w)) + (a.y - zoneTop)
            - ((zoneRight - (b.x + b.w)) + (b.y - zoneTop))
          );
          return {
            error: null,
            cardRect: { x: cr.left, y: cr.top, w: cr.width, h: cr.height },
            zone: { left: zoneLeft, right: zoneRight, top: zoneTop, bottom: zoneBottom },
            candidates: out.slice(0, 8),
          };
        }
        """
        try:
            result = await page.evaluate(candidates_js)
        except Exception:  # noqa: BLE001
            log.exception("xiaohongshu corner-switcher evaluate failed")
            return False

        if not result or result.get("error"):
            log.info(
                "xiaohongshu corner-switcher: evaluate returned error=%s",
                result.get("error") if result else "<null>",
            )
            return False

        candidates = result.get("candidates", [])
        log.info(
            "xiaohongshu corner-switcher: %d candidate(s) in zone %s",
            len(candidates),
            result.get("zone"),
        )
        for i, c in enumerate(candidates):
            log.info(
                "  [%d] tag=%s cursor=%s hasBg=%s rect=(%.0f,%.0f %.0fx%.0f) cls=%r src=%r",
                i,
                c.get("tag"),
                c.get("cursor"),
                c.get("hasBg"),
                c.get("x"),
                c.get("y"),
                c.get("w"),
                c.get("h"),
                c.get("cls")[:60] if c.get("cls") else "",
                (c.get("src") or "")[:60],
            )
            try:
                await page.mouse.click(c["cx"], c["cy"])
                if await cls._wait_qr_visible(page, timeout_ms=4000):
                    return True
            except Exception:  # noqa: BLE001
                continue
        return False

    @classmethod
    async def _wait_qr_visible(cls, page: Any, *, timeout_ms: int) -> bool:
        """点完 tab 切换器后等待 QR 面板出现。返回是否切换成功。"""
        deadline = time.monotonic() + timeout_ms / 1000.0
        while time.monotonic() < deadline:
            if await cls._qr_panel_visible(page):
                return True
            await page.wait_for_timeout(300)
        return False

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

    # XHS 新版创作者中心首页就展示 profile 卡片：
    #   https://creator.xiaohongshu.com/new/home
    #   <昵称> / 小红书账号：<id> / avatar
    # 不再跳 /setting/profile，那里不是当前绑定流程需要的页面。
    PROFILE_VIEW_URL_CANDIDATES = (
        "https://creator.xiaohongshu.com/new/home",
    )
    PROFILE_VIEW_NAVIGATE_TIMEOUT_MS = 10_000
    PROFILE_VIEW_READY_TIMEOUT_S = 15.0
    PROFILE_VIEW_READY_POLL_MS = 500

    @classmethod
    async def prepare_profile_view(cls, page: Any) -> None:
        """确保停在新版首页；命中 = body 含「小红书账号」且未被反弹回 /login。

        失败时不抛 —— 留在最后一次尝试的 URL（或原 landing 页）。storage_state
        在外层 _poll_real 里被本方法之后捕获，所以即使最终页是 dashboard 也能
        拿到最新一次 navigation 刷新的 csrf/session cookies。"""
        for url in cls.PROFILE_VIEW_URL_CANDIDATES:
            try:
                await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=cls.PROFILE_VIEW_NAVIGATE_TIMEOUT_MS,
                )
                landed_url = getattr(page, "url", "") or ""
                if "/login" in landed_url:
                    log.warning(
                        "[xiaohongshu] prepare_profile_view: %s redirected to %s; trying next",
                        url, landed_url,
                    )
                    continue
                if await cls._wait_home_profile_card_ready(page):
                    log.info("[xiaohongshu] prepare_profile_view ok via %s", url)
                    return
                log.info(
                    "[xiaohongshu] prepare_profile_view: %s loaded but profile card not ready; trying next",
                    url,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "[xiaohongshu] prepare_profile_view navigate failed url=%s err=%s",
                    url, exc,
                )
                continue
        log.warning(
            "[xiaohongshu] prepare_profile_view: all candidates failed; "
            "extract_profile will run against post-login landing page"
        )

    @classmethod
    async def _wait_home_profile_card_ready(cls, page: Any) -> bool:
        """Wait until `/new/home` has actually painted the profile card.

        XHS can flip out of `/login` before the creator-home SPA has mounted.
        If we close the browser immediately after that first logged-in signal,
        the operator sees "page closed too fast" and the extractor may only see
        skeleton text. Gate success on the account label plus a parseable id.
        """
        deadline = time.monotonic() + cls.PROFILE_VIEW_READY_TIMEOUT_S
        while time.monotonic() < deadline:
            try:
                if "/login" in ((getattr(page, "url", "") or "")):
                    return False
                home_fields = await cls._read_home_card_fields(page)
                if home_fields.get("platformAccountId") and home_fields.get("displayName"):
                    return True
                body = await _body_text(page)
                if _extract_labeled_account_id(body, cls.ACCOUNT_ID_LABELS):
                    return True
            except Exception:  # noqa: BLE001
                pass
            await page.wait_for_timeout(cls.PROFILE_VIEW_READY_POLL_MS)
        return False

    @classmethod
    async def extract_profile(cls, page: Any, account_name: str) -> dict[str, Any]:
        return await _poll_extract_profile(
            page,
            cls._read_profile_fields,
            timeout_s=cls.PROFILE_READY_TIMEOUT_S,
            interval_ms=cls.PROFILE_POLL_INTERVAL_MS,
            label_hints=cls.ACCOUNT_ID_LABELS,
            diagnostic_tag="xiaohongshu",
        )

    @classmethod
    async def _read_profile_fields(cls, page: Any) -> dict[str, Any]:
        home_fields = await cls._read_home_card_fields(page)
        display = home_fields.get("displayName") or await _first_text(page, cls.DISPLAY_SELECTORS)
        avatar = home_fields.get("avatarUrl") or await _first_attr(page, cls.AVATAR_SELECTORS, "src")
        account_id = home_fields.get("platformAccountId") or await _first_text(page, cls.ACCOUNT_ID_SELECTORS)
        body = await _body_text(page)
        if account_id and ("小红书" in account_id or "ID" in account_id.upper()):
            extracted = _extract_labeled_account_id(
                account_id, cls.ACCOUNT_ID_LABELS,
            )
            if extracted:
                account_id = extracted
        if not account_id:
            account_id = _extract_labeled_account_id(body, cls.ACCOUNT_ID_LABELS)
        if _is_placeholder_profile_text(display):
            display = None
        if not display:
            display = _extract_text_before_label(body, "小红书账号") \
                or _extract_text_before_label(body, "小红书号")
        if _is_placeholder_profile_text(display):
            display = None
        return {
            "displayName": display,
            "platformAccountId": account_id,
            "avatarUrl": avatar,
        }

    @classmethod
    async def _read_home_card_fields(cls, page: Any) -> dict[str, Any]:
        """Read XHS `/new/home` profile card by anchoring on "小红书账号".

        Body-level fallback is risky on this page because stats like "获赞与收藏"
        appear immediately before the account label in flattened text. This DOM
        pass climbs from the label node to the surrounding card and picks the
        prominent text above the label as the display name.
        """
        try:
            result = await page.evaluate(
                """
                (labels) => {
                  const empty = { displayName: null, platformAccountId: null, avatarUrl: null };
                  const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim() || null;
                  const visible = (el) => {
                    if (!el || !(el instanceof Element)) return false;
                    const rect = el.getBoundingClientRect();
                    if (!rect.width || !rect.height) return false;
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                  };
                  const rejectDisplay = (text) => {
                    if (!text) return true;
                    if (text.length > 48) return true;
                    if (/^\\d+$/.test(text)) return true;
                    return /小红书|账号|状态|正常|关注|粉丝|获赞|收藏|成长|发布|笔记|数据|首页|买手|合作/.test(text);
                  };
                  const idFrom = (text) => {
                    const src = clean(text) || '';
                    for (const label of labels) {
                      const m = src.match(new RegExp(label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\s*[:：]\\\\s*([A-Za-z0-9_.-]{2,80})'));
                      if (m) return m[1];
                    }
                    return null;
                  };

                  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                  const labelTexts = [];
                  let node;
                  while ((node = walker.nextNode())) {
                    const text = clean(node.textContent);
                    if (!text || !labels.some((label) => text.includes(label))) continue;
                    if (!node.parentElement || !visible(node.parentElement)) continue;
                    labelTexts.push(node.parentElement);
                    if (labelTexts.length >= 8) break;
                  }

                  for (const labelEl of labelTexts) {
                    let card = labelEl;
                    let best = null;
                    for (let depth = 0; depth < 8 && card; depth += 1) {
                      const text = clean(card.innerText || card.textContent || '');
                      const rect = card.getBoundingClientRect();
                      if (
                        text &&
                        labels.some((label) => text.includes(label)) &&
                        rect.width >= 280 &&
                        rect.height >= 80 &&
                        rect.height <= 420
                      ) {
                        best = card;
                        if (text.includes('账号状态') || text.includes('关注数') || text.includes('粉丝数')) break;
                      }
                      card = card.parentElement;
                    }
                    if (!best) continue;

                    const cardText = clean(best.innerText || best.textContent || '') || '';
                    const platformAccountId = idFrom(cardText);
                    const labelTop = labelEl.getBoundingClientRect().top;
                    const candidates = [];
                    for (const el of best.querySelectorAll('span,div,p,strong,b')) {
                      if (!visible(el)) continue;
                      const text = clean(el.innerText || el.textContent || '');
                      if (rejectDisplay(text)) continue;
                      const rect = el.getBoundingClientRect();
                      const style = window.getComputedStyle(el);
                      const fontSize = parseFloat(style.fontSize || '0');
                      const fontWeight = parseInt(style.fontWeight || '400', 10) || 400;
                      let score = 0;
                      if (rect.top < labelTop) score += 4;
                      if (fontSize >= 18) score += 3;
                      if (fontWeight >= 500) score += 2;
                      if (rect.left > best.getBoundingClientRect().left + 80) score += 1;
                      candidates.push({ text, score, top: rect.top, left: rect.left });
                    }
                    candidates.sort((a, b) => b.score - a.score || a.top - b.top || a.left - b.left);

                    let avatarUrl = null;
                    for (const img of best.querySelectorAll('img')) {
                      if (!visible(img)) continue;
                      const rect = img.getBoundingClientRect();
                      if (rect.width < 32 || rect.height < 32) continue;
                      avatarUrl = img.getAttribute('src') || null;
                      if (avatarUrl) break;
                    }

                    return {
                      displayName: candidates.length ? candidates[0].text : null,
                      platformAccountId,
                      avatarUrl,
                    };
                  }
                  return empty;
                }
                """,
                list(cls.ACCOUNT_ID_LABELS),
            )
            return result if isinstance(result, dict) else _empty_profile()
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
    # real-mode: true when login/start found a valid existing creator session,
    # so the frontend should poll for storage_state/profile instead of showing a QR.
    already_logged_in: bool = False
    # mock-only: number of polls before flipping to success
    polls_until_success: int = 2
    polls_seen: int = 0
    # real-mode handles: {playwright, browser, context, page}.
    # Kept open between /login/start and /login/poll; closed on success/expire/drop.
    handles: dict[str, Any] = field(default_factory=dict)
    # real-mode: current platform interaction needed to finish login
    # (SMS verification for v1). Shape mirrors frontend InteractionRequired.
    interaction_required: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None
    diagnostic_id: str | None = None


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

    async def submit_interaction(self, ticket: str, response: dict[str, Any], *, mock: bool) -> str:
        """Submit a user answer for a login-time interaction.

        Return values are route-friendly: accepted | not_found | not_pending.
        Mock mode accepts immediately so frontend flows can be tested without a
        browser. Real mode drives the same Playwright page kept by LoginSession.
        """
        async with self._lock:
            self._sweep_locked()
            session = self._sessions.get(ticket)
        if session is None:
            return "not_found"
        if mock:
            return "accepted"
        if session.interaction_required is None:
            return "not_pending"

        page = session.handles.get("page")
        if page is None:
            return "not_found"
        driver = get_sms_driver(session.platform)
        if driver is None:
            return "not_pending"
        driver_cls = DRIVERS.get(session.platform)

        code = str((response or {}).get("code") or "").strip()
        if not code:
            return "not_pending"

        log.info(
            "login_pool: received login interaction ticket=%s platform=%s code_len=%d",
            ticket,
            session.platform,
            len(code),
        )
        try:
            ok = await driver.submit_code(page, code)
        except Exception:  # noqa: BLE001
            log.exception("login_pool: submit_interaction crashed ticket=%s platform=%s", ticket, session.platform)
            ok = False
        log.info(
            "login_pool: submit_interaction driver result ticket=%s platform=%s ok=%s",
            ticket,
            session.platform,
            ok,
        )
        if not ok:
            session.interaction_required = {
                **session.interaction_required,
                "prompt": "验证码提交失败，请检查后重试。",
            }
            return "submit_failed"

        cleared = await self._wait_login_interaction_cleared(
            session,
            driver,
            page,
            driver_cls,
            max_seconds=8.0,
        )
        if cleared:
            session.interaction_required = None
            return "accepted"
        else:
            session.interaction_required = {
                **session.interaction_required,
                "prompt": "平台仍在等待验证码，可能输入有误，请重新提交。",
            }
            return "submit_failed"

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
            browser = await playwright.chromium.launch(**chromium_launch_kwargs(headless=headless))
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()

            # 监听 check_qrconnect 响应，把 QR 扫码状态变化记入日志
            _last_qr_status: dict[str, str | None] = {"v": None}

            async def _on_qr_response(resp):
                if "check_qrconnect" not in resp.url:
                    return
                try:
                    import json as _json
                    body = await resp.text()
                    data = _json.loads(body).get("data", {})
                    status = data.get("status") or data.get("account_flow") or "unknown"
                    if status != _last_qr_status["v"]:
                        log.info(
                            "login_pool: [QR-listener] ticket=%s status=%r → %r data_keys=%s",
                            ticket, _last_qr_status["v"], status, list(data.keys()),
                        )
                        _last_qr_status["v"] = status
                except Exception:  # noqa: BLE001
                    pass

            page.on("response", _on_qr_response)

            await page.goto(
                driver_cls.LOGIN_URL,
                wait_until="domcontentloaded",
                timeout=LOGIN_NAV_TIMEOUT_MS,
            )
            qr_data_url: str | None = None
            already_logged_in = False
            if await _is_logged_in_safely(driver_cls, page, ticket=ticket):
                already_logged_in = True
                log.info(
                    "login_pool: login/start detected existing login ticket=%s platform=%s "
                    "url=%s; continuing without QR",
                    ticket,
                    platform,
                    getattr(page, "url", None),
                )
            else:
                # The driver's wait_for() calls inside extract_qr_data_url() are
                # the real timing gate (up to 30s); we don't need a hard sleep.
                try:
                    qr_data_url = await driver_cls.extract_qr_data_url(page)
                except _AlreadyLoggedInForBind:
                    already_logged_in = True
                    log.info(
                        "login_pool: login/start reached logged-in page while extracting QR "
                        "ticket=%s platform=%s url=%s; continuing without QR",
                        ticket,
                        platform,
                        getattr(page, "url", None),
                    )
                except Exception as qr_exc:
                    if await _is_logged_in_safely(driver_cls, page, ticket=ticket):
                        already_logged_in = True
                        log.info(
                            "login_pool: login/start QR extraction failed after logged-in "
                            "navigation ticket=%s platform=%s url=%s error=%s; continuing without QR",
                            ticket,
                            platform,
                            getattr(page, "url", None),
                            qr_exc,
                        )
                    else:
                        # v0.17.3: 任何 driver 的 QR 提取失败都先抓 snapshot 再抛。
                        # XHS / 视频号 / 快手 的 /login 页 DOM 都不稳定；一张 PNG +
                        # HTML 比任何盲猜 selector 都管用。XiaohongshuDriver 自己已经
                        # 在内部 raise 前调过本 helper（带 snapshot 路径塞进 msg）；这里
                        # 是兜其它 driver 的底（万一 ShipinhaoDriver 也开始飘）。
                        if "snapshot:" not in str(qr_exc):
                            await _dump_qr_extraction_failure(page, platform, str(qr_exc))
                        raise
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
            already_logged_in=already_logged_in,
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
        if session.error_code:
            return {
                "status": "failed",
                "error_code": session.error_code,
                "message": session.error_message,
                "diagnostic_id": session.diagnostic_id,
            }

        # Scan-login can land on the creator-center URL before the platform
        # finishes its second verification. If we classify the page as logged
        # in first, the frontend keeps showing the QR while the headed browser
        # is blocked on an SMS modal. Interaction detection must win.
        interaction = await self._detect_login_interaction(session, page, driver_cls)
        if interaction is not None:
            return {
                "status": "awaiting_user",
                "interaction_required": interaction,
            }

        try:
            logged_in = await driver_cls.is_logged_in(page)
        except Exception:  # noqa: BLE001
            log.exception("login_pool: is_logged_in failed ticket=%s", session.ticket)
            diag = await _dump_qr_extraction_failure(page, session.platform, "is_logged_in failed during poll")
            session.error_code = "LOGIN_UNEXPECTED_PAGE"
            session.error_message = "平台登录页面进入未知状态，请重新扫码或联系运营处理。"
            session.diagnostic_id = string_or_none(diag.get("diagnostic_id")) or session.platform
            return {
                "status": "failed",
                "error_code": session.error_code,
                "message": session.error_message,
                "diagnostic_id": session.diagnostic_id,
            }

        if not logged_in:
            return {"status": "pending"}

        # v0.17.2+: 给 driver 一次 navigate / interact 的机会，把 profile 字段
        # 顶到可读位置（例如 XHS 新版首页 /new/home 的资料卡）。
        # storage_state 在这之后捕获 —— 多吃一次 cookie 刷新，session 更长。
        # 失败一概不抛 —— extract_profile 自身有 best-effort fallback。
        try:
            await driver_cls.prepare_profile_view(page)
        except Exception:  # noqa: BLE001
            log.exception(
                "login_pool: prepare_profile_view crashed ticket=%s platform=%s",
                session.ticket, session.platform,
            )

        try:
            storage_state = await context.storage_state()
        except Exception:  # noqa: BLE001
            log.exception("login_pool: storage_state() failed ticket=%s", session.ticket)
            await self.drop(session.ticket)
            return {"status": "expired"}

        profile = await driver_cls.extract_profile(page, session.account_name)
        log.info(
            "login_pool: profile extracted ticket=%s platform=%s display=%r platform_id=%r avatar=%s url=%s",
            session.ticket,
            session.platform,
            profile.get("displayName") if profile else None,
            profile.get("platformAccountId") if profile else None,
            "yes" if profile and profile.get("avatarUrl") else "no",
            getattr(page, "url", None),
        )
        await self.drop(session.ticket)
        return {
            "status": "success",
            "storage_state": storage_state,
            "profile": profile,
        }

    async def _detect_login_interaction(
        self,
        session: LoginSession,
        page: Any,
        driver_cls: type[PlatformDriver] | None,
    ) -> dict[str, Any] | None:
        driver = get_sms_driver(session.platform)
        if driver is None:
            return None
        try:
            detected = await driver.detect(page)
        except Exception:  # noqa: BLE001
            log.exception("login_pool: interaction detect failed ticket=%s platform=%s", session.ticket, session.platform)
            return None
        if not detected:
            if session.interaction_required is not None and await self._wait_login_interaction_cleared(
                session,
                driver,
                page,
                driver_cls,
                max_seconds=0,
            ):
                session.interaction_required = None
                return None
            return session.interaction_required

        if session.interaction_required is None:
            created_at = datetime.fromtimestamp(now_unix(), tz=timezone.utc).isoformat()
            can_resend_at = detected.get("can_resend_at")
            session.interaction_required = {
                "kind": "sms",
                "prompt": "平台要求输入短信验证码以完成账号绑定。",
                "phoneMasked": detected.get("phone_masked"),
                "canResendAt": datetime.fromtimestamp(can_resend_at, tz=timezone.utc).isoformat()
                if can_resend_at else None,
                "createdAt": created_at,
            }
            try:
                await driver.request_sms(page)
            except Exception:  # noqa: BLE001
                log.exception("login_pool: request_sms failed ticket=%s platform=%s", session.ticket, session.platform)
        return session.interaction_required

    async def _wait_login_interaction_cleared(
        self,
        session: LoginSession,
        driver: SmsInteractionDriver,
        page: Any,
        driver_cls: type[PlatformDriver] | None,
        *,
        max_seconds: float,
    ) -> bool:
        """Return true once the SMS challenge disappears or login completes."""
        deadline = time.monotonic() + max(0.0, max_seconds)
        first = True
        while first or time.monotonic() < deadline:
            first = False
            try:
                if await driver.is_cleared(page):
                    log.info(
                        "login_pool: interaction cleared ticket=%s platform=%s via=modal_hidden",
                        session.ticket,
                        session.platform,
                    )
                    return True
            except Exception:  # noqa: BLE001
                log.exception(
                    "login_pool: interaction is_cleared crashed ticket=%s platform=%s",
                    session.ticket,
                    session.platform,
                )
            if driver_cls is not None:
                try:
                    if await driver_cls.is_logged_in(page):
                        log.info(
                            "login_pool: interaction cleared ticket=%s platform=%s via=logged_in url=%s",
                            session.ticket,
                            session.platform,
                            getattr(page, "url", None),
                        )
                        return True
                except Exception:  # noqa: BLE001
                    log.exception(
                        "login_pool: interaction logged-in check crashed ticket=%s platform=%s",
                        session.ticket,
                        session.platform,
                    )
            if time.monotonic() >= deadline:
                break
            await asyncio.sleep(0.5)
        return False

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
