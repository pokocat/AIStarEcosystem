// ─────────────────────────────────────────────────────────────────────────────
// api/finance.ts — 财务（月度收入 / 来源占比 / 交易流水）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Transaction,
  MonthlyRevenuePoint,
  RevenueSource,
} from "@/types/finance";
import {
  REVENUE_MONTHLY,
  REVENUE_SOURCES,
  TRANSACTIONS,
} from "@/mocks/finance";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function getMonthlyRevenue(): Promise<MonthlyRevenuePoint[]> {
  if (USE_MOCK) return mockDelay(REVENUE_MONTHLY);
  return apiFetch<MonthlyRevenuePoint[]>("/finance/revenue/monthly");
}

export async function getRevenueSources(): Promise<RevenueSource[]> {
  if (USE_MOCK) return mockDelay(REVENUE_SOURCES);
  return apiFetch<RevenueSource[]>("/finance/revenue/sources");
}

export async function listTransactions(): Promise<Transaction[]> {
  if (USE_MOCK) return mockDelay(TRANSACTIONS);
  return apiFetch<Transaction[]>("/finance/transactions");
}
