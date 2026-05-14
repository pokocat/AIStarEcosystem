// ─────────────────────────────────────────────────────────────────────────────
// mocks/wallet.ts — 当前用户钱包 & 流水样本（web 端）。
// ─────────────────────────────────────────────────────────────────────────────

import type { LedgerEntry, Wallet } from "@ai-star-eco/types/wallet";

/** 当前用户的钱包快照。 */
export const MY_WALLET: Wallet = {
  id: "w-1",
  userId: "u-001",
  totalBalance: 126_400,
  licenseBalance: 50_000,
  rechargeBalance: 58_000,
  giftBalance: 18_400,
  pendingBalance: 16_800,
  createdAt: "2025-09-12T08:10:00Z",
  updatedAt: "2026-05-14T09:00:00Z",
};

/** 当前用户的流水记录。 */
export const MY_LEDGER_ENTRIES: LedgerEntry[] = [
  { id: "le-2001", walletId: "w-1", userId: "u-001", type: "income",   amount:  24_600, balanceAfter: 126_400, description: "《暮色未央》EP01-03 平台分账", referenceType: "song_revenue", referenceId: "drama-d-001-batch-01", createdAt: "2026-05-13T08:00:00Z" },
  { id: "le-2002", walletId: "w-1", userId: "u-001", type: "income",   amount:   8_400, balanceAfter: 101_800, description: "抖音切片广告补贴",             referenceType: "song_revenue", referenceId: "clip-d-001-rain",      createdAt: "2026-05-12T09:20:00Z" },
  { id: "le-2003", walletId: "w-1", userId: "u-001", type: "withdraw", amount: -30_000, balanceAfter:  93_400, description: "提现至尾号 9316",               referenceType: "withdraw",     referenceId: "wd-9316-0510",        createdAt: "2026-05-10T03:15:00Z" },
  { id: "le-2004", walletId: "w-1", userId: "u-001", type: "income",   amount:  42_000, balanceAfter: 123_400, description: "晴山防晒 · 剧情植入尾款",       referenceType: "nft_sale",     referenceId: "brand-qingshan-01",   createdAt: "2026-05-08T10:11:00Z" },
];
