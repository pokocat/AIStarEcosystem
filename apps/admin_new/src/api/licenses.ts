// ─────────────────────────────────────────────────────────────────────────────
// api/licenses.ts — License 批次 / 单码管理。对应 AdminLicenseController
// (/api/admin/license-batches, /api/admin/license-keys)。
// 注：后端 LicenseBatchDto 没有 tier 字段，前端按 initialCreditGrant 派生
// (>= 10000 → premium, 否则 basic)。与 LICENSE_TIERS 的定义保持一致。
// ─────────────────────────────────────────────────────────────────────────────

import type { LicenseBatch, LicenseKey, LicenseTier } from "@/types/license";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { LICENSE_BATCHES, LICENSE_KEYS } from "@/mocks/licenses";

/** 根据单包点数派生 tier（basic=1000, premium=10000）。 */
export function deriveTier(initialCreditGrant: number): LicenseTier {
  return initialCreditGrant >= 10_000 ? "premium" : "basic";
}

function normalizeBatch(b: Omit<LicenseBatch, "tier"> & { tier?: LicenseTier }): LicenseBatch {
  return { ...b, tier: b.tier ?? deriveTier(b.initialCreditGrant) } as LicenseBatch;
}

export async function listBatches(page = 0, size = 20): Promise<LicenseBatch[]> {
  if (USE_MOCK) return mockDelay(LICENSE_BATCHES);
  const rows = await apiFetch<Omit<LicenseBatch, "tier">[]>("/admin/license-batches", {
    query: { page, size },
  });
  return rows.map(normalizeBatch);
}

export async function getBatch(id: string): Promise<LicenseBatch> {
  if (USE_MOCK) return mockDelay(LICENSE_BATCHES.find((b) => b.id === id)!);
  const row = await apiFetch<Omit<LicenseBatch, "tier">>(
    `/admin/license-batches/${encodeURIComponent(id)}`
  );
  return normalizeBatch(row);
}

export async function listKeysByBatch(
  batchId: string, page = 0, size = 20, status?: string
): Promise<LicenseKey[]> {
  if (USE_MOCK) return mockDelay(LICENSE_KEYS.filter((k) => k.batchId === batchId));
  return apiFetch<LicenseKey[]>(
    `/admin/license-batches/${encodeURIComponent(batchId)}/keys`,
    { query: { page, size, status } }
  );
}

export async function listKeys(
  batchId?: string, page = 0, size = 200, status?: string
): Promise<LicenseKey[]> {
  if (USE_MOCK) return mockDelay(batchId ? LICENSE_KEYS.filter((k) => k.batchId === batchId) : LICENSE_KEYS);
  return apiFetch<LicenseKey[]>("/admin/license-keys", {
    query: { batchId, page, size, status },
  });
}

export async function createBatch(data: Partial<LicenseBatch>): Promise<LicenseBatch> {
  const row = await apiFetch<Omit<LicenseBatch, "tier">>("/admin/license-batches", {
    method: "POST",
    body: data,
  });
  return normalizeBatch(row);
}

export async function revokeKey(id: string): Promise<void> {
  await apiFetch<void>(`/admin/license-keys/${encodeURIComponent(id)}/revoke`, {
    method: "PUT",
  });
}
