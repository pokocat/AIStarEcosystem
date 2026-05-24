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
second verification (`#uc-second-verify`). Douyin also has a generic fallback
that looks for visible SMS/code inputs inside verification surfaces, so class
name drift does not block the frontend from entering `awaiting_user`.

To wire a real driver:
  1. Open the platform's upload page in headed chromium.
  2. Trigger 风控 (or load a saved DOM snapshot).
  3. Inspect element on the modal — capture the wrapper, phone-text,
     "获取验证码" button, code input, "确认" button selectors.
  4. Add a platform subclass only when the generic fallback cannot reliably
     click request/submit controls; selectors live in class-level constants.
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
    """Capture-only placeholder for platforms that are not wired yet.

    Non-douyin platforms must not be auto-clicked until we have verified their
    DOM. The generic helper methods below are reusable building blocks, but
    this base driver only records sanitized captures when enabled.
    """

    CODE_INPUT_SELECTOR = (
        'input[placeholder*="验证码"], '
        'input[placeholder*="校验码"], '
        'input[aria-label*="验证码"], '
        'input[aria-label*="校验码"], '
        'input[autocomplete="one-time-code"], '
        'input[name*="code" i], '
        'input[id*="code" i], '
        'textarea[placeholder*="验证码"], '
        'textarea[placeholder*="校验码"]'
    )
    REQUEST_BUTTON_RE = r"(获取|发送|重新发送|重发|send|resend).{0,12}(验证码|校验码|code|sms)|^(获取|发送|重新发送|重发)$"
    SUBMIT_BUTTON_RE = r"^(验证|确认|提交|确定|完成|verify|confirm|submit|done)$"
    COOLDOWN_RE = r"(\d{1,3})\s*(?:s|秒)"

    def __init__(self, platform_name: str) -> None:
        self.PLATFORM_NAME = platform_name
        self._last_capture_hash: str | None = None

    def _scopes_for_page(self, page: Any) -> list[Any]:
        """Return the top page plus child frames, preserving submit order."""
        scopes = [page]
        try:
            frames = list(getattr(page, "frames", None) or [])
        except Exception:  # noqa: BLE001
            frames = []
        for frame in frames:
            if frame is page:
                continue
            scopes.append(frame)
        return scopes

    def _scope_label(self, scope: Any) -> str:
        try:
            url = getattr(scope, "url", None)
        except Exception:  # noqa: BLE001
            url = None
        if url:
            return str(url)[:180]
        return type(scope).__name__

    async def detect(self, page: Any) -> dict[str, Any] | None:
        await self._capture_sms_dom_if_enabled(page)
        return None

    async def _detect_generic_sms(self, page: Any) -> dict[str, Any] | None:
        """Detect any visible modal/panel that asks for an SMS/code value.

        The detector intentionally uses semantic signals rather than platform
        class names: a visible code input plus nearby verification/SMS text in
        a dialog-like surface. It returns sanitized metadata only.
        """
        script = r"""
        () => {
          const INPUT_HINT = /(验证码|校验码|动态码|短信|sms|code|verification)/i;
          const CONTEXT_HINT = /(短信|验证码|校验码|动态码|手机号|手机|安全验证|身份验证|登录验证|二次验证|验证身份|sms|code|verification|security)/i;
          const STRONG_HINT = /(短信已发送|验证码已发送|校验码已发送|接收短信|安全验证|身份验证|登录验证|二次验证|验证身份|security verification|identity verification)/i;
          const MODAL_HINT = /(modal|dialog|drawer|popup|popover|verify|verification|captcha|sms|phone|验证码|短信)/i;
          const REQUEST_HINT = /(获取|发送|重新发送|重发|send|resend).{0,12}(验证码|校验码|code|sms)|^(获取|发送|重新发送|重发)$/i;
          const SUBMIT_HINT = /^(验证|确认|提交|确定|完成|verify|confirm|submit|done)$/i;
          const PHONE_RE = /(1\d{2}[\d*\s.-]{4,12}\d{2,4})/;
          const PHONE_CONTEXT_RE = /(短信(?:已)?发送(?:至|到)|验证码(?:已)?发送(?:至|到)|发送至|已发送至|手机号|手机号码|手机|phone|mobile)[^\d*]{0,24}(1\d{2}[\d*\s.-]{4,12}\d{2,4})/i;

          function clean(text, limit = 900) {
            return String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);
          }

          function rectOf(el) {
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top, width: r.width, height: r.height };
          }

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
          }

          function isReachable(el) {
            const r = el.getBoundingClientRect();
            const points = [
              [r.left + r.width / 2, r.top + r.height / 2],
              [r.left + Math.min(8, r.width / 2), r.top + r.height / 2],
              [r.right - Math.min(8, r.width / 2), r.top + r.height / 2],
            ];
            for (const [x, y] of points) {
              if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
              const top = document.elementFromPoint(x, y);
              if (top && (top === el || el.contains(top) || top.contains(el))) return true;
            }
            return false;
          }

          function textOf(el) {
            if (!el) return '';
            const attrs = [
              el.getAttribute && el.getAttribute('placeholder'),
              el.getAttribute && el.getAttribute('aria-label'),
              el.getAttribute && el.getAttribute('title'),
              el.getAttribute && el.getAttribute('value'),
              el.innerText,
              el.textContent,
            ];
            return clean(attrs.filter(Boolean).join(' '), 1200);
          }

          function looksLikeSurface(el, text) {
            if (!isVisible(el)) return false;
            const r = rectOf(el);
            const cls = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
            const role = el.getAttribute('role') || '';
            const style = window.getComputedStyle(el);
            const modalLike = role === 'dialog' || el.getAttribute('aria-modal') === 'true'
              || style.position === 'fixed' || MODAL_HINT.test(cls);
            const saneSize = r.width >= 220 && r.height >= 100 && r.width <= window.innerWidth && r.height <= window.innerHeight;
            return saneSize && CONTEXT_HINT.test(text) && (modalLike || STRONG_HINT.test(text));
          }

          function surfaceFor(input) {
            let fallback = null;
            let node = input;
            for (let depth = 0; node && node !== document.body && depth < 9; depth += 1) {
              const text = textOf(node);
              if (looksLikeSurface(node, text)) return { node, text };
              if (!fallback && CONTEXT_HINT.test(text)) fallback = { node, text };
              node = node.parentElement;
            }
            if (fallback && STRONG_HINT.test(fallback.text)) return fallback;
            return null;
          }

          function firstText(root, pattern) {
            const nodes = root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a,div,span');
            for (const el of nodes) {
              if (!isVisible(el)) continue;
              const text = clean(el.innerText || el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '', 80);
              if (text && pattern.test(text)) return text;
            }
            return null;
          }

          function phoneFrom(text) {
            const contextual = text.match(PHONE_CONTEXT_RE);
            if (contextual) return contextual[2];
            const chunks = text.split(/[\n。；;，,]/).map((part) => clean(part, 180));
            for (const chunk of chunks) {
              if (!/(短信|验证码|校验码|发送|手机号|手机|phone|mobile)/i.test(chunk)) continue;
              const matched = chunk.match(PHONE_RE);
              if (matched) return matched[1];
            }
            return null;
          }

          const inputs = Array.from(document.querySelectorAll('input,textarea')).filter((el) => {
            if (!isVisible(el) || !isReachable(el)) return false;
            const text = textOf(el);
            return INPUT_HINT.test(text) || INPUT_HINT.test(textOf(el.parentElement));
          });

          for (const input of inputs) {
            const surface = surfaceFor(input);
            if (!surface) continue;
            const text = surface.text;
            return {
              visible: true,
              phone_raw: phoneFrom(text),
              request_text: firstText(surface.node, REQUEST_HINT),
              submit_text: firstText(surface.node, SUBMIT_HINT),
              root_text: clean(text, 260),
            };
          }
          return null;
        }
        """
        try:
            result = await page.evaluate(script)
        except Exception:  # noqa: BLE001
            log.exception("[interaction %s] generic SMS detect evaluate failed", self.PLATFORM_NAME)
            return None
        return result if isinstance(result, dict) and result.get("visible") else None

    async def _detect_generic_sms_anywhere(self, page: Any) -> dict[str, Any] | None:
        for scope in self._scopes_for_page(page):
            detected = await self._detect_generic_sms(scope)
            if detected:
                return detected
        return None

    async def _is_generic_sms_visible(self, page: Any) -> bool:
        return await self._detect_generic_sms_anywhere(page) is not None

    async def _click_generic_button(self, page: Any, pattern: str) -> bool:
        script = r"""
        (source) => {
          const re = new RegExp(source, 'i');
          const INPUT_HINT = /(验证码|校验码|动态码|短信|sms|code|verification)/i;
          const CONTEXT_HINT = /(短信|验证码|校验码|动态码|手机号|手机|安全验证|身份验证|登录验证|二次验证|验证身份|sms|code|verification|security)/i;
          const STRONG_HINT = /(短信已发送|验证码已发送|校验码已发送|接收短信|安全验证|身份验证|登录验证|二次验证|验证身份|security verification|identity verification)/i;
          const MODAL_HINT = /(modal|dialog|drawer|popup|popover|verify|verification|captcha|sms|phone|验证码|短信)/i;

          function clean(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
          }

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
          }

          function isReachable(el) {
            const r = el.getBoundingClientRect();
            const points = [
              [r.left + r.width / 2, r.top + r.height / 2],
              [r.left + Math.min(8, r.width / 2), r.top + r.height / 2],
              [r.right - Math.min(8, r.width / 2), r.top + r.height / 2],
            ];
            for (const [x, y] of points) {
              if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
              const top = document.elementFromPoint(x, y);
              if (top && (top === el || el.contains(top) || top.contains(el))) return true;
            }
            return false;
          }

          function textOf(el) {
            if (!el) return '';
            return clean([
              el.getAttribute && el.getAttribute('placeholder'),
              el.getAttribute && el.getAttribute('aria-label'),
              el.getAttribute && el.getAttribute('title'),
              el.getAttribute && el.getAttribute('value'),
              el.innerText,
              el.textContent,
            ].filter(Boolean).join(' '));
          }

          function looksLikeSurface(el, text) {
            if (!isVisible(el)) return false;
            const r = el.getBoundingClientRect();
            const cls = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
            const role = el.getAttribute('role') || '';
            const style = window.getComputedStyle(el);
            const modalLike = role === 'dialog' || el.getAttribute('aria-modal') === 'true'
              || style.position === 'fixed' || MODAL_HINT.test(cls);
            const saneSize = r.width >= 220 && r.height >= 100 && r.width <= window.innerWidth && r.height <= window.innerHeight;
            return saneSize && CONTEXT_HINT.test(text) && (modalLike || STRONG_HINT.test(text));
          }

          function surfaceFor(input) {
            let fallback = null;
            let node = input;
            for (let depth = 0; node && node !== document.body && depth < 9; depth += 1) {
              const text = textOf(node);
              if (looksLikeSurface(node, text)) return node;
              if (!fallback && CONTEXT_HINT.test(text)) fallback = node;
              node = node.parentElement;
            }
            return fallback;
          }

          function findSurface() {
            const inputs = Array.from(document.querySelectorAll('input,textarea')).filter((el) => {
              if (!isVisible(el) || !isReachable(el)) return false;
              return INPUT_HINT.test(textOf(el)) || INPUT_HINT.test(textOf(el.parentElement));
            });
            for (const input of inputs) {
              const surface = surfaceFor(input);
              if (surface) return surface;
            }
            return document;
          }

          const root = findSurface();
          const nodes = root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a,div,span');
          for (const el of nodes) {
            if (!isVisible(el) || !isReachable(el)) continue;
            const text = clean(el.innerText || el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '');
            if (!text || !re.test(text)) continue;
            el.click();
            return true;
          }
          return false;
        }
        """
        try:
            return bool(await page.evaluate(script, pattern))
        except Exception:  # noqa: BLE001
            log.exception("[interaction %s] generic button click failed", self.PLATFORM_NAME)
            return False

    async def _click_generic_button_anywhere(self, page: Any, pattern: str) -> bool:
        for scope in self._scopes_for_page(page):
            if await self._click_generic_button(scope, pattern):
                log.info("[interaction %s] clicked generic button in %s", self.PLATFORM_NAME, self._scope_label(scope))
                return True
        return False

    async def _submit_generic_code_in_surface(
        self,
        scope: Any,
        code: str,
        *,
        keyboard_page: Any | None = None,
    ) -> bool:
        marked = await self._mark_generic_code_controls(scope)
        if marked:
            try:
                keyboard_owner = keyboard_page or scope
                field = scope.locator(f'[data-sau-sms-target="{marked["field"]}"]').first
                log.info(
                    "[interaction %s] generic submit target found scope=%s button=%s root=%r",
                    self.PLATFORM_NAME,
                    self._scope_label(scope),
                    bool(marked.get("button")),
                    marked.get("root_text"),
                )
                await field.click(timeout=1_500)
                await keyboard_owner.keyboard.press("ControlOrMeta+A")
                await keyboard_owner.keyboard.press("Backspace")
                await keyboard_owner.keyboard.insert_text(code)
                await keyboard_owner.wait_for_timeout(200)
                clicked = False
                if marked.get("button"):
                    try:
                        button = scope.locator(f'[data-sau-sms-target="{marked["button"]}"]').first
                        await button.click(timeout=1_500)
                        clicked = True
                    except Exception:  # noqa: BLE001
                        log.exception("[interaction %s] marked generic submit button click failed", self.PLATFORM_NAME)
                if not clicked:
                    for _ in range(5):
                        clicked = await self._click_submit_near_marked_field(scope, marked["field"])
                        if clicked:
                            break
                        await keyboard_owner.wait_for_timeout(250)
                return clicked
            except Exception:  # noqa: BLE001
                log.exception("[interaction %s] marked generic submit failed", self.PLATFORM_NAME)

        script = r"""
        ([code, submitPattern]) => {
          const INPUT_HINT = /(验证码|校验码|动态码|短信|sms|code|verification)/i;
          const CONTEXT_HINT = /(短信|验证码|校验码|动态码|手机号|手机|安全验证|身份验证|登录验证|二次验证|验证身份|sms|code|verification|security)/i;
          const STRONG_HINT = /(短信已发送|验证码已发送|校验码已发送|接收短信|安全验证|身份验证|登录验证|二次验证|验证身份|security verification|identity verification)/i;
          const MODAL_HINT = /(modal|dialog|drawer|popup|popover|verify|verification|captcha|sms|phone|验证码|短信)/i;
          const submitRe = new RegExp(submitPattern, 'i');

          function clean(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
          }

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
          }

          function isReachable(el) {
            const r = el.getBoundingClientRect();
            const points = [
              [r.left + r.width / 2, r.top + r.height / 2],
              [r.left + Math.min(8, r.width / 2), r.top + r.height / 2],
              [r.right - Math.min(8, r.width / 2), r.top + r.height / 2],
            ];
            for (const [x, y] of points) {
              if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
              const top = document.elementFromPoint(x, y);
              if (top && (top === el || el.contains(top) || top.contains(el))) return true;
            }
            return false;
          }

          function textOf(el) {
            if (!el) return '';
            return clean([
              el.getAttribute && el.getAttribute('placeholder'),
              el.getAttribute && el.getAttribute('aria-label'),
              el.getAttribute && el.getAttribute('title'),
              el.getAttribute && el.getAttribute('value'),
              el.innerText,
              el.textContent,
            ].filter(Boolean).join(' '));
          }

          function looksLikeSurface(el, text) {
            if (!isVisible(el)) return false;
            const r = el.getBoundingClientRect();
            const cls = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
            const role = el.getAttribute('role') || '';
            const style = window.getComputedStyle(el);
            const modalLike = role === 'dialog' || el.getAttribute('aria-modal') === 'true'
              || style.position === 'fixed' || MODAL_HINT.test(cls);
            const saneSize = r.width >= 220 && r.height >= 100 && r.width <= window.innerWidth && r.height <= window.innerHeight;
            return saneSize && CONTEXT_HINT.test(text) && (modalLike || STRONG_HINT.test(text));
          }

          function surfaceFor(input) {
            let fallback = null;
            let node = input;
            for (let depth = 0; node && node !== document.body && depth < 9; depth += 1) {
              const text = textOf(node);
              if (looksLikeSurface(node, text)) return node;
              if (!fallback && CONTEXT_HINT.test(text)) fallback = node;
              node = node.parentElement;
            }
            return fallback;
          }

          function setNativeValue(el, value) {
            const proto = el instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc && desc.set) desc.set.call(el, value);
            else el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }

          function isDisabled(el) {
            const cls = `${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('class') || ''}`;
            const aria = el.getAttribute('aria-disabled');
            return Boolean(el.disabled) || aria === 'true' || /\b(disabled|disable)\b/i.test(cls);
          }

          function labelOf(el) {
            return clean(el.innerText || el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '');
          }

          function exactSubmitText(text) {
            return /^(验证|确认|提交|确定|完成|verify|confirm|submit|done)$/i.test(text);
          }

          function candidateOwner(el, boundary) {
            let node = el;
            for (let depth = 0; node && node !== document.body && node !== boundary.parentElement && depth < 6; depth += 1) {
              const tag = node.tagName.toLowerCase();
              const cls = `${node.id || ''} ${typeof node.className === 'string' ? node.className : ''}`;
              const role = node.getAttribute('role') || '';
              const r = node.getBoundingClientRect();
              const saneSize = r.width >= 36 && r.height >= 20 && r.width <= 280 && r.height <= 120;
              if (saneSize && (tag === 'button' || tag === 'a' || tag === 'input' || role === 'button' || /(button|btn|verify|submit|confirm|primary)/i.test(cls))) {
                return node;
              }
              node = node.parentElement;
            }
            return el;
          }

          function clickSubmitNear(input) {
            let root = input.parentElement;
            for (let depth = 0; root && root !== document.body && depth < 12; depth += 1) {
              const nodes = root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a,div,span');
              for (const el of nodes) {
                if (!isVisible(el) || !isReachable(el)) continue;
                const text = labelOf(el);
                if (!text || !exactSubmitText(text)) continue;
                const target = candidateOwner(el, root);
                if (isDisabled(target)) continue;
                target.click();
                return true;
              }
              for (const el of nodes) {
                if (!isVisible(el) || !isReachable(el)) continue;
                const text = labelOf(el);
                if (!text || !submitRe.test(text)) continue;
                if (/(验证码|校验码|重新发送|重发|无法验证|选择其他)/.test(text)) continue;
                const target = candidateOwner(el, root);
                if (isDisabled(target)) continue;
                target.click();
                return true;
              }
              root = root.parentElement;
            }
            return false;
          }

          const inputs = Array.from(document.querySelectorAll('input,textarea')).filter((el) => {
            if (!isVisible(el) || !isReachable(el)) return false;
            return INPUT_HINT.test(textOf(el)) || INPUT_HINT.test(textOf(el.parentElement));
          });

          for (const input of inputs) {
            const surface = surfaceFor(input);
            if (!surface) continue;
            input.focus();
            setNativeValue(input, code);

            const buttons = surface.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a,div,span');
            for (const el of buttons) {
              if (!isVisible(el) || !isReachable(el)) continue;
              const text = clean(el.innerText || el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '');
              if (!text || !submitRe.test(text)) continue;
              if (/(验证码|校验码|重新发送|重发|无法验证|选择其他)/.test(text)) continue;
              el.click();
              return true;
            }
            return clickSubmitNear(input);
          }
          return false;
        }
        """
        try:
            submitted = bool(await scope.evaluate(script, [code, self.SUBMIT_BUTTON_RE]))
            if submitted:
                log.info("[interaction %s] JS generic submit used scope=%s", self.PLATFORM_NAME, self._scope_label(scope))
            return submitted
        except Exception:  # noqa: BLE001
            log.exception("[interaction %s] generic surface submit failed", self.PLATFORM_NAME)
            return False

    async def _click_submit_near_marked_field(self, scope: Any, field_id: str) -> bool:
        script = r"""
        ([fieldId, submitPattern]) => {
          const submitRe = new RegExp(submitPattern, 'i');

          function clean(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
          }

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
          }

          function isReachable(el) {
            const r = el.getBoundingClientRect();
            const points = [
              [r.left + r.width / 2, r.top + r.height / 2],
              [r.left + Math.min(8, r.width / 2), r.top + r.height / 2],
              [r.right - Math.min(8, r.width / 2), r.top + r.height / 2],
            ];
            for (const [x, y] of points) {
              if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
              const top = document.elementFromPoint(x, y);
              if (top && (top === el || el.contains(top) || top.contains(el))) return true;
            }
            return false;
          }

          function labelOf(el) {
            return clean(el.innerText || el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '');
          }

          function isDisabled(el) {
            const cls = `${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('class') || ''}`;
            const aria = el.getAttribute('aria-disabled');
            return Boolean(el.disabled) || aria === 'true' || /\b(disabled|disable)\b/i.test(cls);
          }

          function exactSubmitText(text) {
            return /^(验证|确认|提交|确定|完成|verify|confirm|submit|done)$/i.test(text);
          }

          function candidateOwner(el, boundary) {
            let node = el;
            for (let depth = 0; node && node !== document.body && node !== boundary.parentElement && depth < 6; depth += 1) {
              const tag = node.tagName.toLowerCase();
              const cls = `${node.id || ''} ${typeof node.className === 'string' ? node.className : ''}`;
              const role = node.getAttribute('role') || '';
              const r = node.getBoundingClientRect();
              const saneSize = r.width >= 36 && r.height >= 20 && r.width <= 280 && r.height <= 120;
              if (saneSize && (tag === 'button' || tag === 'a' || tag === 'input' || role === 'button' || /(button|btn|verify|submit|confirm|primary)/i.test(cls))) {
                return node;
              }
              node = node.parentElement;
            }
            return el;
          }

          function tryClick(root, allowLoose) {
            const nodes = root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a,div,span');
            for (const el of nodes) {
              if (!isVisible(el) || !isReachable(el)) continue;
              const text = labelOf(el);
              if (!text) continue;
              if (!exactSubmitText(text) && (!allowLoose || !submitRe.test(text))) continue;
              if (/(验证码|校验码|重新发送|重发|无法验证|选择其他)/.test(text)) continue;
              const target = candidateOwner(el, root);
              if (isDisabled(target)) continue;
              target.click();
              return { clicked: true, text, targetText: labelOf(target).slice(0, 80) };
            }
            return { clicked: false };
          }

          const input = document.querySelector(`[data-sau-sms-target="${fieldId}"]`);
          if (!input) return { clicked: false, reason: "field_missing" };
          let root = input.parentElement;
          for (let depth = 0; root && root !== document.body && depth < 12; depth += 1) {
            const exact = tryClick(root, false);
            if (exact.clicked) return exact;
            const loose = tryClick(root, true);
            if (loose.clicked) return loose;
            root = root.parentElement;
          }
          return { clicked: false, reason: "submit_missing" };
        }
        """
        try:
            result = await scope.evaluate(script, [field_id, self.SUBMIT_BUTTON_RE])
        except Exception:  # noqa: BLE001
            log.exception("[interaction %s] generic submit fallback click failed", self.PLATFORM_NAME)
            return False
        clicked = bool(isinstance(result, dict) and result.get("clicked"))
        if clicked:
            log.info(
                "[interaction %s] generic submit fallback clicked scope=%s text=%r target=%r",
                self.PLATFORM_NAME,
                self._scope_label(scope),
                result.get("text") if isinstance(result, dict) else None,
                result.get("targetText") if isinstance(result, dict) else None,
            )
        return clicked

    async def _submit_generic_code_anywhere(self, page: Any, code: str) -> bool:
        for scope in self._scopes_for_page(page):
            submitted = await self._submit_generic_code_in_surface(scope, code, keyboard_page=page)
            if submitted:
                return True
        log.warning("[interaction %s] generic submit found no SMS/code input in page or frames", self.PLATFORM_NAME)
        return False

    async def _mark_generic_code_controls(self, page: Any) -> dict[str, str] | None:
        """Mark the active douyin verification input/button for Playwright typing."""
        script = r"""
        () => {
          const INPUT_HINT = /(验证码|校验码|动态码|短信|sms|code|verification)/i;
          const CONTEXT_HINT = /(短信|验证码|校验码|动态码|手机号|手机|安全验证|身份验证|登录验证|二次验证|验证身份|sms|code|verification|security)/i;
          const STRONG_HINT = /(短信已发送|验证码已发送|校验码已发送|接收短信|安全验证|身份验证|登录验证|二次验证|验证身份|security verification|identity verification)/i;
          const MODAL_HINT = /(modal|dialog|drawer|popup|popover|verify|verification|captcha|sms|phone|验证码|短信)/i;
          const SUBMIT_HINT = /^(验证|确认|提交|确定|完成|verify|confirm|submit|done)$/i;

          function clean(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
          }

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
          }

          function isReachable(el) {
            const r = el.getBoundingClientRect();
            const points = [
              [r.left + r.width / 2, r.top + r.height / 2],
              [r.left + Math.min(8, r.width / 2), r.top + r.height / 2],
              [r.right - Math.min(8, r.width / 2), r.top + r.height / 2],
            ];
            for (const [x, y] of points) {
              if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
              const top = document.elementFromPoint(x, y);
              if (top && (top === el || el.contains(top) || top.contains(el))) return true;
            }
            return false;
          }

          function textOf(el) {
            if (!el) return '';
            return clean([
              el.getAttribute && el.getAttribute('placeholder'),
              el.getAttribute && el.getAttribute('aria-label'),
              el.getAttribute && el.getAttribute('title'),
              el.getAttribute && el.getAttribute('value'),
              el.innerText,
              el.textContent,
            ].filter(Boolean).join(' '));
          }

          function looksLikeSurface(el, text) {
            if (!isVisible(el)) return false;
            const r = el.getBoundingClientRect();
            const cls = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
            const role = el.getAttribute('role') || '';
            const style = window.getComputedStyle(el);
            const modalLike = role === 'dialog' || el.getAttribute('aria-modal') === 'true'
              || style.position === 'fixed' || MODAL_HINT.test(cls);
            const saneSize = r.width >= 220 && r.height >= 100 && r.width <= window.innerWidth && r.height <= window.innerHeight;
            return saneSize && CONTEXT_HINT.test(text) && (modalLike || STRONG_HINT.test(text));
          }

          function surfaceFor(input) {
            let fallback = null;
            let node = input;
            for (let depth = 0; node && node !== document.body && depth < 9; depth += 1) {
              const text = textOf(node);
              if (looksLikeSurface(node, text)) return node;
              if (!fallback && CONTEXT_HINT.test(text)) fallback = node;
              node = node.parentElement;
            }
            return fallback;
          }

          document.querySelectorAll('[data-sau-sms-target]').forEach((el) => {
            el.removeAttribute('data-sau-sms-target');
          });

          const inputs = Array.from(document.querySelectorAll('input,textarea')).filter((el) => {
            if (!isVisible(el) || !isReachable(el)) return false;
            return INPUT_HINT.test(textOf(el)) || INPUT_HINT.test(textOf(el.parentElement));
          });

          for (const input of inputs) {
            const surface = surfaceFor(input);
            if (!surface) continue;
            const fieldId = `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            input.setAttribute('data-sau-sms-target', fieldId);

            let buttonId = null;
            const buttons = surface.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a,div,span');
            for (const el of buttons) {
              if (!isVisible(el) || !isReachable(el)) continue;
              const text = clean(el.innerText || el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '');
              if (!text || !SUBMIT_HINT.test(text)) continue;
              buttonId = `button-${Date.now()}-${Math.random().toString(16).slice(2)}`;
              el.setAttribute('data-sau-sms-target', buttonId);
              break;
            }
            return { field: fieldId, button: buttonId, root_text: clean(textOf(surface)).slice(0, 220) };
          }
          return null;
        }
        """
        try:
            result = await page.evaluate(script)
        except Exception:  # noqa: BLE001
            log.exception("[interaction %s] mark generic code controls failed", self.PLATFORM_NAME)
            return None
        if not isinstance(result, dict) or not result.get("field"):
            return None
        marked = {"field": str(result["field"])}
        if result.get("button"):
            marked["button"] = str(result["button"])
        if result.get("root_text"):
            marked["root_text"] = str(result["root_text"])
        return marked

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

    async def request_sms(self, page: Any) -> bool:
        await self._capture_sms_dom_if_enabled(page)
        log.warning(
            "[interaction %s] request_sms skipped — platform SMS selectors are not wired",
            self.PLATFORM_NAME,
        )
        return False

    async def submit_code(self, page: Any, code: str) -> bool:
        await self._capture_sms_dom_if_enabled(page)
        log.warning(
            "[interaction %s] submit_code skipped — platform SMS selectors are not wired",
            self.PLATFORM_NAME,
        )
        return False

    async def is_cleared(self, page: Any) -> bool:
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

    async def _advance_choice_panel(self, page: Any) -> bool:
        """Click through Douyin's identity-verification method picker.

        The login/bind flow can first show a large "身份验证" panel with rows
        like "接收短信验证码" or "发送短信验证". That is not the code input panel
        yet; clicking the SMS row lands on the panel handled by the existing
        selectors below.
        """
        try:
            title = page.get_by_text("身份验证", exact=True).first
            if not await title.count() or not await title.is_visible(timeout=500):
                return False
        except Exception:  # noqa: BLE001
            return False

        for label in ("接收短信验证码", "发送短信验证", "短信验证码"):
            try:
                target = page.get_by_text(label, exact=True).first
                if await target.count() and await target.is_visible(timeout=500):
                    await target.click(timeout=1_500)
                    await page.wait_for_timeout(600)
                    return True
            except Exception:  # noqa: BLE001
                continue
        return False

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
        if matched:
            return mask_phone(matched.group(0))
        if re.search(r"[\d*]", compact):
            return mask_phone(compact)
        return None

    async def detect(self, page: Any) -> dict[str, Any] | None:
        await self._capture_sms_dom_if_enabled(page)
        if not await self._is_modal_visible(page):
            await self._advance_choice_panel(page)
        specific_visible = await self._is_modal_visible(page)
        if not specific_visible:
            detected = await self._detect_generic_sms_anywhere(page)
            if not detected:
                return None
            can_resend_at = None
            request_text = str(detected.get("request_text") or "")
            cooldown_match = re.search(self.COOLDOWN_RE, request_text, flags=re.IGNORECASE)
            if cooldown_match:
                can_resend_at = now_unix() + int(cooldown_match.group(1))
            return {
                "phone_masked": mask_phone(detected.get("phone_raw")),
                "can_resend_at": can_resend_at,
            }

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
        specific_visible = await self._is_modal_visible(page)
        if not specific_visible:
            return await self._click_generic_button_anywhere(page, self.REQUEST_BUTTON_RE)
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
        specific_visible = await self._is_modal_visible(page)
        if not specific_visible:
            normalized_generic = "".join(ch for ch in code if ch.isdigit())
            if len(normalized_generic) < 4 or len(normalized_generic) > 8:
                return False
            try:
                submitted = await self._submit_generic_code_anywhere(page, normalized_generic)
                if submitted:
                    await page.wait_for_timeout(200)
                return submitted
            except Exception:  # noqa: BLE001
                log.exception("[interaction douyin] generic submit_code failed")
                return False
        normalized = "".join(ch for ch in code if ch.isdigit())
        if len(normalized) != 6:
            return False

        try:
            panel = self._panel(page)
            field = panel.locator(self.CODE_INPUT_SELECTOR).first
            submit = panel.locator(self.SUBMIT_BUTTON_SELECTOR).filter(has_text="验证").first
            await field.click(timeout=1_500)
            await page.keyboard.press("ControlOrMeta+A")
            await page.keyboard.press("Backspace")
            await page.keyboard.insert_text(normalized)
            # The "验证" div drops its disabled class after the 6-digit input settles.
            await page.wait_for_timeout(200)
            await submit.click(timeout=1_500)
            return True
        except Exception:  # noqa: BLE001
            log.exception("[interaction douyin] failed to submit SMS code")
            return False

    async def is_cleared(self, page: Any) -> bool:
        try:
            await page.locator(self.PANEL_SELECTOR).first.wait_for(state="hidden", timeout=2_000)
            return not await self._is_generic_sms_visible(page)
        except Exception:  # noqa: BLE001
            return not await self._is_modal_visible(page) and not await self._is_generic_sms_visible(page)


