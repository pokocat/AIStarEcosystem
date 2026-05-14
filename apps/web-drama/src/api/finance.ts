// ─────────────────────────────────────────────────────────────────────────────
// api/finance.ts — 财务（钱包 / 月度收入 / 来源占比 / 交易流水 / 充值 / 提现）API。
// USE_MOCK=1 时维护 mutable 交易 store + wallet state；提现 / 充值会真实入账。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Transaction,
  MonthlyRevenuePoint,
  RevenueSource,
} from "@ai-star-eco/types/finance";
import type { Wallet } from "@ai-star-eco/types/wallet";
import {
  REVENUE_MONTHLY,
  REVENUE_SOURCES,
  TRANSACTIONS,
} from "@/mocks/finance";
import { apiFetch, USE_MOCK, mockDelay, clientError } from "./_client";

// 钱包种子（与 console/page.tsx 原 FINANCE_WALLET 同源）。
let walletState: Wallet = {
  id: "w-mock-drama-001",
  userId: "u-mock-001",
  totalBalance: 126_400,
  licenseBalance: 50_000,
  rechargeBalance: 58_000,
  giftBalance: 18_400,
  pendingBalance: 16_800,
  createdAt: "2025-09-12T08:10:00Z",
  updatedAt: "2026-05-14T09:00:00Z",
};

const txStore: Transaction[] = TRANSACTIONS.map((t) => ({ ...t }));

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextTxId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getMyWallet(): Promise<Wallet> {
  if (USE_MOCK) return mockDelay({ ...walletState });
  return apiFetch<Wallet>("/me/wallet");
}

export async function getMonthlyRevenue(): Promise<MonthlyRevenuePoint[]> {
  if (USE_MOCK) return mockDelay(REVENUE_MONTHLY);
  return apiFetch<MonthlyRevenuePoint[]>("/finance/revenue/monthly");
}

export async function getRevenueSources(): Promise<RevenueSource[]> {
  if (USE_MOCK) return mockDelay(REVENUE_SOURCES);
  return apiFetch<RevenueSource[]>("/finance/revenue/sources");
}

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  type?: Transaction["type"];
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<Transaction[]> {
  const { page = 1, limit = 50, type } = params;
  if (USE_MOCK) {
    let arr = txStore.slice();
    if (type) arr = arr.filter((t) => t.type === type);
    arr.sort((a, b) => b.date.localeCompare(a.date));
    const start = (page - 1) * limit;
    return mockDelay(arr.slice(start, start + limit).map((t) => ({ ...t })));
  }
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (type) qs.set("type", type);
  return apiFetch<Transaction[]>(`/finance/transactions?${qs.toString()}`);
}

// ── Write ──────────────────────────────────────────────────────────────────

export interface RechargeInput {
  amount: number;
  method: "alipay" | "wechat" | "bank";
}

export async function createRecharge(input: RechargeInput): Promise<Transaction> {
  if (input.amount <= 0) throw clientError("充值金额必须大于 0", 400, "drama.invalid_amount");
  if (USE_MOCK) {
    const sourceLabel =
      input.method === "alipay" ? "支付宝充值" : input.method === "wechat" ? "微信充值" : "银行卡充值";
    const tx: Transaction = {
      id: nextTxId(),
      source: sourceLabel,
      amount: input.amount,
      date: todayDate(),
      status: "completed",
      type: "recharge",
    };
    txStore.unshift(tx);
    walletState = {
      ...walletState,
      rechargeBalance: walletState.rechargeBalance + input.amount,
      totalBalance: walletState.totalBalance + input.amount,
      updatedAt: new Date().toISOString(),
    };
    return mockDelay({ ...tx });
  }
  return apiFetch<Transaction>("/me/wallet/recharge", { method: "POST", body: input });
}

export interface WithdrawalInput {
  amount: number;
  bankCard: string;
}

export async function createWithdrawal(input: WithdrawalInput): Promise<Transaction> {
  if (input.amount <= 0) throw clientError("提现金额必须大于 0", 400, "drama.invalid_amount");
  if (USE_MOCK) {
    if (input.amount > walletState.totalBalance) {
      throw clientError(
        `可用余额不足，最多可提现 ${walletState.totalBalance.toLocaleString("zh-CN")}`,
        400,
        "drama.insufficient_balance",
      );
    }
    const tx: Transaction = {
      id: nextTxId(),
      source: `提现至尾号 ${input.bankCard.slice(-4)}`,
      amount: -input.amount,
      date: todayDate(),
      status: "processing",
      type: "withdrawal",
    };
    txStore.unshift(tx);
    walletState = {
      ...walletState,
      rechargeBalance: Math.max(0, walletState.rechargeBalance - input.amount),
      totalBalance: walletState.totalBalance - input.amount,
      pendingBalance: walletState.pendingBalance + input.amount,
      updatedAt: new Date().toISOString(),
    };
    return mockDelay({ ...tx });
  }
  return apiFetch<Transaction>("/me/wallet/withdraw", { method: "POST", body: input });
}
