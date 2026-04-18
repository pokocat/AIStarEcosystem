// ─────────────────────────────────────────────────────────────────────────────
// mocks/wallet.ts — 当前用户钱包 & 流水样本（web 端）。
// ─────────────────────────────────────────────────────────────────────────────

import type { LedgerEntry, Wallet } from "@/types/wallet";

/** 当前用户的钱包快照。 */
export const MY_WALLET: Wallet = {
  id: "w-1",
  userId: "u-001",
  totalBalance: 420_800,
  licenseBalance: 10_000,
  rechargeBalance: 300_000,
  giftBalance: 110_800,
  pendingBalance: 12_400,
  createdAt: "2025-09-12T08:10:00Z",
  updatedAt: "2026-04-17T02:18:00Z",
};

/** 当前用户的流水记录。 */
export const MY_LEDGER_ENTRIES: LedgerEntry[] = [
  { id: "le-2001", walletId: "w-1", userId: "u-001", type: "income",   amount:   8_200, balanceAfter: 420_800, description: "Spotify 版税结算",     referenceType: "song_revenue", referenceId: "song-102",     createdAt: "2026-04-14T08:00:00Z" },
  { id: "le-2002", walletId: "w-1", userId: "u-001", type: "withdraw", amount: -20_000, balanceAfter: 412_600, description: "提现至银行卡",         referenceType: "withdraw",     referenceId: "wd-44",        createdAt: "2026-04-12T03:15:00Z" },
  { id: "le-2003", walletId: "w-1", userId: "u-001", type: "income",   amount:   4_800, balanceAfter: 432_600, description: "NFT #287 售出",        referenceType: "nft_sale",     referenceId: "nft-287",      createdAt: "2026-04-10T10:11:00Z" },
  { id: "le-2011", walletId: "w-1", userId: "u-001", type: "adjust",   amount:     500, balanceAfter: 433_100, description: "人工调账（客服补偿）", referenceType: "adjust",       referenceId: "ticket-9981",  createdAt: "2026-04-11T14:20:00Z" },
];
