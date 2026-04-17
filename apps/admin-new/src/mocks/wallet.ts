// ─────────────────────────────────────────────────────────────────────────────
// mocks/wallet.ts — Wallet 快照 + LedgerEntry 流水样本（admin 视图）。
// ─────────────────────────────────────────────────────────────────────────────

import type { LedgerEntry, Wallet } from "@/types/wallet";

export const WALLETS: Wallet[] = [
  { id: "w-1", userId: "u-001", totalBalance: 420_800, licenseBalance: 10_000,  rechargeBalance: 300_000, giftBalance: 110_800, pendingBalance: 12_400, createdAt: "2025-09-12T08:10:00Z", updatedAt: "2026-04-17T02:18:00Z" },
  { id: "w-2", userId: "u-002", totalBalance: 612_300, licenseBalance: 10_000,  rechargeBalance: 580_000, giftBalance:  22_300, pendingBalance: 48_200, createdAt: "2025-11-02T03:40:00Z", updatedAt: "2026-04-16T09:20:00Z" },
  { id: "w-3", userId: "u-003", totalBalance:   6_320, licenseBalance:  1_000,  rechargeBalance:   5_000, giftBalance:     320, pendingBalance:      0, createdAt: "2026-01-22T12:01:00Z", updatedAt: "2026-04-15T18:44:00Z" },
  { id: "w-4", userId: "u-004", totalBalance:  85_000, licenseBalance:      0,  rechargeBalance:  85_000, giftBalance:       0, pendingBalance:      0, createdAt: "2025-07-05T02:00:00Z", updatedAt: "2026-03-29T10:15:00Z" },
  { id: "w-5", userId: "u-005", totalBalance:  18_200, licenseBalance: 10_000,  rechargeBalance:   8_000, giftBalance:     200, pendingBalance:      0, createdAt: "2026-02-11T09:20:00Z", updatedAt: "2026-04-14T03:55:00Z" },
];

export const LEDGER_ENTRIES: LedgerEntry[] = [
  { id: "le-2001", walletId: "w-1", userId: "u-001", type: "income",        amount:   8_200, balanceAfter: 420_800, description: "Spotify 版税结算",       referenceType: "song_revenue", referenceId: "song-102",       createdAt: "2026-04-14T08:00:00Z" },
  { id: "le-2002", walletId: "w-1", userId: "u-001", type: "withdraw",      amount: -20_000, balanceAfter: 412_600, description: "提现至银行卡",           referenceType: "withdraw",     referenceId: "wd-44",          createdAt: "2026-04-12T03:15:00Z" },
  { id: "le-2003", walletId: "w-1", userId: "u-001", type: "income",        amount:   4_800, balanceAfter: 432_600, description: "NFT #287 售出",          referenceType: "nft_sale",     referenceId: "nft-287",        createdAt: "2026-04-10T10:11:00Z" },
  { id: "le-2004", walletId: "w-2", userId: "u-002", type: "income",        amount:  35_000, balanceAfter: 612_300, description: "品牌代言 · 某科技",      referenceType: "endorsement",  referenceId: "ads-17",         createdAt: "2026-04-08T06:40:00Z" },
  { id: "le-2005", walletId: "w-2", userId: "u-002", type: "income",        amount:   3_200, balanceAfter: 577_300, description: "YouTube Ad 分成",        referenceType: "song_revenue", referenceId: "song-090",       createdAt: "2026-04-05T01:50:00Z" },
  { id: "le-2006", walletId: "w-3", userId: "u-003", type: "license_grant", amount:   1_000, balanceAfter:   1_000, description: "License 核销发放",       referenceType: "license_key",  referenceId: "lk-10032",       createdAt: "2026-01-22T12:01:00Z" },
  { id: "le-2007", walletId: "w-3", userId: "u-003", type: "recharge",      amount:   5_000, balanceAfter:   6_000, description: "入门包充值",             referenceType: "credit_pack",  referenceId: "pack-starter",   createdAt: "2026-02-15T05:20:00Z" },
  { id: "le-2008", walletId: "w-3", userId: "u-003", type: "gift",          amount:     320, balanceAfter:   6_320, description: "活动奖励",               referenceType: "promo",        referenceId: "promo-cny-2026", createdAt: "2026-02-18T10:00:00Z" },
  { id: "le-2009", walletId: "w-5", userId: "u-005", type: "license_grant", amount:  10_000, balanceAfter:  10_000, description: "License 核销发放",       referenceType: "license_key",  referenceId: "lk-10088",       createdAt: "2026-02-11T09:20:00Z" },
  { id: "le-2010", walletId: "w-5", userId: "u-005", type: "spend",         amount:    -800, balanceAfter:  17_400, description: "造型升级（虚拟服饰）",    referenceType: "wardrobe_buy", referenceId: "wd-1001",        createdAt: "2026-04-05T02:00:00Z" },
  { id: "le-2011", walletId: "w-1", userId: "u-001", type: "adjust",        amount:     500, balanceAfter: 433_100, description: "人工调账（客服补偿）",    referenceType: "adjust",       referenceId: "ticket-9981",    createdAt: "2026-04-11T14:20:00Z" },
];
