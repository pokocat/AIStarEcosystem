// ─────────────────────────────────────────────────────────────────────────────
// api/studios.ts — 工作室管理 API。对应后端 AdminStudioController
// (/api/admin/studios)。列表返回 AdminStudioDto（含 artistCount / songCount /
// totalRevenueCredits / monthlyRevenueCredits 聚合指标），PUT 返回基础 StudioDto。
// ─────────────────────────────────────────────────────────────────────────────

import type { AdminStudio, Studio, StudioStatus } from "@/types/studio";
import type { ID } from "@/types/_shared";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { STUDIOS } from "@/mocks/studios";

export async function listStudios(page = 0, size = 20): Promise<AdminStudio[]> {
  if (USE_MOCK) return mockDelay(STUDIOS);
  return apiFetch<AdminStudio[]>("/admin/studios", {
    query: { page, size },
  });
}

export async function getStudio(id: ID): Promise<AdminStudio> {
  if (USE_MOCK) return mockDelay(STUDIOS.find((s) => s.id === id)!);
  return apiFetch<AdminStudio>(`/admin/studios/${encodeURIComponent(id)}`);
}

/** PUT 更新 — 后端只返回基础 StudioDto（聚合字段需重新 list 拿最新值）。 */
export async function updateStudio(
  id: ID, data: Partial<Studio>
): Promise<Studio> {
  if (USE_MOCK) return mockDelay({ ...STUDIOS.find((s) => s.id === id)!, ...data });
  return apiFetch<Studio>(`/admin/studios/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}

/** 调整 Studio 状态（暂停 / 恢复 / 注销）。 */
export async function setStudioStatus(id: ID, status: StudioStatus): Promise<Studio> {
  return updateStudio(id, { status });
}
