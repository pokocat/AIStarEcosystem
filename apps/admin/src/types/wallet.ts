// ─────────────────────────────────────────────────────────────────────────────
// wallet.ts — 个人钱包与点数流水。
// Wallet 1:1 → AepUser；与 apps/web_new/src/types/wallet.ts 对齐。
// 见 product_spec.md §1.3 / §1.4 / §3.4。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 钱包余额（原始整数，单位 credits） ───────────────────────────────────────

export interface Wallet {
  id: ID;
  userId: ID;
  totalBalance: number;
  licenseBalance: number;
  rechargeBalance: number;
  giftBalance: number;
  pendingBalance: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── 点数流水 ──────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | "license_grant"
  | "recharge"
  | "refund"
  | "income"
  | "gift"
  | "spend"
  | "withdraw"
  | "freeze"
  | "unfreeze"
  | "adjust";

export interface LedgerEntry {
  id: ID;
  walletId: ID;
  userId: ID;
  type: LedgerEntryType;
  /** 原始整数；正数=入账，负数=出账 */
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
  createdAt: ISODateTime;
}
