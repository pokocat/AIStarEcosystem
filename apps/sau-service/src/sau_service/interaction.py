"""Platform-specific in-page interaction (SMS verification codes).

Architecture
============

During real-mode upload (DouYinVideo.upload / TencentVideo.upload), the
platform may surface a modal asking the user to confirm a phone-number
verification code. The upstream uploader is opaque to us — it just retries
clicking "发布" forever inside its `while True` loop. So we run a side
watcher coroutine on the same Playwright Page:

  1. Poll DOM every INTERACTION_POLL_INTERVAL_S seconds for the SMS modal.
  2. When detected, click the platform's "获取验证码" button automatically
     and push status=awaiting_user with phone_masked + can_resend_at to
     the server (which mirrors it to the frontend).
  3. Wait on TaskRecord.interaction_event (set by submit_interaction()
     when the user POSTs their code through server → sau-service).
  4. Fill the input + click "确认". The modal closes. Upstream's publish-
     button retry loop naturally succeeds on the next pass.

Current status
==============

The DOM selectors for douyin have been captured from creator.douyin.com
second verification (`#uc-second-verify`). Shipinhao, kuaishou, and
xiaohongshu still use `_PlaceholderSmsDriver` until we trigger and capture
a real prompt on each platform.

To wire a real driver:
  1. Open the platform's upload page in headed chromium.
  2. Trigger 风控 (or load a saved DOM snapshot).
  3. Inspect element on the modal — capture the wrapper, phone-text,
     "获取验证码" button, code input, "确认" button selectors.
  4. Replace `_PlaceholderSmsDriver` for that platform with a real
     subclass; selectors live in class-level constants for review.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import tempfile
import time
from typing import Any, Protocol

log = logging.getLogger(__name__)


_SMS_CAPTURE_SCRIPT = r"""
() => {
  const KEYWORDS = /(短信|验证码|校验码|手机|手机号|获取验证码|发送验证码|重新发送|确认|提交|安全验证|身份验证|登录验证|验证|code|sms|verification)/i;
  const MODAL_HINT = /(modal|dialog|drawer|popup|popover|verify|verification|captcha|sms|phone|semi|arco|byted|byte|douyin|验证码|短信)/i;
  const MAX_CANDIDATES = 80;
  const MAX_ROOTS = 20;

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function cssString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ");
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  function isVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = el.tagName.toLowerCase();
    if (["script", "style", "meta", "link", "noscript"].includes(tag)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
  }

  function clean(text, limit = 220) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/1\d{2}\D?\d{4}\D?\d{4}/g, (m) => m.slice(0, 3) + "****" + m.slice(-4))
      .replace(/\b\d{6}\b/g, "******")
      .trim()
      .slice(0, limit);
  }

  function ownText(el) {
    const parts = [];
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) parts.push(n.textContent || "");
    }
    return clean(parts.join(" "));
  }

  function textBlob(el) {
    const attrs = [
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder"),
      el.getAttribute("title"),
      el.getAttribute("value"),
      ownText(el),
      el.innerText,
      el.textContent,
    ];
    return clean(attrs.filter(Boolean).join(" "), 500);
  }

  function selectorFor(el) {
    const tag = el.tagName.toLowerCase();
    const attrs = ["data-testid", "data-test-id", "data-e2e", "data-cy", "name", "placeholder", "aria-label"];
    if (el.id && !/^\d/.test(el.id)) return `${tag}#${cssEscape(el.id)}`;
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (value && value.length <= 80) return `${tag}[${attr}="${cssString(value)}"]`;
    }
    const chain = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement) {
      const nodeTag = node.tagName.toLowerCase();
      if (node.id && !/^\d/.test(node.id)) {
        chain.unshift(`${nodeTag}#${cssEscape(node.id)}`);
        break;
      }
      let part = nodeTag;
      const cls = Array.from(node.classList || []).filter((c) => c && !/^\d/.test(c)).slice(0, 2);
      if (cls.length) part += "." + cls.map(cssEscape).join(".");
      if (node.parentElement) {
        const siblings = Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      chain.unshift(part);
      if (chain.length >= 5) break;
      node = node.parentElement;
    }
    return chain.join(" > ");
  }

  function outer(el, limit = 1800) {
    return clean((el.outerHTML || "").replace(/</g, "\n<"), limit);
  }

  function score(el, blob) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") || "";
    const cls = `${el.id || ""} ${el.className || ""}`;
    let s = 0;
    if (KEYWORDS.test(blob)) s += 5;
    if (/(验证码|短信|手机号|获取验证码|发送验证码)/.test(blob)) s += 6;
    if (["input", "textarea", "button"].includes(tag)) s += 4;
    if (role === "dialog" || MODAL_HINT.test(cls)) s += 4;
    const style = window.getComputedStyle(el);
    if (style.position === "fixed") s += 3;
    if (tag === "input" && /(验证码|code|sms)/i.test(blob)) s += 8;
    if (tag === "button" && /(获取|发送|重新|确认|提交|确定)/.test(blob)) s += 7;
    return s;
  }

  function summarize(el, kind) {
    const blob = textBlob(el);
    return {
      kind,
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      type: el.getAttribute("type"),
      className: clean(el.className || "", 180),
      id: el.id || null,
      text: clean(blob),
      ownText: ownText(el),
      placeholder: clean(el.getAttribute("placeholder")),
      ariaLabel: clean(el.getAttribute("aria-label")),
      rect: rectOf(el),
      score: score(el, blob),
      outerHTML: outer(el),
    };
  }

  const elements = Array.from(document.querySelectorAll("body *")).filter(isVisible);
  const candidates = elements
    .map((el) => ({ el, blob: textBlob(el) }))
    .filter(({ el, blob }) => {
      const tag = el.tagName.toLowerCase();
      const attrs = [el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("title")].filter(Boolean).join(" ");
      return KEYWORDS.test(blob) || KEYWORDS.test(attrs) || (["input", "textarea", "button"].includes(tag) && KEYWORDS.test(`${blob} ${attrs}`));
    })
    .map(({ el }) => summarize(el, "candidate"))
    .sort((a, b) => b.score - a.score || (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height))
    .slice(0, MAX_CANDIDATES);

  const rootMap = new Map();
  for (const cand of candidates) {
    let el = document.querySelector(cand.selector);
    let best = null;
    let hops = 0;
    while (el && el !== document.body && hops < 8) {
      const style = window.getComputedStyle(el);
      const cls = `${el.id || ""} ${el.className || ""}`;
      const role = el.getAttribute("role") || "";
      const r = el.getBoundingClientRect();
      const looksModal = role === "dialog" || style.position === "fixed" || MODAL_HINT.test(cls);
      const saneSize = r.width >= 220 && r.height >= 100 && r.width <= window.innerWidth && r.height <= window.innerHeight;
      if (looksModal && saneSize) best = el;
      el = el.parentElement;
      hops += 1;
    }
    if (best) rootMap.set(selectorFor(best), best);
  }
  const modalRoots = Array.from(rootMap.values())
    .map((el) => summarize(el, "modal-root"))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ROOTS);

  return {
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    modalRoots,
    candidates,
  };
}
"""


class SmsInteractionDriver(Protocol):
    """Per-platform contract for detecting + answering an SMS modal."""

    PLATFORM_NAME: str

    async def detect(self, page: Any) -> dict[str, Any] | None:
        """Return interaction payload when SMS modal is on-screen; None otherwise.

        Payload fields (snake_case wire form for callback):
          - phone_masked: str | None
          - can_resend_at: float | None (unix ts)
        """
        ...

    async def request_sms(self, page: Any) -> bool:
        """Click the platform's '获取验证码' button. Returns True on success.

        Side-effect: platform sends SMS to the bound phone. Idempotent in the
        sense that the platform's own cooldown (typically 60s) prevents
        double-sending — caller doesn't need to dedupe.
        """
        ...

    async def submit_code(self, page: Any, code: str) -> bool:
        """Fill code input + click '确认'. Returns True on success.

        After this returns the watcher loops back to detect(); if the modal
        is gone we exit the awaiting_user branch and let upstream proceed.
        If the code was wrong the modal stays up — the watcher pushes
        awaiting_user again with an error_message hint.
        """
        ...

    async def is_cleared(self, page: Any) -> bool:
        """True iff the SMS modal is no longer on screen.

        Called after submit_code() to confirm we can exit awaiting_user.
        Conservative — when in doubt return False so we surface the modal
        to the user again rather than silently letting upload time out.
        """
        ...


class _PlaceholderSmsDriver:
    """No-op driver shipped as the MVP placeholder.

    detect() always returns None, so SMS path never triggers. Real selectors
    require live capture against creator.douyin.com / channels.weixin.qq.com
    after intentionally triggering 风控 — see module docstring.
    """

    def __init__(self, platform_name: str) -> None:
        self.PLATFORM_NAME = platform_name
        self._last_capture_hash: str | None = None

    async def detect(self, page: Any) -> dict[str, Any] | None:
        # Placeholder: never reports SMS needed. Real implementation should
        # look for the modal wrapper, e.g.:
        #   modal = page.locator("div.semi-modal-wrap").filter(has_text="验证码")
        #   if not await modal.count(): return None
        #   phone_text = await modal.locator(".phone-text").text_content()
        #   return {"phone_masked": _mask(phone_text), "can_resend_at": None}
        await self._capture_sms_dom_if_enabled(page)
        return None

    async def _capture_sms_dom_if_enabled(self, page: Any) -> None:
        """Debug-only selector harvester for real SMS modals.

        Enable with SAU_SMS_CAPTURE=1 while running headed real-mode upload.
        The watcher still returns None; it only writes sanitized DOM summaries
        so we can turn captured selectors into a real platform driver.
        """
        if os.environ.get("SAU_SMS_CAPTURE", "").strip().lower() not in {"1", "true", "yes", "on"}:
            return
        try:
            snapshot = await page.evaluate(_SMS_CAPTURE_SCRIPT)
        except Exception:  # noqa: BLE001
            log.exception("[interaction %s] SMS DOM capture evaluate failed", self.PLATFORM_NAME)
            return
        if not snapshot or not snapshot.get("candidates"):
            return

        payload = json.dumps(snapshot, ensure_ascii=False, sort_keys=True)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
        if digest == self._last_capture_hash:
            return
        self._last_capture_hash = digest

        out_dir = os.environ.get("SAU_SMS_CAPTURE_DIR") or os.path.join(
            tempfile.gettempdir(),
            "sau-service",
            "sms-capture",
        )
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"{self.PLATFORM_NAME}-{int(time.time())}-{digest}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(snapshot, fh, ensure_ascii=False, indent=2)
        log.warning(
            "[interaction %s] wrote SMS DOM capture %s candidates=%d modal_roots=%d",
            self.PLATFORM_NAME,
            path,
            len(snapshot.get("candidates") or []),
            len(snapshot.get("modalRoots") or []),
        )

    async def request_sms(self, page: Any) -> bool:  # noqa: ARG002
        log.warning(
            "[interaction %s] request_sms called on placeholder driver — "
            "selectors not yet captured; SMS auto-send NO-OP",
            self.PLATFORM_NAME,
        )
        return False

    async def submit_code(self, page: Any, code: str) -> bool:  # noqa: ARG002
        log.warning(
            "[interaction %s] submit_code called on placeholder driver — "
            "selectors not yet captured; code dropped on the floor",
            self.PLATFORM_NAME,
        )
        return False

    async def is_cleared(self, page: Any) -> bool:  # noqa: ARG002
        # If detect() always returns None we never enter awaiting_user, so
        # is_cleared is moot. Default True to keep upstream code simple.
        return True


class _DouyinSmsDriver(_PlaceholderSmsDriver):
    """Douyin creator-center second-verification SMS modal.

    Captured on creator.douyin.com upload flow, May 20 2026:
      #uc-second-verify
        .second-verify-panel
          .uc-ui-verify_sms-verify_content_desc  (phone text)
          input[placeholder="请输入验证码"]          (code input)
          .uc-ui-input_right                     ("获取验证码")
          .uc-ui-button_group ...                ("验证")
    """

    PLATFORM_NAME = "douyin"

    MASK_SELECTOR = "#uc-second-verify .second-verify-mask"
    PANEL_SELECTOR = "#uc-second-verify .second-verify-panel"
    PHONE_TEXT_SELECTOR = ".uc-ui-verify_sms-verify_content_desc"
    CODE_INPUT_SELECTOR = 'input[placeholder="请输入验证码"]'
    REQUEST_SMS_SELECTOR = ".uc-ui-verify_sms-verify_input .uc-ui-input_right"
    SUBMIT_BUTTON_SELECTOR = ".uc-ui-button_group .uc-ui-verify_sms-verify_button"

    def __init__(self) -> None:
        super().__init__(self.PLATFORM_NAME)

    def _panel(self, page: Any) -> Any:
        return page.locator(self.PANEL_SELECTOR).filter(has_text="接收短信验证码").first

    async def _is_modal_visible(self, page: Any) -> bool:
        panel = self._panel(page)
        try:
            if await panel.count() == 0:
                return False
            return await panel.is_visible(timeout=500)
        except Exception:  # noqa: BLE001
            return False

    async def _text_or_empty(self, locator: Any, *, timeout: int = 500) -> str:
        try:
            return (await locator.text_content(timeout=timeout) or "").strip()
        except Exception:  # noqa: BLE001
            return ""

    def _extract_phone_mask(self, text: str) -> str | None:
        compact = re.sub(r"\s+", "", text or "")
        matched = re.search(r"1\d{2}[\d*]{4,8}\d{2,4}", compact)
        return mask_phone(matched.group(0) if matched else compact)

    async def detect(self, page: Any) -> dict[str, Any] | None:
        await self._capture_sms_dom_if_enabled(page)
        if not await self._is_modal_visible(page):
            return None

        panel = self._panel(page)
        desc = await self._text_or_empty(panel.locator(self.PHONE_TEXT_SELECTOR).first)
        request_text = await self._text_or_empty(panel.locator(self.REQUEST_SMS_SELECTOR).first)

        can_resend_at = None
        cooldown_match = re.search(r"(\d{1,3})\s*(?:s|秒)", request_text, flags=re.IGNORECASE)
        if cooldown_match:
            can_resend_at = now_unix() + int(cooldown_match.group(1))

        return {
            "phone_masked": self._extract_phone_mask(desc),
            "can_resend_at": can_resend_at,
        }

    async def request_sms(self, page: Any) -> bool:
        if not await self._is_modal_visible(page):
            return False
        panel = self._panel(page)
        button = panel.locator(self.REQUEST_SMS_SELECTOR).first
        text = await self._text_or_empty(button)
        if re.search(r"(\d{1,3})\s*(?:s|秒)", text, flags=re.IGNORECASE):
            return False
        if text and not re.search(r"(获取|发送|重新|验证码)", text):
            log.info("[interaction douyin] request_sms skipped unexpected button text=%r", text)
            return False
        try:
            await button.click(timeout=1_500)
            return True
        except Exception:  # noqa: BLE001
            log.exception("[interaction douyin] failed to click request_sms")
            return False

    async def submit_code(self, page: Any, code: str) -> bool:
        if not await self._is_modal_visible(page):
            return False
        panel = self._panel(page)
        normalized = "".join(ch for ch in code if ch.isdigit())
        if len(normalized) != 6:
            return False

        try:
            await panel.locator(self.CODE_INPUT_SELECTOR).first.fill(normalized, timeout=1_500)
            # The "验证" div drops its disabled class after the 6-digit input settles.
            await page.wait_for_timeout(200)
            submit = panel.locator(self.SUBMIT_BUTTON_SELECTOR).filter(has_text="验证").first
            await submit.click(timeout=1_500)
            return True
        except Exception:  # noqa: BLE001
            log.exception("[interaction douyin] failed to submit SMS code")
            return False

    async def is_cleared(self, page: Any) -> bool:
        try:
            await page.locator(self.PANEL_SELECTOR).first.wait_for(state="hidden", timeout=2_000)
            return True
        except Exception:  # noqa: BLE001
            return not await self._is_modal_visible(page)


# Per-platform drivers; swap in real subclasses as selectors are captured.
# Keys MUST match SocialPlatform wire form (lowercase) from server.
SMS_DRIVERS: dict[str, SmsInteractionDriver] = {
    "douyin": _DouyinSmsDriver(),
    "shipinhao": _PlaceholderSmsDriver("shipinhao"),
    "kuaishou": _PlaceholderSmsDriver("kuaishou"),
    "xiaohongshu": _PlaceholderSmsDriver("xiaohongshu"),
}


def get_sms_driver(platform: str) -> SmsInteractionDriver | None:
    """Return the SMS driver for a platform, or None if unsupported.

    Caller must skip the watcher path entirely when None — the placeholder
    drivers are themselves listed in SMS_DRIVERS, so a None return means
    "platform not even known to this module". Currently all four v1-enabled
    platforms (douyin / shipinhao / kuaishou / xiaohongshu) are in the
    dictionary; only douyin has live selectors, the rest are placeholders
    until operator captures their SMS modal via SAU_SMS_CAPTURE=1.
    """
    return SMS_DRIVERS.get(platform.lower())


def mask_phone(raw: str | None) -> str | None:
    """Mask 138XXXX5678 → 138****5678. Tolerant to length/format variation.

    Real platform values may be partially masked already (138****5678),
    fully numeric (13812345678), or with separators. We aim for visible
    head 3 + tail 4, asterisks in the middle. Returns None for empty input.
    """
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit() or ch == "*")
    if len(digits) < 7:
        # Too short to mask meaningfully; pass through (still scrubbed of
        # punctuation). Length-7 covers "12345678" worst-case.
        return digits or raw
    head, tail = digits[:3], digits[-4:]
    return f"{head}****{tail}"


def now_unix() -> float:
    """Single time source — easier to monkeypatch in tests."""
    return time.time()
