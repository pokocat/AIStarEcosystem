// ─────────────────────────────────────────────────────────────────────────────
// api/distribution.ts — 分发中心 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/distribution.ts 拦截（含发布任务进度模拟）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  DistributionContentItem,
  PlatformViewPoint,
} from "@ai-star-eco/types/distribution";
import type { ID } from "@ai-star-eco/types/_shared";
import type { PublishJob } from "@ai-star-eco/types/publish-job";
import { apiFetch } from "./_client";

export async function listPlatforms(): Promise<Platform[]> {
  return apiFetch<Platform[]>("/distribution/platforms");
}

export async function listDistributionContent(): Promise<DistributionContentItem[]> {
  return apiFetch<DistributionContentItem[]>("/distribution/content");
}

export async function getPlatformViewStats(): Promise<PlatformViewPoint[]> {
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
  return apiFetch<PlatformConnectionWire[]>("/distribution/connections");
}

export async function connectPlatform(
  platformId: ID,
  credentials?: Record<string, unknown>,
): Promise<PlatformConnectionWire> {
  return apiFetch<PlatformConnectionWire>(
    `/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "POST", body: { credentials } },
  );
}

export async function disconnectPlatform(platformId: ID): Promise<void> {
  await apiFetch<void>(
    `/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "DELETE" },
  );
}

// ── 发布任务（PublishJob）─────────────────────────────────────────────────────

export async function listPublishJobs(projectId?: ID): Promise<PublishJob[]> {
  return apiFetch<PublishJob[]>("/distribution/jobs", {
    query: projectId ? { projectId } : undefined,
  });
}

export async function getPublishJob(id: ID): Promise<PublishJob | null> {
  return apiFetch<PublishJob | null>(`/distribution/jobs/${encodeURIComponent(id)}`);
}

export interface CreatePublishJobInput {
  projectId: ID;
  platformId: ID;
  platformName: string;
  scheduledAt?: string;
}

export async function createPublishJob(input: CreatePublishJobInput): Promise<PublishJob> {
  return apiFetch<PublishJob>("/distribution/jobs", { method: "POST", body: input });
}

export async function retryPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/distribution/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

export async function cancelPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/distribution/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
