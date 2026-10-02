// mocks/_handlers/distribution.ts — 多平台发布 mock handlers + 发布任务进度模拟。
// 与服务端 DramaDistributionService 同形：取消 → cancelled；只有 failed / cancelled 能重试；
// 模拟推进到 live 时外链是 v.example.com（服务端也是模拟推进，见 /distribution 顶部横幅）。

import type { ID } from "@ai-star-eco/types/_shared";
import type { PublishJob, PublishJobStatus } from "@ai-star-eco/types/publish-job";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { PLATFORMS } from "@/mocks/distribution";
import { PUBLISH_JOBS } from "@/mocks/publish-jobs";
import type { CreatePublishJobInput, PlatformConnectionWire } from "@/api/distribution";

const jobStore: PublishJob[] = PUBLISH_JOBS.map((j) => ({ ...j }));
let seedProgressStarted = false;
const STATUS_FLOW: PublishJobStatus[] = ["queued", "uploading", "transcoding", "publishing", "live"];

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: "找不到这条发布记录" }, 404);
}

function startMockProgression(jobId: ID) {
  const tick = () => {
    const idx = jobStore.findIndex((j) => j.id === jobId);
    if (idx < 0) return;
    const cur = jobStore[idx]!;
    if (cur.status === "live" || cur.status === "failed" || cur.status === "cancelled") return;

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
        newStatus === "live" ? `https://v.example.com/${cur.platformId}/${jobId}` : cur.externalUrl,
    };

    if (newStatus !== "live") setTimeout(tick, 700);
  };
  setTimeout(tick, 700);
}

registerMocks([
  { method: "GET", pattern: "/me/distribution/platforms", handler: () => mockDelay(PLATFORMS) },
  {
    method: "POST",
    pattern: "/me/distribution/platforms/:platformId/connection",
    handler: ({ params }) =>
      mockDelay<PlatformConnectionWire>({
        id: `mock-${Date.now()}`,
        platformId: params.platformId,
        status: "connected",
        connectedAt: new Date().toISOString(),
      }),
  },
  {
    method: "DELETE",
    pattern: "/me/distribution/platforms/:platformId/connection",
    handler: () => mockDelay(undefined),
  },
  {
    method: "GET",
    pattern: "/me/distribution/jobs",
    handler: ({ query }) => {
      // 种子里「处理中 / 排队中」的记录也要往前走（服务端 @Scheduled 会推），否则页面会一直轮询。
      if (!seedProgressStarted) {
        seedProgressStarted = true;
        for (const j of jobStore) {
          if (j.status !== "live" && j.status !== "failed" && j.status !== "cancelled") startMockProgression(j.id);
        }
      }
      const projectId = query?.projectId as ID | undefined;
      const arr = projectId ? jobStore.filter((j) => j.projectId === projectId) : jobStore;
      return mockDelay(arr.map((j) => ({ ...j })));
    },
  },
  {
    method: "GET",
    pattern: "/me/distribution/jobs/:id",
    handler: ({ params }) => {
      const found = jobStore.find((j) => j.id === params.id);
      return mockDelay(found ? { ...found } : null);
    },
  },
  {
    method: "POST",
    pattern: "/me/distribution/jobs",
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
    pattern: "/me/distribution/jobs/:id/retry",
    handler: ({ params }) => {
      const idx = jobStore.findIndex((j) => j.id === params.id);
      if (idx < 0) throw notFound(params.id);
      const st = jobStore[idx]!.status;
      if (st !== "failed" && st !== "cancelled") {
        throw new ApiError({ code: "PUBLISH_JOB_NOT_RETRYABLE", message: "只有发布失败或已取消的记录可以重试" }, 409);
      }
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
    pattern: "/me/distribution/jobs/:id/cancel",
    handler: ({ params }) => {
      const idx = jobStore.findIndex((j) => j.id === params.id);
      if (idx < 0) throw notFound(params.id);
      if (jobStore[idx]!.status === "live") {
        throw new ApiError({ code: "PUBLISH_JOB_ALREADY_LIVE", message: "已经发布的记录不能取消" }, 409);
      }
      jobStore[idx] = {
        ...jobStore[idx]!,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      };
      return mockDelay({ ...jobStore[idx]! });
    },
  },
]);
