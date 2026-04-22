// ─────────────────────────────────────────────────────────────────────────────
// api/wallet.ts — 钱包与流水管理 API。对应 AdminCreditController
// (/api/admin/wallets, /api/admin/ledger-entries)。
// ─────────────────────────────────────────────────────────────────────────────

import type { Wallet, LedgerEntry } from "@/types/wallet";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { WALLETS, LEDGER_ENTRIES } from "@/mocks/wallet";

export async function listWallets(page = 0, size = 20): Promise<Wallet[]> {
  if (USE_MOCK) return mockDelay(WALLETS);
  return apiFetch<Wallet[]>("/admin/wallets", {
    query: { page, size },
  });
}

export async function getWalletByUser(userId: string): Promise<Wallet> {
  if (USE_MOCK) return mockDelay(WALLETS.find((w) => w.userId === userId)!);
  return apiFetch<Wallet>(`/admin/wallets/${encodeURIComponent(userId)}`);
}

export async function listLedgerEntries(
  walletId?: string, userId?: string, page = 0, size = 20
): Promise<LedgerEntry[]> {
  if (USE_MOCK) return mockDelay(LEDGER_ENTRIES);
  return apiFetch<LedgerEntry[]>("/admin/ledger-entries", {
    query: { walletId, userId, page, size },
  });
}
