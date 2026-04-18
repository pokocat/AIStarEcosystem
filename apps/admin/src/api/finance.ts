// ─────────────────────────────────────────────────────────────────────────────
// api/finance.ts — 财务数据 API。对应 AdminFinanceController。
// ─────────────────────────────────────────────────────────────────────────────

import type { MonthlyRevenuePoint, RevenueSource, Transaction } from "@/types/finance";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { REVENUE_MONTHLY, REVENUE_SOURCES, TRANSACTIONS } from "@/mocks/finance";

export async function getMonthlyRevenue(): Promise<MonthlyRevenuePoint[]> {
  if (USE_MOCK) return mockDelay(REVENUE_MONTHLY);
  return apiFetch<MonthlyRevenuePoint[]>("/admin/finance/revenue/monthly");
}

export async function getRevenueSources(): Promise<RevenueSource[]> {
  if (USE_MOCK) return mockDelay(REVENUE_SOURCES);
  return apiFetch<RevenueSource[]>("/admin/finance/revenue/sources");
}

export async function listTransactions(
  page = 0, size = 20, userId?: string
): Promise<Transaction[]> {
  if (USE_MOCK) return mockDelay(TRANSACTIONS);
  return apiFetch<Transaction[]>("/admin/finance/transactions", {
    query: { page, size, userId },
  });
}