# Per-platform drivers; only douyin auto-detects and auto-submits SMS today.
# Other platforms stay capture-only until their DOM is verified and wired.
# Keys MUST match SocialPlatform wire form (lowercase) from server.
SMS_DRIVERS: dict[str, SmsInteractionDriver] = {
    "douyin": _DouyinSmsDriver(),
    "shipinhao": _PlaceholderSmsDriver("shipinhao"),
    "kuaishou": _PlaceholderSmsDriver("kuaishou"),
    "xiaohongshu": _PlaceholderSmsDriver("xiaohongshu"),
}


def get_sms_driver(platform: str) -> SmsInteractionDriver | None:
    """Return the SMS driver for a platform, or None if unsupported.

    Caller must skip the watcher path entirely when None. Currently all four
    v1-enabled platforms are registered; douyin has captured selectors plus a
    fallback, while other platforms are capture-only placeholders.
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
    if "*" in digits:
        return digits
    if len(digits) < 7:
        # Too short to mask meaningfully; pass through (still scrubbed of
        # punctuation). Length-7 covers "12345678" worst-case.
        return digits or raw
    head, tail = digits[:3], digits[-4:]
    return f"{head}****{tail}"


def now_unix() -> float:
    """Single time source — easier to monkeypatch in tests."""
    return time.time()
