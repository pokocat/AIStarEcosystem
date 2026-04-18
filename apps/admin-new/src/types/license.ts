// ─────────────────────────────────────────────────────────────────────────────
// license.ts — License 批次 / License 单码。
// 用于「注册鉴权 + 初始点数发放」，与后端 aep_license_batches / aep_license_keys 对齐。
// 见 product_spec.md §2。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── License 批次 ──────────────────────────────────────────────────────────────

export type LicenseBatchStatus = "active" | "exhausted" | "revoked" | "expired";

export interface LicenseBatch {
  id: ID;
  batchNo: string;
  name: string;
  issuerTenantId: ID;
  /** 该批次每个 Key 兑换时一次性入账的点数 (credits) */
  initialCreditGrant: number;
  totalCount: number;
  activatedCount: number;
  validFrom: ISODateTime;
  validTo: ISODateTime;
  status: LicenseBatchStatus;
  createdAt: ISODateTime;
}

// ── License 单码 ──────────────────────────────────────────────────────────────

export type LicenseKeyStatus = "created" | "activated" | "expired" | "revoked";

export interface LicenseKey {
  id: ID;
  batchId: ID;
  maskedCode: string;
  status: LicenseKeyStatus;
  activatedByUserId?: ID;
  activatedAt?: ISODateTime;
  expiresAt?: ISODateTime;
  createdAt: ISODateTime;
}
