// mocks/_handlers/finance.ts — 财务领域 mock handlers（钱包 / 月度收入 / 流水 / 充值 / 提现）。

import type { Transaction } from "@ai-star-eco/types/finance";
import type { Wallet } from "@ai-star-eco/types/wallet";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { REVENUE_MONTHLY, REVENUE_SOURCES, TRANSACTIONS } from "@/mocks/finance";
import type { RechargeInput, WithdrawalInput } from "@/api/finance";

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

const todayDate = () => new Date().toISOString().slice(0, 10);
const nextTxId = () => `tx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

const invalidAmount = (msg: string) =>
  new ApiError({ code: "drama.invalid_amount", message: msg }, 400);
const insufficient = (msg: string) =>
  new ApiError({ code: "drama.insufficient_balance", message: msg }, 400);

registerMocks([
  // 注意：drama 财务的 /me/wallet handler 与 api-client 默认的 MOCK_WALLET 不同；
  // 同 method+path 后注册者覆盖之前。drama mock register 在 api-client bootstrap 之后执行，
  // 因此该 handler 会胜出，体现 drama 业务的钱包视图。
  {
    method: "GET",
    pattern: "/me/wallet",
    handler: () => mockDelay({ ...walletState }),
  },
  { method: "GET", pattern: "/finance/revenue/monthly", handler: () => mockDelay(REVENUE_MONTHLY) },
  { method: "GET", pattern: "/finance/revenue/sources", handler: () => mockDelay(REVENUE_SOURCES) },
  {
    method: "GET",
    pattern: "/finance/transactions",
    handler: ({ query }) => {
      const page = Number(query?.page ?? 1);
      const limit = Number(query?.limit ?? 50);
      const type = query?.type as Transaction["type"] | undefined;
      let arr = txStore.slice();
      if (type) arr = arr.filter((t) => t.type === type);
      arr.sort((a, b) => b.date.localeCompare(a.date));
      const start = (page - 1) * limit;
      return mockDelay(arr.slice(start, start + limit).map((t) => ({ ...t })));
    },
  },
  {
    method: "POST",
    pattern: "/me/wallet/recharge",
    handler: ({ body }) => {
      const input = body as RechargeInput;
      if (input.amount <= 0) throw invalidAmount("充值金额必须大于 0");
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
    },
  },
  {
    method: "POST",
    pattern: "/me/wallet/withdraw",
    handler: ({ body }) => {
      const input = body as WithdrawalInput;
      if (input.amount <= 0) throw invalidAmount("提现金额必须大于 0");
      if (input.amount > walletState.totalBalance) {
        throw insufficient(
          `可用余额不足，最多可提现 ${walletState.totalBalance.toLocaleString("zh-CN")}`,
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
    },
  },
]);
