// ─────────────────────────────────────────────────────────────────────────────
// mocks/licenses.ts — 秘钥批次 & 单码样本。
// 初始化 2 个等级：基础秘钥（1k credits 个人创作者）+ 高级秘钥（10k credits 经纪公司）。
// ─────────────────────────────────────────────────────────────────────────────

import { LICENSE_TIERS, type LicenseBatch, type LicenseKey } from "@/types/license";

export const LICENSE_BATCHES: LicenseBatch[] = [
  {
    id: "lb-2026-basic",
    batchNo: "BATCH-2026-BASIC",
    name: "2026 基础秘钥池（个人创作者）",
    issuerTenantId: "t-platform",
    tier: "basic",
    initialCreditGrant: LICENSE_TIERS.basic.initialCreditGrant,
    totalCount: 500,
    activatedCount: 312,
    validFrom: "2026-01-01T00:00:00Z",
    validTo: "2026-12-31T23:59:59Z",
    status: "active",
    createdAt: "2025-12-18T05:00:00Z",
  },
  {
    id: "lb-2026-premium",
    batchNo: "BATCH-2026-PREMIUM",
    name: "2026 高级秘钥池（经纪公司）",
    issuerTenantId: "t-platform",
    tier: "premium",
    initialCreditGrant: LICENSE_TIERS.premium.initialCreditGrant,
    totalCount: 50,
    activatedCount: 48,
    validFrom: "2026-02-01T00:00:00Z",
    validTo: "2026-12-31T23:59:59Z",
    status: "active",
    createdAt: "2026-02-09T12:00:00Z",
  },
  {
    id: "lb-2025-099",
    batchNo: "BATCH-2025-099",
    name: "旧版试用（已撤回）",
    issuerTenantId: "t-platform",
    tier: "basic",
    initialCreditGrant: 500,
    totalCount: 100,
    activatedCount: 12,
    validFrom: "2025-11-01T00:00:00Z",
    validTo: "2025-12-31T23:59:59Z",
    status: "revoked",
    createdAt: "2025-10-25T07:00:00Z",
  },
];

export const LICENSE_KEYS: LicenseKey[] = [
  { id: "lk-10031", batchId: "lb-2026-basic",   maskedCode: "BAS-2K26-A1B2-****", status: "activated", activatedByUserId: "u-001", activatedAt: "2026-01-10T02:30:00Z", createdAt: "2025-12-18T05:00:00Z" },
  { id: "lk-10032", batchId: "lb-2026-basic",   maskedCode: "BAS-2K26-C3D4-****", status: "activated", activatedByUserId: "u-003", activatedAt: "2026-01-22T12:01:00Z", createdAt: "2025-12-18T05:00:00Z" },
  { id: "lk-10033", batchId: "lb-2026-basic",   maskedCode: "BAS-2K26-E5F6-****", status: "created",   createdAt: "2025-12-18T05:00:00Z" },
  { id: "lk-10060", batchId: "lb-2026-premium", maskedCode: "PRO-MCN1-7788-****", status: "activated", activatedByUserId: "u-002", activatedAt: "2026-02-11T04:12:00Z", createdAt: "2026-02-09T12:00:00Z" },
  { id: "lk-10088", batchId: "lb-2026-premium", maskedCode: "PRO-MCN1-9911-****", status: "activated", activatedByUserId: "u-005", activatedAt: "2026-02-11T09:20:00Z", createdAt: "2026-02-09T12:00:00Z" },
  { id: "lk-10089", batchId: "lb-2026-premium", maskedCode: "PRO-MCN1-4433-****", status: "created",   createdAt: "2026-02-09T12:00:00Z" },
  { id: "lk-10200", batchId: "lb-2025-099",     maskedCode: "OLD-TRY-1234-****",  status: "revoked",   createdAt: "2025-10-25T07:00:00Z" },
  { id: "lk-10201", batchId: "lb-2025-099",     maskedCode: "OLD-TRY-5678-****",  status: "expired",   createdAt: "2025-10-25T07:00:00Z", expiresAt: "2025-12-31T23:59:59Z" },
];
