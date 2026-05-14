// ─────────────────────────────────────────────────────────────────────────────
// api/distribution.ts — 分发中心（第三方平台发行）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  DistributionContentItem,
  PlatformViewPoint,
} from "@ai-star-eco/types/distribution";
import type { ID } from "@ai-star-eco/types/_shared";
import type { PublishJob, PublishJobStatus } from "@/types/publish-job";
import { PLATFORMS, CONTENT_ITEMS, PLATFORM_DATA } from "@/mocks/distribution";
import { PUBLISH_JOBS } from "@/mocks/publish-jobs";
import { apiFetch, USE_MOCK, mockDelay, clientError } from "./_client";

const jobStore: PublishJob[] = PUBLISH_JOBS.map((j) => ({ ...j }));

// status 流转：queued -> uploading -> transcoding -> publishing -> live
const STATUS_FLOW: PublishJobStatus[] = ["queued", "uploading", "transcoding", "publishing", "live"];

export async function listPlatforms(): Promise<Platform[]> {
  if (USE_MOCK) return mockDelay(PLATFORMS);
  return apiFetch<Platform[]>("/distribution/platforms");
}

export async function listDistributionContent(): Promise<DistributionContentItem[]> {
  if (USE_MOCK) return mockDelay(CONTENT_ITEMS);
  return apiFetch<DistributionContentItem[]>("/distribution/content");
}

export async function getPlatformViewStats(): Promise<PlatformViewPoint[]> {
  if (USE_MOCK) return mockDelay(PLATFORM_DATA);
  return apiFetch<PlatformViewPoint[]>("/distribution/platform-views");
}

export interface PlatformConnectionWire {
  id: ID;
  tenantId: ID;
  userId: ID;
  platformId: ID;
  status: "pending" | "connected" | "failed" | "disconnected";
  connectedAt: string | null;
}

export async function listConnections(): Promise<PlatformConnectionWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<PlatformConnectionWire[]>("/distribution/connections");
}

export async function connectPlatform(
  platformId: ID,
  credentials?: Record<string, unknown>,
): Promise<PlatformConnectionWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      tenantId: "mock-tenant",
      userId: "mock-user",
      platformId,
      status: "connected",
      connectedAt: new Date().toISOString(),
    });
  }
  return apiFetch<PlatformConnectionWire>(
    `/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "POST", body: { credentials } },
  );
}

export async function disconnectPlatform(platformId: ID): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(
    `/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "DELETE" },
  );
}

// ── 发布任务（PublishJob）─────────────────────────────────────────────────────

export async function listPublishJobs(projectId?: ID): Promise<PublishJob[]> {
  if (USE_MOCK) {
    const arr = projectId ? jobStore.filter((j) => j.projectId === projectId) : jobStore;
    return mockDelay(arr.map((j) => ({ ...j })));
  }
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch<PublishJob[]>(`/distribution/jobs${qs}`);
}

export async function getPublishJob(id: ID): Promise<PublishJob | null> {
  if (USE_MOCK) {
    const found = jobStore.find((j) => j.id === id);
    return mockDelay(found ? { ...found } : null);
  }
  return apiFetch<PublishJob | null>(`/distribution/jobs/${encodeURIComponent(id)}`);
}

export interface CreatePublishJobInput {
  projectId: ID;
  platformId: ID;
  platformName: string;
  scheduledAt?: string;
}

/**
 * 创建发布任务。Mock 端会立刻把状态置 queued，并启动一个轻量定时器
 * 每 700ms 把进度 +12% 并按 STATUS_FLOW 推进；可以通过 pollPublishJob 拉到实时状态。
 */
export async function createPublishJob(input: CreatePublishJobInput): Promise<PublishJob> {
  if (USE_MOCK) {
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
  }
  return apiFetch<PublishJob>("/distribution/jobs", { method: "POST", body: input });
}

function startMockProgression(jobId: ID) {
  const tick = () => {
    const idx = jobStore.findIndex((j) => j.id === jobId);
    if (idx < 0) return;
    const cur = jobStore[idx]!;
    if (cur.status === "live" || cur.status === "failed") return;

    const newProgress = Math.min(100, cur.progress + 12 + Math.floor(Math.random() * 6));
    let newStatus: PublishJobStatus = cur.status;
    // 推进 status
    if (newProgress >= 100) {
      newStatus = "live";
    } else {
      const stageIdx = Math.min(STATUS_FLOW.length - 2, Math.floor((newProgress / 100) * (STATUS_FLOW.length - 1)));
      newStatus = STATUS_FLOW[stageIdx]!;
    }

    jobStore[idx] = {
      ...cur,
      status: newStatus,
      progress: newProgress,
      updatedAt: new Date().toISOString(),
      externalUrl: newStatus === "live" ? `https://${cur.platformName.toLowerCase()}.com/mock/${jobId}` : cur.externalUrl,
    };

    if (newStatus !== "live") {
      setTimeout(tick, 700);
    }
  };
  setTimeout(tick, 700);
}

export async function retryPublishJob(id: ID): Promise<PublishJob> {
  if (USE_MOCK) {
    const idx = jobStore.findIndex((j) => j.id === id);
    if (idx < 0) throw clientError(`未找到任务 ${id}`, 404, "drama.not_found");
    jobStore[idx] = { ...jobStore[idx]!, status: "queued", progress: 0, errorMessage: undefined, updatedAt: new Date().toISOString() };
    startMockProgression(id);
    return mockDelay({ ...jobStore[idx]! });
  }
  return apiFetch<PublishJob>(`/distribution/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

export async function cancelPublishJob(id: ID): Promise<PublishJob> {
  if (USE_MOCK) {
    const idx = jobStore.findIndex((j) => j.id === id);
    if (idx < 0) throw clientError(`未找到任务 ${id}`, 404, "drama.not_found");
    jobStore[idx] = { ...jobStore[idx]!, status: "failed", errorMessage: "用户取消", updatedAt: new Date().toISOString() };
    return mockDelay({ ...jobStore[idx]! });
  }
  return apiFetch<PublishJob>(`/distribution/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
