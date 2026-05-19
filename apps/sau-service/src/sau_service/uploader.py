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
        # Slice 5 will replace this with calls into the patched
        # social-auto-upload uploader.* modules:
        #   from uploader.douyin_uploader import upload_video
        #   await asyncio.to_thread(upload_video, video_path=..., storage_state_path=rec.state_path, ...)
        rec.status = "failed"
        rec.error_code = "REAL_UPLOAD_NOT_WIRED"
        rec.error_message = "Slice 5 hasn't wired the forked-sau uploader yet"
        await self._push(rec)
