"""Upload-side worker pool.

Public surface:
    UploadManager.submit(req) -> task_id
    UploadManager.get(task_id) -> TaskRecord | None
    UploadManager.cancel(task_id) -> bool

In Slice 3 (this commit) the actual upload is faked by MockUploader, which
walks a synthetic progress curve and posts progress callbacks back to
apps/server. The cookie / storage_state passed in by the server is written to
tmpfs and then unlinked when the task finishes — that matches the real
behaviour we'll get once Slice 5 wires the forked sau uploader.

When Slice 5 lands the only file that changes is the body of
`_run_real_upload` — the manager / queue / tmpfs cleanup stays.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from .callback import post_callback
from .interaction import SmsInteractionDriver, get_sms_driver, now_unix

log = logging.getLogger(__name__)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _unix_to_iso(ts: float) -> str:
    """Convert unix timestamp to ISO-8601 with explicit UTC offset."""
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


from contextlib import contextmanager  # noqa: E402 — keep near _hook_chromium_for_page_capture


@contextmanager
def _hook_chromium_for_page_capture(playwright: Any):
    """Yield a `page_provider()` callable that returns the most recent Page
    created by upstream uploader, by monkey-patching playwright.chromium.launch.

    Upstream `DouYinVideo.upload(playwright)` / `TencentVideo.upload(playwright)`
    are atomic — they call `playwright.chromium.launch()`, build a context +
    page locally, and never expose any of them to the caller. We need the
    Page to drive the SMS watcher (detect modal, fill code, click confirm).

    Strategy: wrap chromium.launch so each returned Browser is captured in
    a list. page_provider() walks captured_browsers → contexts → pages and
    returns the first page found. Lazy — returns None until upstream
    actually launches + opens a page.

    Per-task scope: the context manager restores chromium.launch on exit,
    so concurrent uploads each wrap independently without leaking the
    monkey-patch globally.

    Limitation: this is a fragile coupling to upstream's launch pattern.
    If upstream switches to `launch_persistent_context` we miss it. The
    long-term fix is to fork upstream and have `upload()` accept an
    `on_page` callback. See module docstring in interaction.py.
    """
    captured_browsers: list[Any] = []
    chromium = playwright.chromium
    original_launch = chromium.launch

    async def wrapped_launch(*args: Any, **kwargs: Any) -> Any:
        browser = await original_launch(*args, **kwargs)
        captured_browsers.append(browser)
        return browser

    chromium.launch = wrapped_launch  # type: ignore[method-assign]

    def page_provider() -> Any:
        # Newest page wins — accounts for upstream opening a new tab after
        # the initial blank one (common pattern on creator pages).
        for browser in reversed(captured_browsers):
            try:
                contexts = browser.contexts
            except Exception:  # noqa: BLE001 — browser may already be closed
                continue
            for ctx in reversed(list(contexts)):
                try:
                    pages = ctx.pages
                except Exception:  # noqa: BLE001
                    continue
                for page in reversed(list(pages)):
                    if page is not None:
                        return page
        return None

    try:
        yield page_provider
    finally:
        chromium.launch = original_launch  # type: ignore[method-assign]


# Total wall-clock budget for one upstream upload() call (real-mode douyin /
# shipinhao). Upstream's publish-button loop is `while True` with no max
# attempts — if the selector breaks or the platform stalls, it would
# otherwise hang forever, leaving the PublishJob stuck at "uploading" /
# "publishing" on the server side. Capping it forces a clean FAILED so the
# user sees an actionable status.
#
# Total budget *excludes* awaiting_user time (we pause the timeout while
# waiting on the user to enter an SMS code). Otherwise a slow user would
# eat into the platform-interaction budget.
UPLOAD_TIMEOUT_S: float = _env_float("SAU_UPLOAD_TIMEOUT_S", 180.0)

# After this many seconds without upload() returning, assume we've moved
# from "uploading file bytes" to "waiting for the platform's publish button"
# and push status=publishing/progress=80 so the UI reflects the longer wait.
# Upstream is an atomic call so this is best-effort time-based heuristic.
PUBLISHING_AFTER_S: float = _env_float("SAU_UPLOAD_PUBLISHING_AFTER_S", 60.0)

# How long to wait for the user to submit an SMS code (or any
# interaction_response) once we've pushed status=awaiting_user. Exceeded
# → status=failed errorCode=AWAIT_USER_TIMEOUT; the upload coroutine is
# cancelled so no further charges accumulate.
INTERACTION_USER_TIMEOUT_S: float = _env_float("SAU_INTERACTION_USER_TIMEOUT_S", 300.0)

# How often the SMS watcher polls the Playwright Page for a fresh modal.
# Tighter = faster surface to the user; looser = less competition with the
# upstream upload's own page operations. 2s is a comfortable middle.
INTERACTION_POLL_INTERVAL_S: float = _env_float("SAU_INTERACTION_POLL_INTERVAL_S", 2.0)


@dataclass
class UploadRequest:
    job_id: str | None
    platform: str
    account_name: str
    video_url: str
    title: str
    description: str | None
    tags: list[str]
    cover_url: str | None
    storage_state: dict[str, Any]
    callback_url: str
    callback_secret: str
    # 抖音商品挂载（蓝V / 橱窗带货）；非 douyin 平台填了也无效。
    product_link: str | None = None
    product_title: str | None = None


@dataclass
class TaskRecord:
    task_id: str
    request: UploadRequest
    status: str = "queued"
    progress: int = 0
    external_url: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    runner_task: asyncio.Task[Any] | None = None
    state_path: str | None = None
    video_path: str | None = None
    # Current pending interaction (None when not awaiting). Populated by
    # the SMS watcher when it sees the modal; cleared on submit + verified
    # close. Shape mirrors InteractionRequired in packages/types.
    interaction_required: dict[str, Any] | None = None
    # User-submitted response, picked up by the watcher. Set by
    # UploadManager.submit_interaction(); read once and cleared by the
    # watcher after it fills the page.
    interaction_response: dict[str, Any] | None = None
    # Wakes the watcher when interaction_response is set; reset after the
    # watcher consumes it.
    interaction_event: asyncio.Event = field(default_factory=asyncio.Event)


class UploadManager:
    def __init__(self, *, max_concurrency: int, mock_mode: bool, tmpfs_dir: str) -> None:
        self._tasks: dict[str, TaskRecord] = {}
        self._sema = asyncio.Semaphore(max_concurrency)
        self._mock = mock_mode
        self._tmpfs = tmpfs_dir
        self._lock = asyncio.Lock()

    async def submit(self, req: UploadRequest) -> str:
        task_id = uuid.uuid4().hex
        rec = TaskRecord(task_id=task_id, request=req)
        async with self._lock:
            self._tasks[task_id] = rec
        rec.runner_task = asyncio.create_task(self._run(rec))
        return task_id

    async def get(self, task_id: str) -> TaskRecord | None:
        async with self._lock:
            return self._tasks.get(task_id)

    async def cancel(self, task_id: str) -> bool:
        async with self._lock:
            rec = self._tasks.get(task_id)
        if rec is None:
            return False
        rec.cancel_event.set()
        # Wake the SMS watcher too — otherwise a task pausing on awaiting_user
        # would only unblock on INTERACTION_USER_TIMEOUT_S (5min default).
        rec.interaction_event.set()
        return True

    async def submit_interaction(self, task_id: str, response: dict[str, Any]) -> bool:
        """Hand a user-submitted interaction response (e.g. SMS code) to the
        watcher coroutine inside `_run_upstream_upload`.

        Returns False when:
          - task_id unknown
          - task is not currently in awaiting_user state (out of order)
          - task already has a pending response (double-submit)

        The watcher consumes `interaction_response` once and clears it
        before looping back to detect the modal again, so a slow second
        submit overlapping our DOM fill is rejected here rather than
        racing the page.
        """
        async with self._lock:
            rec = self._tasks.get(task_id)
        if rec is None:
            return False
        if rec.interaction_required is None or rec.status != "awaiting_user":
            log.warning(
                "submit_interaction: task_id=%s rejected — not awaiting_user "
                "(status=%s interaction_required=%s)",
                task_id, rec.status, rec.interaction_required is not None,
            )
            return False
        if rec.interaction_response is not None:
            log.warning("submit_interaction: task_id=%s already has pending response", task_id)
            return False
        rec.interaction_response = response
        rec.interaction_event.set()
        return True

    # ── runner ────────────────────────────────────────────────────────
    async def _run(self, rec: TaskRecord) -> None:
        try:
            # Persist cookie + (later) video to tmpfs — these are deleted in finally.
            await self._materialise_tmpfs(rec)
            async with self._sema:
                if rec.cancel_event.is_set():
                    await self._terminate(rec, "cancelled")
                    return
                if self._mock:
                    await self._run_mock_upload(rec)
                else:
                    await self._run_real_upload(rec)
        except asyncio.CancelledError:  # pragma: no cover - shutdown path
            raise
        except Exception as exc:  # noqa: BLE001
            log.exception("upload task crashed task_id=%s", rec.task_id)
            rec.status = "failed"
            rec.error_code = "WORKER_CRASHED"
            rec.error_message = repr(exc)
            await self._push(rec)
        finally:
            self._cleanup_tmpfs(rec)
            rec.finished_at = time.time()

    async def _materialise_tmpfs(self, rec: TaskRecord) -> None:
        os.makedirs(self._tmpfs, exist_ok=True)
        rec.state_path = os.path.join(self._tmpfs, f"{rec.task_id}-state.json")
        with open(rec.state_path, "w", encoding="utf-8") as fh:
            json.dump(rec.request.storage_state, fh)
        # Video download deliberately deferred to the real uploader path —
        # in mock mode we don't need bytes on disk to fake progress.
        rec.video_path = None

    def _cleanup_tmpfs(self, rec: TaskRecord) -> None:
        for p in (rec.state_path, rec.video_path):
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except OSError:
                    log.warning("failed to unlink tmpfs path=%s", p)

    async def _terminate(self, rec: TaskRecord, status: str) -> None:
        rec.status = status
        await self._push(rec)

    async def _push(self, rec: TaskRecord) -> None:
        payload = {
            "externalTaskId": rec.task_id,
            "status": rec.status,
            "progress": rec.progress,
            "externalUrl": rec.external_url,
            "errorCode": rec.error_code,
            "errorMessage": rec.error_message,
        }
        await post_callback(rec.request.callback_url, rec.request.callback_secret, payload)

    # ── mock upload (Slice 3) ─────────────────────────────────────────
    async def _run_mock_upload(self, rec: TaskRecord) -> None:
        # synthetic curve: uploading 0→60, transcoding 60→85, publishing 85→100
        plan = [
            ("uploading", 30),
            ("uploading", 60),
            ("transcoding", 85),
            ("publishing", 95),
            ("live", 100),
        ]
        for status, target_progress in plan:
            if rec.cancel_event.is_set():
                await self._terminate(rec, "cancelled")
                return
            rec.status = status
            rec.progress = target_progress
            if status == "live":
                rec.external_url = (
                    f"https://{rec.request.platform}.example/mock-video/{rec.task_id}"
                )
            await self._push(rec)
            await asyncio.sleep(0.4)

    # ── real upload (Slice 5) ─────────────────────────────────────────
    async def _run_real_upload(self, rec: TaskRecord) -> None:  # pragma: no cover
        """Call into the forked pokocat/social-auto-upload uploaders.

        Imports are function-local so that mock-mode containers (without the
        [real] extra) don't fail at module import.

        v1 implements 抖音 + 视频号 end-to-end; the remaining two v1-enabled
        platforms (kuaishou / xiaohongshu) wire when their respective upload
        selectors are validated against a real account. Until then they
        return a clear NOT_IMPLEMENTED error.
        """
        platform = rec.request.platform.lower()
        rec.status = "uploading"
        rec.progress = 5
        await self._push(rec)

        # Pre-fetch the video to tmpfs so the upstream uploader has a real path.
        video_path = await self._fetch_video_tmpfs(rec)
        rec.video_path = video_path

        # Bridge: upstream code is async-Playwright + reads storage_state from disk.
        # rec.state_path already contains the JSON; pass it through verbatim.
        if platform == "douyin":
            await self._upload_douyin(rec)
        elif platform == "shipinhao":
            await self._upload_shipinhao(rec)
        elif platform in ("kuaishou", "xiaohongshu"):
            rec.status = "failed"
            rec.error_code = "PLATFORM_REAL_NOT_WIRED"
            rec.error_message = f"real-mode for {platform} pending; flip to mock or wait for next slice"
            await self._push(rec)
        else:
            rec.status = "failed"
            rec.error_code = "PLATFORM_NOT_SUPPORTED"
            rec.error_message = f"platform {platform} is not v1-enabled"
            await self._push(rec)

    async def _fetch_video_tmpfs(self, rec: TaskRecord) -> str:
        """Stream the source video into tmpfs_dir/{task_id}.mp4.

        Server passes `video_url` from `PublishJob.videoUrl` which is set by
        MixcutPublishService from frontend's `cdn_url`. CDN driver decides
        whether that's absolute or relative:
          - LocalFakeCdnUploader (dev): set `aep.cdn.public-base-url=http://host:port/cdn`
          - prod OSS / aliyun CDN: always absolute (`https://cdn.example.com/...`)

        Reject relative URLs explicitly — httpx would raise
        `httpcore.UnsupportedProtocol: Request URL is missing an 'http://' ...`
        which used to crash the worker mid-upload.
        """
        import httpx

        url = rec.request.video_url
        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            raise RuntimeError(
                "video_url is not absolute (got %r). "
                "Set AEP_CDN_PUBLIC_BASE_URL=http://localhost:8080/cdn on apps/server, "
                "or run prod with an OSS / CDN domain." % url
            )

        out = os.path.join(self._tmpfs, f"{rec.task_id}.mp4")
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(out, "wb") as fh:
                    async for chunk in resp.aiter_bytes(chunk_size=1 << 16):
                        fh.write(chunk)
        return out

    def _ensure_upstream_conf(self) -> None:
        """Lazy-stub the upstream `conf` module before any uploader import.

        Reads SAU_REAL_LOGIN_HEADLESS from env so headless toggles via .env.dev /
        --headed flag flow through to upstream's chrome launch params.
        BASE_DIR sits inside our tmpfs root so upstream cookie scratch goes
        through the same wipe-on-restart guarantee.
        """
        import os
        from .upstream_conf import ensure_upstream_conf
        headless = os.environ.get("SAU_REAL_LOGIN_HEADLESS", "1").strip().lower() in {"1", "true", "yes", "on"}
        base_dir = os.path.join(self._tmpfs, "sau-upstream")
        ensure_upstream_conf(headless=headless, base_dir=base_dir)

    async def _run_upstream_upload(
        self,
        rec: TaskRecord,
        upload_factory: Callable[[], Awaitable[Any]],
        *,
        platform_label: str,
        page_provider: Callable[[], Any] | None = None,
    ) -> bool:
        """Drive an upstream `video.upload(playwright)` call with timeout +
        cancel-aware race + publishing-phase watchdog + SMS interaction watcher.

        Upstream's publish-button loop in `DouYinVideo.upload()` /
        `TencentVideo.upload()` is `while True` with no max attempts. If the
        platform selector breaks or the publish URL never matches, it loops
        forever spamming "🏃 小人正在冲刺发布视频" — the PublishJob would
        otherwise stay stuck at uploading/publishing on the server side. We
        cap the total wall-clock budget at UPLOAD_TIMEOUT_S; on timeout the
        task is marked FAILED with code=UPLOAD_TIMEOUT.

        We also start a watchdog: after PUBLISHING_AFTER_S the task is
        almost certainly past the "bytes being uploaded" phase and into
        "waiting for the platform to surface the publish button", so we
        push status=publishing/progress=80 to make the UI distinguish the
        two long phases. Upstream is an atomic call so this is a
        time-based heuristic, not an event from the platform.

        page_provider: optional sync callable returning the current
        Playwright Page driven by upload_task (or None when upstream
        hasn't created it yet). Wiring this enables the SMS interaction
        watcher; without it the SMS branch is silently skipped.

        The total budget pauses while rec.status == 'awaiting_user' so a
        slow user typing in the SMS code doesn't eat into the platform
        operation budget. SMS user-wait has its own INTERACTION_USER_TIMEOUT_S.

        Returns True on a clean upstream success; False if we already
        pushed a terminal status (cancelled / failed). On False the caller
        must NOT proceed to push status=live.
        """
        log.info(
            "[upload %s] task_id=%s starting upstream upload(); "
            "timeout=%.0fs publishing_after=%.0fs sms_watcher=%s",
            platform_label, rec.task_id, UPLOAD_TIMEOUT_S, PUBLISHING_AFTER_S,
            "yes" if page_provider else "no",
        )

        upload_task = asyncio.create_task(upload_factory())
        cancel_task = asyncio.create_task(rec.cancel_event.wait())

        async def _publishing_watchdog() -> None:
            try:
                await asyncio.sleep(PUBLISHING_AFTER_S)
            except asyncio.CancelledError:
                return
            if upload_task.done():
                return
            if rec.status == "awaiting_user":
                return  # SMS in progress — don't clobber the awaiting_user state
            log.info(
                "[upload %s] task_id=%s still running after %.0fs — pushing status=publishing/80",
                platform_label, rec.task_id, PUBLISHING_AFTER_S,
            )
            rec.status = "publishing"
            rec.progress = 80
            try:
                await self._push(rec)
            except Exception:  # noqa: BLE001 — callback failure must not kill upload
                log.exception("[upload %s] task_id=%s watchdog push failed", platform_label, rec.task_id)

        watchdog_task = asyncio.create_task(_publishing_watchdog())

        sms_task: asyncio.Task[Any] | None = None
        sms_driver = get_sms_driver(platform_label) if page_provider else None
        if sms_driver is not None and page_provider is not None:
            sms_task = asyncio.create_task(
                self._sms_watcher_loop(rec, page_provider, sms_driver, upload_task, platform_label)
            )

        async def _drain_pending(*tasks: asyncio.Task[Any] | None) -> None:
            for t in tasks:
                if t is None or t.done():
                    continue
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass

        # Sliced wait loop — gives us a chance to pause the deadline when
        # the SMS watcher has switched status to awaiting_user. Plain
        # asyncio.wait(timeout=UPLOAD_TIMEOUT_S) would burn budget even
        # while we're blocked on the user typing 6 digits.
        SLICE_S = 0.5
        deadline = time.monotonic() + UPLOAD_TIMEOUT_S
        timed_out = False
        try:
            while True:
                if upload_task.done() or cancel_task.done():
                    break
                await asyncio.wait(
                    {upload_task, cancel_task},
                    timeout=SLICE_S,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if upload_task.done() or cancel_task.done():
                    break
                if rec.status == "awaiting_user":
                    # Pause the budget — push deadline forward by the slice
                    # we just consumed, leaving net time-spent-uploading
                    # unchanged.
                    deadline += SLICE_S
                elif time.monotonic() >= deadline:
                    timed_out = True
                    break

            if cancel_task.done():
                log.info(
                    "[upload %s] task_id=%s cancel_event received; aborting upstream upload",
                    platform_label, rec.task_id,
                )
                await _drain_pending(upload_task, watchdog_task, sms_task)
                # If SMS watcher already pushed failed/AWAIT_USER_TIMEOUT,
                # don't overwrite with cancelled.
                if rec.error_code != "AWAIT_USER_TIMEOUT":
                    await self._terminate(rec, "cancelled")
                return False

            if timed_out:
                log.warning(
                    "[upload %s] task_id=%s exceeded total budget %.0fs; aborting upstream upload",
                    platform_label, rec.task_id, UPLOAD_TIMEOUT_S,
                )
                await _drain_pending(upload_task, cancel_task, watchdog_task, sms_task)
                rec.status = "failed"
                rec.error_code = "UPLOAD_TIMEOUT"
                rec.error_message = (
                    f"上游{platform_label}上传/发布超过 {UPLOAD_TIMEOUT_S:.0f} 秒未完成；"
                    "多见于平台 selector 失效或视频审核长时间未通过。"
                    "请到对应平台后台确认是否已落草稿，再人工决定是否重新派单。"
                )
                rec.interaction_required = None
                await self._push(rec)
                return False

            # upload_task completed within budget — surface any exception.
            await _drain_pending(cancel_task, watchdog_task, sms_task)
            await upload_task  # re-raises if upstream threw
            log.info("[upload %s] task_id=%s upstream upload() returned cleanly", platform_label, rec.task_id)
            return True
        finally:
            await _drain_pending(upload_task, cancel_task, watchdog_task, sms_task)

    async def _sms_watcher_loop(
        self,
        rec: TaskRecord,
        page_provider: Callable[[], Any],
        driver: SmsInteractionDriver,
        upload_task: asyncio.Task[Any],
        platform_label: str,
    ) -> None:
        """Poll page for SMS modal; shepherd through user submission.

        Lifecycle per detection:
          1. driver.detect() returns a payload → enter awaiting_user, push
             interaction_required to server.
          2. driver.request_sms() auto-clicks the platform's '获取验证码'
             button (best-effort — failure logged but doesn't abort).
          3. asyncio.wait_for(rec.interaction_event, INTERACTION_USER_TIMEOUT_S):
               - on submit: fill code → verify cleared → restore prior status
               - on timeout: set cancel_event + push failed/AWAIT_USER_TIMEOUT
               - on cancel: bail out, main loop handles cancelled
        Continues polling — a single upload may trigger multiple SMS prompts
        (rare but happens with 风控 retry).

        Page is fetched lazily via page_provider() — upstream creates it
        somewhere inside its launch chain so we may not have it on the
        first poll tick.
        """
        prior_status = rec.status
        while not upload_task.done():
            try:
                await asyncio.sleep(INTERACTION_POLL_INTERVAL_S)
            except asyncio.CancelledError:
                return

            if upload_task.done() or rec.cancel_event.is_set():
                return

            page = page_provider()
            if page is None:
                continue  # upstream hasn't surfaced a page yet

            try:
                detected = await driver.detect(page)
            except Exception:  # noqa: BLE001
                log.exception("[interaction %s] task_id=%s detect failed", platform_label, rec.task_id)
                continue
            if not detected:
                # Track the most recent non-awaiting status so we can restore
                # it after the user submits.
                if rec.status != "awaiting_user":
                    prior_status = rec.status
                continue

            log.info(
                "[interaction %s] task_id=%s SMS modal detected phone=%s",
                platform_label, rec.task_id, detected.get("phone_masked"),
            )
            prior_status = rec.status if rec.status != "awaiting_user" else prior_status
            rec.status = "awaiting_user"
            can_resend_at_unix = detected.get("can_resend_at")
            rec.interaction_required = {
                "kind": "sms",
                "prompt": "平台要求输入短信验证码以继续发布。",
                "phone_masked": detected.get("phone_masked"),
                "can_resend_at": _unix_to_iso(can_resend_at_unix) if can_resend_at_unix else None,
                "created_at": _unix_to_iso(now_unix()),
            }
            await self._push(rec)

            # Auto-trigger SMS send (per user decision: watcher fires the
            # '获取验证码' button). Failure is best-effort — user can still
            # manually trigger via platform if our click missed.
            try:
                requested = await driver.request_sms(page)
                log.info(
                    "[interaction %s] task_id=%s auto request_sms returned %s",
                    platform_label, rec.task_id, requested,
                )
            except Exception:  # noqa: BLE001
                log.exception("[interaction %s] task_id=%s request_sms raised", platform_label, rec.task_id)

            # Wait for user submission or timeout
            try:
                await asyncio.wait_for(
                    rec.interaction_event.wait(),
                    timeout=INTERACTION_USER_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                log.warning(
                    "[interaction %s] task_id=%s user did not respond within %.0fs",
                    platform_label, rec.task_id, INTERACTION_USER_TIMEOUT_S,
                )
                rec.cancel_event.set()
                rec.status = "failed"
                rec.error_code = "AWAIT_USER_TIMEOUT"
                rec.error_message = (
                    f"等待用户输入短信验证码超过 {INTERACTION_USER_TIMEOUT_S:.0f} 秒；"
                    "任务已自动取消，请重新派单。"
                )
                rec.interaction_required = None
                await self._push(rec)
                return
            except asyncio.CancelledError:
                return

            response = rec.interaction_response
            rec.interaction_response = None
            rec.interaction_event.clear()

            if rec.cancel_event.is_set():
                return  # main loop will push cancelled

            code = (response or {}).get("code", "").strip() if response else ""
            if not code:
                log.warning(
                    "[interaction %s] task_id=%s empty/missing code in response — re-detecting",
                    platform_label, rec.task_id,
                )
                continue  # loop back; detect will find modal still up

            log.info("[interaction %s] task_id=%s submitting user code", platform_label, rec.task_id)
            try:
                ok = await driver.submit_code(page, code)
            except Exception:  # noqa: BLE001
                log.exception("[interaction %s] task_id=%s submit_code raised", platform_label, rec.task_id)
                ok = False
            if not ok:
                log.warning(
                    "[interaction %s] task_id=%s submit_code returned False — re-detecting",
                    platform_label, rec.task_id,
                )
                continue

            # Verify the modal actually closed; if not, the code was wrong
            # and the platform left the modal up. Loop will re-detect and
            # surface awaiting_user again so user can retry.
            try:
                cleared = await driver.is_cleared(page)
            except Exception:  # noqa: BLE001
                log.exception(
                    "[interaction %s] task_id=%s is_cleared raised — assuming not cleared",
                    platform_label, rec.task_id,
                )
                cleared = False
            if not cleared:
                log.warning(
                    "[interaction %s] task_id=%s modal still up after submit; "
                    "code may have been wrong",
                    platform_label, rec.task_id,
                )
                continue

            log.info(
                "[interaction %s] task_id=%s SMS satisfied, resuming as %s",
                platform_label, rec.task_id, prior_status,
            )
            rec.interaction_required = None
            # Restore the most recent non-awaiting status so progress UI
            # snaps back to what upload was doing.
            rec.status = prior_status if prior_status in ("uploading", "publishing", "transcoding") else "publishing"
            await self._push(rec)
            # Loop continues — another SMS may follow (rare).

    async def _upload_douyin(self, rec: TaskRecord) -> None:
        """Invoke pokocat/social-auto-upload's DouYinVideo end-to-end."""
        # Upstream `uploader/__init__.py` requires a top-level `conf` module
        # (BASE_DIR + chrome flags). pip-installed wheel doesn't ship conf.py,
        # so we synthesize one before the first upstream import.
        self._ensure_upstream_conf()
        from patchright.async_api import async_playwright  # type: ignore[import-not-found]
        from uploader.douyin_uploader.main import DouYinVideo  # type: ignore[import-not-found]

        rec.status = "uploading"
        rec.progress = 20
        await self._push(rec)

        publish_date = 0  # 0 = publish immediately in DouYinVideo's convention
        try:
            async with async_playwright() as playwright:
                if rec.cancel_event.is_set():
                    await self._terminate(rec, "cancelled")
                    return
                # Upstream DouYinVideo kwargs (pinned SHA 721476f7):
                #   title, file_path, tags, publish_date, account_file,
                #   thumbnail_landscape_path=None, productLink="",
                #   productTitle="", desc=None
                # NB: `thumbnail_path` is NOT a valid kwarg; previous code that
                # passed it would TypeError. Cover thumbnail plumbing needs us
                # to fetch the URL to /dev/shm first — TODO once needed.
                ctor_kwargs: dict[str, Any] = {
                    "title": rec.request.title,
                    "file_path": rec.video_path,
                    "tags": rec.request.tags,
                    "publish_date": publish_date,
                    "account_file": rec.state_path,
                }
                if rec.request.description:
                    ctor_kwargs["desc"] = rec.request.description
                if rec.request.product_link:
                    ctor_kwargs["productLink"] = rec.request.product_link
                if rec.request.product_title:
                    ctor_kwargs["productTitle"] = rec.request.product_title
                log.info("[upload douyin] task_id=%s constructing DouYinVideo", rec.task_id)
                video = DouYinVideo(**ctor_kwargs)
                rec.progress = 40
                await self._push(rec)
                with _hook_chromium_for_page_capture(playwright) as page_provider:
                    ok = await self._run_upstream_upload(
                        rec,
                        lambda: video.upload(playwright),
                        platform_label="douyin",
                        page_provider=page_provider,
                    )
                if not ok:
                    return  # _run_upstream_upload already pushed terminal status
            rec.status = "live"
            rec.progress = 100
            rec.external_url = None  # upstream doesn't return URL — keep null
            await self._push(rec)
        except Exception as exc:  # noqa: BLE001
            log.exception("douyin upload failed task_id=%s", rec.task_id)
            rec.status = "failed"
            rec.error_code = "UPLOADER_RAISED"
            rec.error_message = repr(exc)
            await self._push(rec)

    async def _upload_shipinhao(self, rec: TaskRecord) -> None:
        """Invoke pokocat/social-auto-upload's TencentVideo (视频号) uploader.

        Upstream class lives at `uploader.tencent_uploader.main.TencentVideo`
        — the historical name in social-auto-upload because 视频号 ships as
        part of WeChat / Tencent. If the operator's pinned upstream SHA
        renamed it (`ChannelsVideo`, `WechatChannelsVideo`, …) the import
        below will need to follow.

        视频号 has a "作品分类" (category) field that's required for some
        accounts and optional for others. v1 leaves it unset — the upstream
        uploader defaults to "其他" / no-category, which works for accounts
        that haven't been enrolled in 商品橱窗 / 知识付费 categories. If
        operator reports CATEGORY_REQUIRED we'll plumb `tags[0]` → category
        or add an explicit field on UploadRequest.
        """
        self._ensure_upstream_conf()
        from patchright.async_api import async_playwright  # type: ignore[import-not-found]
        try:
            from uploader.tencent_uploader.main import TencentVideo  # type: ignore[import-not-found]
        except ImportError as exc:
            rec.status = "failed"
            rec.error_code = "UPSTREAM_MODULE_MISSING"
            rec.error_message = (
                f"shipinhao upstream class not found ({exc}); "
                "check uploader.tencent_uploader.main path against the pinned SHA"
            )
            await self._push(rec)
            return

        rec.status = "uploading"
        rec.progress = 20
        await self._push(rec)

        publish_date = 0  # 0 = publish immediately, matches DouYinVideo convention
        try:
            async with async_playwright() as playwright:
                if rec.cancel_event.is_set():
                    await self._terminate(rec, "cancelled")
                    return
                # Upstream TencentVideo accepts category / is_draft / desc /
                # thumbnail_path / short_title — productLink doesn't exist on
                # 视频号 (橱窗走小程序跳转，是另一条链路)。Only `desc` is
                # plumbed here; category/short_title/is_draft is a future slice.
                ctor_kwargs: dict[str, Any] = {
                    "title": rec.request.title,
                    "file_path": rec.video_path,
                    "tags": rec.request.tags,
                    "publish_date": publish_date,
                    "account_file": rec.state_path,
                }
                if rec.request.description:
                    ctor_kwargs["desc"] = rec.request.description
                log.info("[upload shipinhao] task_id=%s constructing TencentVideo", rec.task_id)
                video = TencentVideo(**ctor_kwargs)
                rec.progress = 40
                await self._push(rec)
                with _hook_chromium_for_page_capture(playwright) as page_provider:
                    ok = await self._run_upstream_upload(
                        rec,
                        lambda: video.upload(playwright),
                        platform_label="shipinhao",
                        page_provider=page_provider,
                    )
                if not ok:
                    return  # _run_upstream_upload already pushed terminal status
            rec.status = "live"
            rec.progress = 100
            rec.external_url = None  # upstream doesn't return final URL
            await self._push(rec)
        except TypeError as exc:
            # 多半是 TencentVideo 构造参数签名漂了 (例如 category 变必填或重命名)。
            # 单独 catch 一下，给 operator 一个能定位的提示。
            log.exception("shipinhao upload failed (constructor mismatch) task_id=%s", rec.task_id)
            rec.status = "failed"
            rec.error_code = "UPSTREAM_SIGNATURE_MISMATCH"
            rec.error_message = (
                f"TencentVideo signature mismatch ({exc}); "
                "the pinned upstream may require a different constructor"
            )
            await self._push(rec)
        except Exception as exc:  # noqa: BLE001
            log.exception("shipinhao upload failed task_id=%s", rec.task_id)
            rec.status = "failed"
            rec.error_code = "UPLOADER_RAISED"
            rec.error_message = repr(exc)
            await self._push(rec)
