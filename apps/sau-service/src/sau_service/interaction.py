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

MVP status
==========

The DOM selectors for douyin / shipinhao SMS modals are **not yet
captured** — to harvest them we need to trigger a real 风控 (new device +
new IP + repeated upload from the same account). Until then we ship
`_PlaceholderSmsDriver` which always returns "no SMS detected". The
scaffolding is wired all the way through the stack so the day operators
capture the selectors, only this file changes.

To wire a real driver:
  1. Open the platform's upload page in headed chromium.
  2. Trigger 风控 (or load a saved DOM snapshot).
  3. Inspect element on the modal — capture the wrapper, phone-text,
     "获取验证码" button, code input, "确认" button selectors.
  4. Replace `_PlaceholderSmsDriver` for that platform with a real
     subclass; selectors live in class-level constants for review.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Protocol

log = logging.getLogger(__name__)


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

    async def detect(self, page: Any) -> dict[str, Any] | None:  # noqa: ARG002
        # Placeholder: never reports SMS needed. Real implementation should
        # look for the modal wrapper, e.g.:
        #   modal = page.locator("div.semi-modal-wrap").filter(has_text="验证码")
        #   if not await modal.count(): return None
        #   phone_text = await modal.locator(".phone-text").text_content()
        #   return {"phone_masked": _mask(phone_text), "can_resend_at": None}
        return None

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


# Per-platform drivers; swap in real subclasses as selectors are captured.
# Keys MUST match SocialPlatform wire form (lowercase) from server.
SMS_DRIVERS: dict[str, SmsInteractionDriver] = {
    "douyin": _PlaceholderSmsDriver("douyin"),
    "shipinhao": _PlaceholderSmsDriver("shipinhao"),
}


def get_sms_driver(platform: str) -> SmsInteractionDriver | None:
    """Return the SMS driver for a platform, or None if unsupported.

    Caller must skip the watcher path entirely when None — the placeholder
    drivers are themselves listed in SMS_DRIVERS, so a None return means
    "platform not even known to this module" (e.g. kuaishou / xiaohongshu).
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
