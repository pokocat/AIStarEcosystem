// ─────────────────────────────────────────────────────────────────────────────
// license.ts — License 批次 / License 单码。
// 用于「注册鉴权 + 初始点数发放」，与后端 aep_license_batches / aep_license_keys 对齐。
// 见 product_spec.md §2。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";
import type { SubProduct } from "./account";

// ── License 批次 ──────────────────────────────────────────────────────────────

export type LicenseBatchStatus = "active" | "exhausted" | "revoked" | "expired";

export interface LicenseBatch {
  id: ID;
  batchNo: string;                 // "BATCH-2026-001"
  name: string;                    // 营销名称，如 "种子用户包"
  /** v0.36：老批次的 Tenant 关联；新批次走 sellingChannelId。 */
  issuerTenantId?: ID | null;      // 发放方机构（核销统计入口）
  /** v0.36：销售渠道（指向 SellingChannel）。 */
  sellingChannelId?: ID | null;
  /**
   * v0.36：权益等级。v0.53 起 server 白名单校验 6 档宽集：
   * trial/basic/standard/premium/annual_pro/city_agent（admin UI 当前仅暴露 basic/premium）。
   */
  tier?: string | null;
  /**
   * v0.53：本批次秘钥可激活的子产品。空数组/缺失 = 全站可用；
   * 非空 = 激活仅授予列表中的子产品（如 ["aiavatar"]），优先级高于注册来源策略。
   */
  platforms?: SubProduct[];
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

export type StudioKindWire =
  | "personal_creator"
  | "music_studio"
  | "drama_studio"
  | "variety_studio"
  | "agency"
  | "mcn";

/**
 * POST /auth/activate — 一次事务内创建 AepUser + Studio + Wallet + Membership。
 * "一个账号 = 一个 Studio"：studioName 必填。
 */
export interface LicenseRedeemRequest {
  code: string;                    // 用户输入的明文 License Key
  username: string;                // 新账号用户名
  studioName: string;              // 工作室 / 经纪公司名（必填）
  studioKind?: StudioKindWire;     // 工作室类型（可选，默认 personal_creator）
  displayName?: string;
  email?: string;
  phone?: string;
}

/** 后端返回的激活结果 —— 映射 Map.of("token","user","studio","tenantId")。 */
export interface LicenseRedeemResult {
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  studio: any;
  tenantId: ID;
}
