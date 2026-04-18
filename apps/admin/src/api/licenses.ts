// ─────────────────────────────────────────────────────────────────────────────
// api/licenses.ts — License 批次 / 单码管理。对应 AdminLicenseController。
// ─────────────────────────────────────────────────────────────────────────────

import type { LicenseBatch, LicenseKey } from "@/types/license";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { LICENSE_BATCHES, LICENSE_KEYS } from "@/mocks/licenses";

export async function listBatches(page = 0, size = 20): Promise<LicenseBatch[]> {
  if (USE_MOCK) return mockDelay(LICENSE_BATCHES);
  return apiFetch<LicenseBatch[]>("/admin/license-batches", {
    query: { page, size },
  });
}

export async function getBatch(id: string): Promise<LicenseBatch> {
  if (USE_MOCK) return mockDelay(LICENSE_BATCHES.find((b) => b.id === id)!);
  return apiFetch<LicenseBatch>(`/admin/license-batches/${encodeURIComponent(id)}`);
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

export async function createBatch(data: Partial<LicenseBatch>): Promise<LicenseBatch> {
  return apiFetch<LicenseBatch>("/admin/license-batches", {
    method: "POST",
    body: data,
  });
}

export async function revokeKey(id: string): Promise<void> {
  await apiFetch<void>(`/admin/license-keys/${encodeURIComponent(id)}/revoke`, {
    method: "PUT",
  });
}
