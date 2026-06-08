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

export interface CreateBatchInput {
  /** 批次名（必填） */
  name: string;
  /** v0.36：销售渠道 ID（与 issuerTenantId 二选一；新批次必填 sellingChannelId） */
  sellingChannelId?: string;
  /** v0.36：老路径保留 —— 与 sellingChannelId 二选一 */
  issuerTenantId?: string;
  /** v0.36：秘钥等级（透传到后端，前端无需派生） */
  tier?: string;
  /**
   * v0.53：本批次秘钥可激活的子应用（music/drama/celebrity/aiavatar）。
   * 缺失/空数组 = 全站可用。非空时激活按批次授权（优先于注册来源策略）。
   */
  platforms?: string[];
  /** 单包初始点数（兑换后一次性入账） */
  initialCreditGrant: number;
  /** 一次铸多少把 key（与 batch 同建；之后还能通过 mintKeys 追加） */
  totalCount: number;
  /** 批次生效起点（ISO 8601；可选） */
  validFrom?: string;
  /** 批次截止时间（ISO 8601；可选） */
  validTo?: string;
}

export interface CreateBatchResult {
  batch: LicenseBatch;
  rawCodes: string[];
}

export async function createBatch(data: CreateBatchInput): Promise<CreateBatchResult> {
  const row = await apiFetch<{
    batch: Omit<LicenseBatch, "tier"> & { tier?: LicenseTier };
    rawCodes?: string[];
  }>("/admin/license-batches", {
    method: "POST",
    body: data,
  });
  return {
    batch: normalizeBatch(row.batch),
    rawCodes: row.rawCodes ?? [],
  };
}

/**
 * v0.31+: 在已有 batch 下追加新铸 N 把 key。**响应一次性返回 raw codes**
 * （server 落库只存 sha256，丢失后不可恢复）。调用方负责安全分发。
 */
export interface MintKeysResult {
  batchId: string;
  count: number;
  rawCodes: string[];
}

export async function mintKeys(batchId: string, count: number): Promise<MintKeysResult> {
  return apiFetch<MintKeysResult>(
    `/admin/license-batches/${encodeURIComponent(batchId)}/mint-keys`,
    {
      method: "POST",
      query: { count },
    },
  );
}

export async function revokeKey(id: string): Promise<void> {
  await apiFetch<void>(`/admin/license-keys/${encodeURIComponent(id)}/revoke`, {
    method: "PUT",
  });
}
