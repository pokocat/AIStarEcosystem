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
from typing import Any

from .callback import post_callback

log = logging.getLogger(__name__)


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
                video = DouYinVideo(**ctor_kwargs)
                rec.progress = 40
                await self._push(rec)
                await video.upload(playwright)
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
                video = TencentVideo(**ctor_kwargs)
                rec.progress = 40
                await self._push(rec)
                await video.upload(playwright)
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
