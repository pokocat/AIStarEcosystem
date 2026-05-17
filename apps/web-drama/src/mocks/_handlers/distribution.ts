// mocks/_handlers/distribution.ts — 分发中心 mock handlers + 发布任务进度模拟。

import type { ID } from "@ai-star-eco/types/_shared";
import type { PublishJob, PublishJobStatus } from "@ai-star-eco/types/publish-job";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { PLATFORMS, CONTENT_ITEMS, PLATFORM_DATA } from "@/mocks/distribution";
import { PUBLISH_JOBS } from "@/mocks/publish-jobs";
import type { CreatePublishJobInput, PlatformConnectionWire } from "@/api/distribution";

const jobStore: PublishJob[] = PUBLISH_JOBS.map((j) => ({ ...j }));
const STATUS_FLOW: PublishJobStatus[] = ["queued", "uploading", "transcoding", "publishing", "live"];

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: `未找到任务 ${id}` }, 404);
}

function startMockProgression(jobId: ID) {
  const tick = () => {
    const idx = jobStore.findIndex((j) => j.id === jobId);
    if (idx < 0) return;
    const cur = jobStore[idx]!;
    if (cur.status === "live" || cur.status === "failed") return;

    const newProgress = Math.min(100, cur.progress + 12 + Math.floor(Math.random() * 6));
    let newStatus: PublishJobStatus = cur.status;
    if (newProgress >= 100) {
      newStatus = "live";
    } else {
      const stageIdx = Math.min(
        STATUS_FLOW.length - 2,
        Math.floor((newProgress / 100) * (STATUS_FLOW.length - 1)),
      );
      newStatus = STATUS_FLOW[stageIdx]!;
    }

    jobStore[idx] = {
      ...cur,
      status: newStatus,
      progress: newProgress,
      updatedAt: new Date().toISOString(),
      externalUrl:
        newStatus === "live" ? `https://${cur.platformName.toLowerCase()}.com/mock/${jobId}` : cur.externalUrl,
    };

    if (newStatus !== "live") setTimeout(tick, 700);
  };
  setTimeout(tick, 700);
}

registerMocks([
  { method: "GET", pattern: "/distribution/platforms", handler: () => mockDelay(PLATFORMS) },
  { method: "GET", pattern: "/distribution/content", handler: () => mockDelay(CONTENT_ITEMS) },
  { method: "GET", pattern: "/distribution/platform-views", handler: () => mockDelay(PLATFORM_DATA) },
  {
    method: "GET",
    pattern: "/distribution/connections",
    handler: () => mockDelay<PlatformConnectionWire[]>([]),
  },
  {
    method: "POST",
    pattern: "/distribution/platforms/:platformId/connection",
    handler: ({ params }) =>
      mockDelay<PlatformConnectionWire>({
        id: `mock-${Date.now()}`,
        tenantId: "mock-tenant",
        userId: "mock-user",
        platformId: params.platformId,
        status: "connected",
        connectedAt: new Date().toISOString(),
      }),
  },
  {
    method: "DELETE",
    pattern: "/distribution/platforms/:platformId/connection",
    handler: () => mockDelay(undefined),
  },
  {
    method: "GET",
    pattern: "/distribution/jobs",
    handler: ({ query }) => {
      const projectId = query?.projectId as ID | undefined;
      const arr = projectId ? jobStore.filter((j) => j.projectId === projectId) : jobStore;
      return mockDelay(arr.map((j) => ({ ...j })));
    },
  },
  {
    method: "GET",
    pattern: "/distribution/jobs/:id",
    handler: ({ params }) => {
      const found = jobStore.find((j) => j.id === params.id);
      return mockDelay(found ? { ...found } : null);
    },
  },
  {
    method: "POST",
    pattern: "/distribution/jobs",
    handler: ({ body }) => {
      const input = body as CreatePublishJobInput;
      const now = new Date().toISOString();
      const job: PublishJob = {
        id: `pj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        projectId: input.projectId,
        platformId: input.platformId,
        platformName: input.platformName,
        status: "queued",
        progress: 0,
        createdAt: now,
        updatedAt: now,
        scheduledAt: input.scheduledAt,
      };
      jobStore.unshift(job);
      startMockProgression(job.id);
      return mockDelay({ ...job });
    },
  },
  {
    method: "POST",
    pattern: "/distribution/jobs/:id/retry",
    handler: ({ params }) => {
      const idx = jobStore.findIndex((j) => j.id === params.id);
      if (idx < 0) throw notFound(params.id);
      jobStore[idx] = {
        ...jobStore[idx]!,
        status: "queued",
        progress: 0,
        errorMessage: undefined,
        updatedAt: new Date().toISOString(),
      };
      startMockProgression(params.id);
      return mockDelay({ ...jobStore[idx]! });
    },
  },
  {
    method: "POST",
    pattern: "/distribution/jobs/:id/cancel",
    handler: ({ params }) => {
      const idx = jobStore.findIndex((j) => j.id === params.id);
      if (idx < 0) throw notFound(params.id);
      jobStore[idx] = {
        ...jobStore[idx]!,
        status: "failed",
        errorMessage: "用户取消",
        updatedAt: new Date().toISOString(),
      };
      return mockDelay({ ...jobStore[idx]! });
    },
  },
]);
