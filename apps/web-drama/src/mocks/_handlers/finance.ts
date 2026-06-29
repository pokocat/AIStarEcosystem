// mocks/_handlers/finance.ts — 财务领域 mock handlers（钱包 / 月度收入 / 流水 / 充值 / 提现）。

import type { Transaction } from "@ai-star-eco/types/finance";
import type { RechargeOrder, Wallet } from "@ai-star-eco/types/wallet";
import { ApiError, DEFAULT_RECHARGE_PACKAGES, mockDelay, registerMocks } from "@ai-star-eco/api-client";
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

// v2 §6 钱包：充值套餐 + 充值订单 store（在线支付走影子收银台）。
// 套餐复用 api-client 的 DEFAULT_RECHARGE_PACKAGES —— 与 admin 后端配置（seed）单一真值对齐，
// 不再本地写死一套漂移的价格 / 赠送，dev 看到的与线上 admin 配置一致。
const DRAMA_PACKAGES = DEFAULT_RECHARGE_PACKAGES;
const ordersStore: RechargeOrder[] = [];
const nextOrderId = () => `ro-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
  // ── v2 §6 钱包：套餐 / 在线充值（影子） / 订单 ───────────────────────────────
  { method: "GET", pattern: "/me/wallet/packages", handler: () => mockDelay(DRAMA_PACKAGES.map((p) => ({ ...p }))) },
  {
    method: "POST",
    pattern: "/me/wallet/recharge/checkout",
    handler: ({ body }) => {
      const { packageId } = (body ?? {}) as { packageId: string };
      const pkg = DRAMA_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) throw new ApiError({ code: "drama.package_not_found", message: "套餐不存在" }, 404);
      const order: RechargeOrder = {
        id: nextOrderId(),
        userId: walletState.userId,
        packageId: pkg.id,
        packageTag: pkg.tag,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits ?? 0,
        priceCents: pkg.priceCents,
        status: "pending",
        sourceApp: "drama",
        createdAt: new Date().toISOString(),
      };
      ordersStore.unshift(order);
      // mock 在线支付：返回影子收银台，前端 shadow 分支模拟成功/失败。
      return mockDelay({ orderId: order.id, payDataType: "shadow", payData: "" });
    },
  },
  { method: "GET", pattern: "/me/wallet/recharge/orders", handler: () => mockDelay(ordersStore.map((o) => ({ ...o }))) },
  {
    method: "POST",
    pattern: "/me/wallet/recharge/orders/:id/cancel",
    handler: ({ params }) => {
      const o = ordersStore.find((x) => x.id === params.id);
      if (!o) throw new ApiError({ code: "drama.order_not_found", message: "订单不存在" }, 404);
      if (o.status === "pending") o.status = "cancelled";
      return mockDelay({ ...o });
    },
  },
  {
    method: "POST",
    pattern: "/dev/pay/shadow/confirm",
    handler: ({ body }) => {
      const { orderId, result = "success" } = (body ?? {}) as { orderId: string; result?: string };
      const o = ordersStore.find((x) => x.id === orderId);
      if (!o) throw new ApiError({ code: "drama.order_not_found", message: "订单不存在" }, 404);
      if (o.status === "pending") {
        if (result === "success") {
          o.status = "paid";
          o.paidVia = "shadow";
          o.paidAt = new Date().toISOString();
          walletState = {
            ...walletState,
            rechargeBalance: walletState.rechargeBalance + o.credits,
            giftBalance: walletState.giftBalance + o.bonusCredits,
            totalBalance: walletState.totalBalance + o.credits + o.bonusCredits,
            updatedAt: new Date().toISOString(),
          };
        } else {
          o.status = "cancelled";
        }
      }
      return mockDelay({ ...o });
    },
  },
]);
