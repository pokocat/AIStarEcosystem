// ─────────────────────────────────────────────────────────────────────────────
// mocks/licenses.ts — License 批次 & 单码样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { LicenseBatch, LicenseKey } from "@/types/license";

export const LICENSE_BATCHES: LicenseBatch[] = [
  {
    id: "lb-2026-001",
    batchNo: "BATCH-2026-001",
    name: "2026 Q1 种子用户包",
    issuerTenantId: "t-platform",
    initialCreditGrant: 1_000,
    totalCount: 500,
    activatedCount: 312,
    validFrom: "2026-01-01T00:00:00Z",
    validTo: "2026-06-30T23:59:59Z",
    status: "active",
    createdAt: "2025-12-18T05:00:00Z",
  },
  {
    id: "lb-2026-002",
    batchNo: "BATCH-2026-002",
    name: "星云 MCN 批量发放",
    issuerTenantId: "t-nebula",
    initialCreditGrant: 10_000,
    totalCount: 50,
    activatedCount: 48,
    validFrom: "2026-02-10T00:00:00Z",
    validTo: "2026-12-31T23:59:59Z",
    status: "active",
    createdAt: "2026-02-09T12:00:00Z",
  },
  {
    id: "lb-2026-003",
    batchNo: "BATCH-2026-003",
    name: "春节活动礼包",
    issuerTenantId: "t-platform",
    initialCreditGrant: 2_000,
    totalCount: 2_000,
    activatedCount: 2_000,
    validFrom: "2026-01-15T00:00:00Z",
    validTo: "2026-02-28T23:59:59Z",
    status: "exhausted",
    createdAt: "2026-01-10T09:00:00Z",
  },
  {
    id: "lb-2025-099",
    batchNo: "BATCH-2025-099",
    name: "旧版试用（已撤回）",
    issuerTenantId: "t-platform",
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
  { id: "lk-10031", batchId: "lb-2026-001", maskedCode: "SEED-2K26-A1B2-****", status: "activated", activatedByUserId: "u-001", activatedAt: "2026-01-10T02:30:00Z", createdAt: "2025-12-18T05:00:00Z" },
  { id: "lk-10032", batchId: "lb-2026-001", maskedCode: "SEED-2K26-C3D4-****", status: "activated", activatedByUserId: "u-003", activatedAt: "2026-01-22T12:01:00Z", createdAt: "2025-12-18T05:00:00Z" },
  { id: "lk-10033", batchId: "lb-2026-001", maskedCode: "SEED-2K26-E5F6-****", status: "created",   createdAt: "2025-12-18T05:00:00Z" },
  { id: "lk-10060", batchId: "lb-2026-002", maskedCode: "NEB-MCN1-7788-****",  status: "activated", activatedByUserId: "u-002", activatedAt: "2026-02-11T04:12:00Z", createdAt: "2026-02-09T12:00:00Z" },
  { id: "lk-10088", batchId: "lb-2026-002", maskedCode: "NEB-MCN1-9911-****",  status: "activated", activatedByUserId: "u-005", activatedAt: "2026-02-11T09:20:00Z", createdAt: "2026-02-09T12:00:00Z" },
  { id: "lk-10089", batchId: "lb-2026-002", maskedCode: "NEB-MCN1-4433-****",  status: "created",   createdAt: "2026-02-09T12:00:00Z" },
  { id: "lk-10200", batchId: "lb-2025-099", maskedCode: "OLD-TRY-1234-****",   status: "revoked",   createdAt: "2025-10-25T07:00:00Z" },
  { id: "lk-10201", batchId: "lb-2025-099", maskedCode: "OLD-TRY-5678-****",   status: "expired",   createdAt: "2025-10-25T07:00:00Z", expiresAt: "2025-12-31T23:59:59Z" },
];
