// ─────────────────────────────────────────────────────────────────────────────
// api/finance.ts — 财务 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/finance.ts 拦截（含 wallet state + tx store）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Transaction,
  MonthlyRevenuePoint,
  RevenueSource,
} from "@ai-star-eco/types/finance";
import type { Wallet } from "@ai-star-eco/types/wallet";
import { apiFetch } from "./_client";

// ── Read ───────────────────────────────────────────────────────────────────

export async function getMyWallet(): Promise<Wallet> {
  return apiFetch<Wallet>("/me/wallet");
}

export async function getMonthlyRevenue(): Promise<MonthlyRevenuePoint[]> {
  return apiFetch<MonthlyRevenuePoint[]>("/finance/revenue/monthly");
}

export async function getRevenueSources(): Promise<RevenueSource[]> {
  return apiFetch<RevenueSource[]>("/finance/revenue/sources");
}

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  type?: Transaction["type"];
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<Transaction[]> {
  const { page = 1, limit = 50, type } = params;
  return apiFetch<Transaction[]>("/finance/transactions", {
    query: { page, limit, type },
  });
}

// ── Write ──────────────────────────────────────────────────────────────────

export interface RechargeInput {
  amount: number;
  method: "alipay" | "wechat" | "bank";
}

export async function createRecharge(input: RechargeInput): Promise<Transaction> {
  return apiFetch<Transaction>("/me/wallet/recharge", { method: "POST", body: input });
}

export interface WithdrawalInput {
  amount: number;
  bankCard: string;
}

export async function createWithdrawal(input: WithdrawalInput): Promise<Transaction> {
  return apiFetch<Transaction>("/me/wallet/withdraw", { method: "POST", body: input });
}
