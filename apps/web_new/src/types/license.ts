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
  batchNo: string;                 // "BATCH-2026-001"
  name: string;                    // 营销名称，如 "种子用户包"
  issuerTenantId: ID;              // 发放方机构（核销统计入口）
  initialCreditGrant: number;      // 该批次每个 Key 兑换时一次性入账的点数 (credits)
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
  maskedCode: string;              // "XXXX-XXXX-****-****" 仅展示用
  status: LicenseKeyStatus;
  activatedByUserId?: ID;
  activatedAt?: ISODateTime;
  expiresAt?: ISODateTime;
  createdAt: ISODateTime;
}

// ── 兑换接口入参 / 出参 ────────────────────────────────────────────────────────

export interface LicenseRedeemRequest {
  code: string;                    // 用户输入的明文 License Key
}

export interface LicenseRedeemResult {
  licenseKeyId: ID;
  tenantId: ID;
  creditsGranted: number;
  newTotalBalance: number;
}
