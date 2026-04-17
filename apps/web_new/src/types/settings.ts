// ─────────────────────────────────────────────────────────────────────────────
// settings.ts — 用户设置：分区导航 + 积分包 / 充值历史。
// 已废弃订阅模型（见 product_spec.md §0.1 / §2）。
// 计费仅以 credits 计算；账单视图改为「积分包购买 + 充值记录 + License 兑换」。
// ─────────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import type { ID, ISODate } from "./_shared";

export type SettingsSectionId =
  | "profile"
  | "account"
  | "notification"
  | "appearance"
  | "billing"
  | "data";

export interface SettingsSection {
  id: SettingsSectionId;
  icon: LucideIcon;
  label: string;
}

// ── 积分包（一次性购买点数的售卖单元） ──────────────────────────────────────

export type CreditPackTier = "starter" | "standard" | "pro" | "enterprise";

export interface CreditPack {
  id: ID;
  code: CreditPackTier;
  name: string;                  // "标准包"
  credits: number;               // 该包面值（credits 原始数值）
  priceCents: number;            // 售价（人民币分）
  highlights: string[];          // 营销卖点
  recommended?: boolean;
}

// ── 充值 / License 兑换历史 ──────────────────────────────────────────────────

export type RechargeRecordSource = "credit_pack" | "license_redeem" | "promo_gift";

export interface RechargeRecord {
  id: ID;
  date: ISODate;
  desc: string;                  // 中性描述
  source: RechargeRecordSource;
  /** 入账点数（credits） */
  creditsAdded: number;
  /** 实付金额（人民币分），License 兑换 / 赠送场景为 0 */
  priceCents: number;
}
