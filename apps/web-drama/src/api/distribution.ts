// ─────────────────────────────────────────────────────────────────────────────
// api/distribution.ts — 分发中心 API（network-only）。
// v0.65：真后端落地 → /api/me/distribution/**（DramaDistributionController，
// 平台目录 + 连接 + 发布任务状态机，@Scheduled 服务端推进）。
// USE_MOCK 模式由 src/mocks/_handlers/distribution.ts 拦截（含发布任务进度模拟）。
// 注：content / platform-views / connections 三个无人消费的旧函数已删（v0.65 清债）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Platform } from "@ai-star-eco/types/distribution";
import type { ID } from "@ai-star-eco/types/_shared";
import type { PublishJob } from "@ai-star-eco/types/publish-job";
import { apiFetch } from "./_client";

export async function listPlatforms(): Promise<Platform[]> {
  return apiFetch<Platform[]>("/me/distribution/platforms");
}

export interface PlatformConnectionWire {
  id: ID;
  platformId: ID;
  platformName?: string;
  status: "pending" | "connected" | "failed" | "disconnected";
  connectedAt: string | null;
}

export async function connectPlatform(
  platformId: ID,
  credentials?: Record<string, unknown>,
): Promise<PlatformConnectionWire> {
  return apiFetch<PlatformConnectionWire>(
    `/me/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "POST", body: { credentials } },
  );
}

export async function disconnectPlatform(platformId: ID): Promise<void> {
  await apiFetch<void>(
    `/me/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "DELETE" },
  );
}

// ── 发布任务（PublishJob）─────────────────────────────────────────────────────

export async function listPublishJobs(projectId?: ID): Promise<PublishJob[]> {
  return apiFetch<PublishJob[]>("/me/distribution/jobs", {
    query: projectId ? { projectId } : undefined,
  });
}

export interface CreatePublishJobInput {
  projectId: ID;
  platformId: ID;
  platformName: string;
  scheduledAt?: string;
}

export async function createPublishJob(input: CreatePublishJobInput): Promise<PublishJob> {
  return apiFetch<PublishJob>("/me/distribution/jobs", { method: "POST", body: input });
}

export async function retryPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/distribution/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

export async function cancelPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/distribution/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
