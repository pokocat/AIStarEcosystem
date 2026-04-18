// ─────────────────────────────────────────────────────────────────────────────
// api/studios.ts — 工作室管理 API。对应 AdminStudioController。
// ─────────────────────────────────────────────────────────────────────────────

import type { AdminStudio } from "@/types/studio";
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

export async function updateStudio(
  id: ID, data: Partial<AdminStudio>
): Promise<AdminStudio> {
  if (USE_MOCK) return mockDelay({ ...STUDIOS.find((s) => s.id === id)!, ...data });
  return apiFetch<AdminStudio>(`/admin/studios/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}
