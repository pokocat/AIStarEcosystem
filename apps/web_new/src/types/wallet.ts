// ─────────────────────────────────────────────────────────────────────────────
// wallet.ts — 个人钱包与点数流水。
// Wallet 1:1 → AepUser；与后端 aep_wallets / aep_ledger_entries 对齐。
// 见 product_spec.md §1.3 / §1.4 / §3.4。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 钱包余额（原始整数，单位 credits） ───────────────────────────────────────

export interface Wallet {
  id: ID;
  userId: ID;
  totalBalance: number;        // = licenseBalance + rechargeBalance + giftBalance
  licenseBalance: number;      // License 核销累计入账
  rechargeBalance: number;     // 充值累计入账
  giftBalance: number;         // 平台赠送 / 活动奖励
  pendingBalance: number;      // 结算中（业务收益等待入账）
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── 点数流水 ──────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | "license_grant"        // License 核销时一次性入账
  | "recharge"             // 充值入账
  | "refund"               // 退款入账
  | "income"               // 业务收益入账（NFT 售卖 / 版税 / 打赏 ...）
  | "gift"                 // 平台赠送 / 活动奖励
  | "spend"                // 消费扣减
  | "withdraw"             // 提现扣减
  | "freeze"               // 冻结
  | "unfreeze"             // 解冻
  | "adjust";              // 管理员手动调账

export interface LedgerEntry {
  id: ID;
  walletId: ID;
  userId: ID;
  type: LedgerEntryType;
  amount: number;            // 原始整数；正数=入账，负数=出账
  balanceAfter: number;      // 入账后总余额
  description: string;       // 中性描述，前端可本地化
  referenceId?: string;      // 关联业务实体 id
  referenceType?: string;    // "song_revenue" / "nft_sale" / "license_key" 等
  createdAt: ISODateTime;
}
