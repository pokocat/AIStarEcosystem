// ─────────────────────────────────────────────────────────────────────────────
// license.ts — 秘钥批次 / 秘钥单码（License → 秘钥）。
// 用于「注册鉴权 + 初始点数发放」，与后端 aep_license_batches / aep_license_keys 对齐。
// 见 product_spec.md §2。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 秘钥等级（2 档） ──────────────────────────────────────────────────────────
// 兑换后激活出不同类型的初始账户，对应不同的初始点数。
export type LicenseTier = "basic" | "premium";

export interface LicenseTierMeta {
  key: LicenseTier;
  label: string;
  /** 该等级兑换激活出的账户类型（文案） */
  accountLabel: string;
  /** 该等级一次性发放的初始点数 (credits) */
  initialCreditGrant: number;
  /** 简短说明 */
  description: string;
}

/** 平台预设的 2 个秘钥等级 */
export const LICENSE_TIERS: Record<LicenseTier, LicenseTierMeta> = {
  basic: {
    key: "basic",
    label: "基础秘钥",
    accountLabel: "个人创作者账户",
    initialCreditGrant: 1_000,
    description: "面向个人体验用户，激活后登记为个人创作者账户。",
  },
  premium: {
    key: "premium",
    label: "高级秘钥",
    accountLabel: "经纪公司账户",
    initialCreditGrant: 10_000,
    description: "面向机构合作方，激活后登记为经纪公司账户，可创建艺人档案。",
  },
};

// ── 秘钥批次 ──────────────────────────────────────────────────────────────────

export type LicenseBatchStatus = "active" | "exhausted" | "revoked" | "expired";

export interface LicenseBatch {
  id: ID;
  batchNo: string;
  name: string;
  /**
   * v0.36：老批次的 Tenant 关联；新批次走 sellingChannelId，本字段可选保留兼容。
   */
  issuerTenantId?: ID | null;
  /**
   * v0.36：销售渠道（指向 SellingChannel）。新批次必填；老批次 null（由 v0.36 迁移 seeder backfill）。
   */
  sellingChannelId?: ID | null;
  /** 秘钥等级（basic / premium） */
  tier: LicenseTier;
  /** 该批次每个秘钥兑换时一次性入账的点数 (credits) —— 与 tier 对应 */
  initialCreditGrant: number;
  totalCount: number;
  activatedCount: number;
  validFrom: ISODateTime;
  validTo: ISODateTime;
  status: LicenseBatchStatus;
  createdAt: ISODateTime;
}

// ── 秘钥（单码） ──────────────────────────────────────────────────────────────

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
  code: string;                    // 用户输入的明文秘钥
}

export interface LicenseRedeemResult {
  licenseKeyId: ID;
  tenantId: ID;
  tier: LicenseTier;
  creditsGranted: number;
  newTotalBalance: number;
}
