"""POST /upload + GET /tasks/{id} + POST /tasks/{id}/cancel — sau task management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from ..auth import require_internal_secret
from ..uploader import UploadManager, UploadRequest

router = APIRouter(tags=["upload"], dependencies=[Depends(require_internal_secret)])


class UploadInput(BaseModel):
    jobId: str | None = None
    platform: str
    accountName: str
    videoUrl: str
    title: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    coverUrl: str | None = None
    # 抖音商品挂载 — 仅 douyin 平台消费；其它平台 sau-service 静默忽略。
    productLink: str | None = None
    productTitle: str | None = None
    storageState: dict
    callbackUrl: str
    callbackSecret: str


class UploadResponse(BaseModel):
    taskId: str


class TaskStatusResponse(BaseModel):
    status: str
    progress: int
    externalUrl: str | None = None
    errorCode: str | None = None
    errorMessage: str | None = None


@router.post("/upload", response_model=UploadResponse)
async def submit_upload(payload: UploadInput, request: Request) -> UploadResponse:
    manager: UploadManager = request.app.state.upload_manager
    req = UploadRequest(
        job_id=payload.jobId,
        platform=payload.platform,
        account_name=payload.accountName,
        video_url=payload.videoUrl,
        title=payload.title,
        description=payload.description,
        tags=payload.tags,
        cover_url=payload.coverUrl,
        product_link=payload.productLink,
        product_title=payload.productTitle,
        storage_state=payload.storageState,
        callback_url=payload.callbackUrl,
        callback_secret=payload.callbackSecret,
    )
    task_id = await manager.submit(req)
    return UploadResponse(taskId=task_id)


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task(task_id: str, request: Request) -> TaskStatusResponse:
    manager: UploadManager = request.app.state.upload_manager
    rec = await manager.get(task_id)
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": f"task {task_id} not found"},
        )
    return TaskStatusResponse(
        status=rec.status,
        progress=rec.progress,
        externalUrl=rec.external_url,
        errorCode=rec.error_code,
        errorMessage=rec.error_message,
    )


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, request: Request) -> Response:
    manager: UploadManager = request.app.state.upload_manager
    ok = await manager.cancel(task_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": f"task {task_id} not found"},
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
