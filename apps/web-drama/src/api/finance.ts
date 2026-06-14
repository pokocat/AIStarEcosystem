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

interface RechargePackageWire {
  id: string;
  name?: string;
  credits: number;
  priceCents?: number;
}

interface RechargeOrderWire {
  id: string;
  packageId?: string;
  credits?: number;
  status?: string;
  createdAt?: string;
}

/**
 * 充值（v0.56 真实流程是「下单 → 运营线下收款核准后入账」）：
 * 按金额匹配充值套餐下单，返回 processing 状态的流水视图；核准后余额才会变。
 */
export async function createRecharge(input: RechargeInput): Promise<Transaction> {
  const packages = await apiFetch<RechargePackageWire[]>("/me/wallet/packages");
  if (!packages.length) {
    throw new Error("运营还没配置充值套餐，请联系平台。");
  }
  // 优先积分数恰好等于充值额的套餐，否则取不小于该额度的最小套餐（再退化为最大）。
  const exact = packages.find((p) => p.credits === input.amount);
  const cover = packages.filter((p) => p.credits >= input.amount).sort((a, b) => a.credits - b.credits)[0];
  const pick = exact ?? cover ?? [...packages].sort((a, b) => b.credits - a.credits)[0];
  const order = await apiFetch<RechargeOrderWire>("/me/wallet/recharge", {
    method: "POST",
    body: { packageId: pick.id, note: `drama 财务页充值 · 期望 ${input.amount} 积分 · ${input.method}` },
  });
  return {
    id: order.id,
    source: `充值下单（${pick.name ?? pick.credits + " 积分"}）· 待运营确认`,
    amount: order.credits ?? pick.credits,
    date: (order.createdAt ?? new Date().toISOString()).slice(0, 10),
    status: "processing",
    type: "recharge",
  } as Transaction;
}

export interface WithdrawalInput {
  amount: number;
  bankCard: string;
}

export async function createWithdrawal(input: WithdrawalInput): Promise<Transaction> {
  return apiFetch<Transaction>("/me/wallet/withdraw", { method: "POST", body: input });
}
