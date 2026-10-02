// mocks/_handlers/finance.ts — 积分 / 财务 mock handlers（钱包 / 积分明细 / 月度收入 / 流水 / 充值 / 提现 / 收银台）。
//
// v0.197：本地 mock 要能走完「钱包选套餐 → 收银台 → 支付 → 回钱包看到余额和明细变了」
// （docs/drama-ux-copy-pass.md §3.5 / §3.6）。为此：
//   - 注册影子支付渠道 GET /me/wallet/recharge/channels（与服务端 shadow 渠道同形，sandbox=true）；
//   - 补齐收银台轮询要用的 GET /me/wallet/recharge/orders/:id 与 POST .../:id/sync；
//   - /me/ledger 返回一份与钱包余额对得上的积分明细，模拟支付成功时追加充值 / 赠送两条。
// 所有时间字段一律 ISO（§4.8），不再用 toISOString().slice(0, 10) 切 UTC 日期。

import type { Transaction } from "@ai-star-eco/types/finance";
import type { LedgerEntry, RechargeOrder, Wallet } from "@ai-star-eco/types/wallet";
import type { PaymentChannel } from "@ai-star-eco/api-client";
import { ApiError, DEFAULT_RECHARGE_PACKAGES, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { REVENUE_MONTHLY, REVENUE_SOURCES, TRANSACTIONS } from "@/mocks/finance";
import type { RechargeInput, WithdrawalInput } from "@/api/finance";

// totalBalance = license + recharge + gift（pending 不计入，§4.2）。
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

// ── 积分明细（与服务端 LedgerEntry 同形；createdAt 倒序、同一时刻按 id 倒序返回）──────
// 余额链与上面的钱包对得上：最后一条之后的总余额 = 126,400，冻结中 = 16,800。
// 要等结果的扣费照服务端 CreditService 的三段式：先「冻结」（FREEZE，余额减少）→ 结算「扣除」
// （SPEND，余额不再变）/ 没用上的「退回」（UNFREEZE，余额加回；失败、取消、按实际用量退差额都走它）。
function le(
  id: string,
  type: LedgerEntry["type"],
  amount: number,
  balanceAfter: number,
  description: string,
  createdAt: string,
  ref?: { type: string; id: string },
): LedgerEntry {
  return {
    id,
    walletId: walletState.id,
    userId: walletState.userId,
    type,
    amount,
    balanceAfter,
    description,
    referenceType: ref?.type,
    referenceId: ref?.id,
    createdAt,
  };
}
const ledgerStore: LedgerEntry[] = [
  le("le-m-001", "license_grant", 50_000, 50_000, "激活码到账", "2026-04-02T02:10:00Z", { type: "license_key", id: "lk-demo" }),
  le("le-m-002", "gift", 20_000, 70_000, "新用户赠送", "2026-04-02T02:10:05Z"),
  le("le-m-003", "recharge", 60_000, 130_000, "充值 · 企业包", "2026-04-10T06:30:00Z", { type: "recharge_order", id: "ro-demo-1" }),
  le("le-m-004", "income", 24_800, 154_800, "《暮色未央》平台分账", "2026-04-28T09:00:00Z"),
  le("le-m-005", "withdraw", -10_000, 144_800, "提现至尾号 9316", "2026-05-02T03:15:00Z"),
  le("le-m-006", "freeze", -1_600, 143_200, "《暮色未央》第 3 集 · 8 镜首帧", "2026-05-13T11:20:00Z", { type: "drama_shot_batch", id: "b-301" }),
  le("le-m-007", "spend", -1_600, 143_200, "《暮色未央》第 3 集 · 8 镜首帧", "2026-05-13T11:24:00Z", { type: "drama_shot_batch", id: "b-301" }),
  le("le-m-008", "freeze", -800, 142_400, "《盛夏来信》第 1 集 · 第 4 镜视频", "2026-05-13T13:02:00Z", { type: "drama_shot_video", id: "v-104" }),
  le("le-m-009", "unfreeze", 800, 143_200, "《盛夏来信》第 1 集 · 第 4 镜视频（生成失败）", "2026-05-13T13:06:00Z", { type: "drama_shot_video", id: "v-104" }),
  le("le-m-010", "freeze", -16_800, 126_400, "《盛夏来信》第 1 集 · 12 镜视频（生成中）", "2026-05-14T09:00:00Z", { type: "drama_shot_batch", id: "b-112" }),
];
// 新流水的 id 单调递增（"n" 排在种子数据的数字 id 之后）。服务端同一时刻的记录按 id 倒序，
// id 递增才能让 mock 里「后写的排前面」这件事也是由 id 决定、而不是靠数组下标。
let ledgerSeq = 0;
const nextLedgerId = () => `le-m-n${String(++ledgerSeq).padStart(8, "0")}`;

/** 本地日历日（yyyy-MM-dd）。Transaction.date 仍要一个到天的值；不能用 toISOString 切 UTC。 */
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextTxId = () => `tx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

const invalidAmount = (msg: string) =>
  new ApiError({ code: "drama.invalid_amount", message: msg }, 400);
const insufficient = (msg: string) =>
  new ApiError({ code: "drama.insufficient_balance", message: msg }, 400);
const orderNotFound = () => new ApiError({ code: "drama.order_not_found", message: "找不到这笔订单" }, 404);

// v2 §6 钱包：充值套餐 + 充值订单 store（在线支付走影子收银台）。
// 套餐复用 api-client 的 DEFAULT_RECHARGE_PACKAGES —— 与 admin 后端配置（seed）单一真值对齐，
// 不再本地写死一套漂移的价格 / 赠送，dev 看到的与线上 admin 配置一致。
const DRAMA_PACKAGES = DEFAULT_RECHARGE_PACKAGES;
const ordersStore: RechargeOrder[] = [];
/** 服务端 RechargeService.PENDING_TTL_MINUTES = 30：待支付单的复用窗口。 */
const PENDING_TTL_MS = 30 * 60 * 1000;
const nextOrderId = () => `ro-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// 与服务端 shadow 影子渠道同形（dev profile 才启用；生产不会出现）。
const SHADOW_CHANNEL: PaymentChannel = {
  code: "shadow",
  label: "模拟支付",
  sandbox: true,
  defaultWayCode: "SHADOW",
  wayCodes: [{ code: "SHADOW", label: "本地模拟付款", scene: "shadow" }],
};

function settleShadow(o: RechargeOrder, result: string) {
  if (o.status !== "pending") return;
  const now = new Date().toISOString();
  if (result === "success") {
    o.status = "paid";
    o.paidVia = "shadow";
    o.paidAt = now;
    o.updatedAt = now;
    walletState = {
      ...walletState,
      rechargeBalance: walletState.rechargeBalance + o.credits,
      giftBalance: walletState.giftBalance + o.bonusCredits,
      totalBalance: walletState.totalBalance + o.credits + o.bonusCredits,
      updatedAt: now,
    };
    const afterRecharge = walletState.totalBalance - o.bonusCredits;
    ledgerStore.push(
      le(nextLedgerId(), "recharge", o.credits, afterRecharge, `充值 · ${o.packageTag ?? "充值套餐"}`, now, { type: "recharge_order", id: o.id }),
    );
    if (o.bonusCredits > 0) {
      ledgerStore.push(
        le(nextLedgerId(), "gift", o.bonusCredits, walletState.totalBalance, `充值赠送 · ${o.packageTag ?? "充值套餐"}`, now, { type: "recharge_order", id: o.id }),
      );
    }
  } else if (result === "fail") {
    o.status = "cancelled";
    o.updatedAt = now;
  }
  // timeout：保持 pending（与服务端一致）
}

registerMocks([
  // 注意：drama 财务的 /me/wallet handler 与 api-client 默认的 MOCK_WALLET 不同；
  // 同 method+path 后注册者覆盖之前。drama mock register 在 api-client bootstrap 之后执行，
  // 因此该 handler 会胜出，体现 drama 业务的钱包视图。
  {
    method: "GET",
    pattern: "/me/wallet",
    handler: () => mockDelay({ ...walletState }),
  },
  {
    method: "GET",
    pattern: "/me/ledger",
    handler: ({ query }) => {
      const page = Math.max(0, Number(query?.page ?? 0));
      const size = Math.max(1, Number(query?.size ?? 20));
      // 与服务端 AccountController.LEDGER_SORT 同一个排序键：createdAt 倒序，同一时刻再按 id 倒序。
      // 之前同一时刻按数组下标排，mock 天然稳定，掩盖了服务端只按 createdAt 排时翻页会漏的问题。
      const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
      const sorted = ledgerStore.slice().sort((a, b) => desc(a.createdAt, b.createdAt) || desc(a.id, b.id));
      return mockDelay(sorted.slice(page * size, page * size + size).map((e) => ({ ...e })));
    },
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
      arr.sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));
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
      const now = new Date();
      const tx: Transaction = {
        id: nextTxId(),
        source: sourceLabel,
        amount: input.amount,
        date: localDate(now),
        createdAt: now.toISOString(),
        status: "completed",
        type: "recharge",
      };
      txStore.unshift(tx);
      walletState = {
        ...walletState,
        rechargeBalance: walletState.rechargeBalance + input.amount,
        totalBalance: walletState.totalBalance + input.amount,
        updatedAt: now.toISOString(),
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
      const now = new Date();
      const tx: Transaction = {
        id: nextTxId(),
        source: `提现至尾号 ${input.bankCard.slice(-4)}`,
        amount: -input.amount,
        date: localDate(now),
        createdAt: now.toISOString(),
        status: "processing",
        type: "withdrawal",
      };
      txStore.unshift(tx);
      walletState = {
        ...walletState,
        rechargeBalance: Math.max(0, walletState.rechargeBalance - input.amount),
        totalBalance: walletState.totalBalance - input.amount,
        pendingBalance: walletState.pendingBalance + input.amount,
        updatedAt: now.toISOString(),
      };
      ledgerStore.push(le(nextLedgerId(), "withdraw", -input.amount, walletState.totalBalance, tx.source, now.toISOString()));
      return mockDelay({ ...tx });
    },
  },
  // ── v2 §6 钱包：套餐 / 在线充值（影子） / 订单 ───────────────────────────────
  { method: "GET", pattern: "/me/wallet/packages", handler: () => mockDelay(DRAMA_PACKAGES.map((p) => ({ ...p }))) },
  { method: "GET", pattern: "/me/wallet/recharge/channels", handler: () => mockDelay([{ ...SHADOW_CHANNEL }]) },
  {
    method: "POST",
    pattern: "/me/wallet/recharge/checkout",
    handler: ({ body }) => {
      const { packageId, wayCode } = (body ?? {}) as { packageId: string; wayCode?: string };
      const pkg = DRAMA_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) throw new ApiError({ code: "drama.package_not_found", message: "这个套餐已经下架了，请回钱包重新选" }, 404);
      const now = new Date().toISOString();
      // 与服务端 RechargeService.createOrReuseCheckoutOrder 一致：同套餐最近一单还在 30 分钟内待支付 → 复用它
      // （只更新支付方式），不另下一单。钱包「继续支付」→「换一种支付方式」走的就是这条。
      const latest = ordersStore.find((o) => o.packageId === pkg.id);
      if (latest && latest.status === "pending" && Date.now() - Date.parse(latest.createdAt) < PENDING_TTL_MS) {
        latest.wayCode = wayCode;
        latest.updatedAt = now;
        return mockDelay({ orderId: latest.id, payDataType: "shadow", payData: "" });
      }
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
        wayCode,
        createdAt: now,
        updatedAt: now,
      };
      ordersStore.unshift(order);
      // mock 在线支付：返回影子收银台，前端 shadow 分支模拟成功/失败。
      return mockDelay({ orderId: order.id, payDataType: "shadow", payData: "" });
    },
  },
  { method: "GET", pattern: "/me/wallet/recharge/orders", handler: () => mockDelay(ordersStore.map((o) => ({ ...o }))) },
  {
    method: "GET",
    pattern: "/me/wallet/recharge/orders/:id",
    handler: ({ params }) => {
      const o = ordersStore.find((x) => x.id === params.id);
      if (!o) throw orderNotFound();
      return mockDelay({ ...o });
    },
  },
  {
    // 服务端这里会去网关查单；mock 没有网关，原样返回当前状态（影子渠道靠「模拟支付成功」推进）。
    method: "POST",
    pattern: "/me/wallet/recharge/orders/:id/sync",
    handler: ({ params }) => {
      const o = ordersStore.find((x) => x.id === params.id);
      if (!o) throw orderNotFound();
      return mockDelay({ ...o });
    },
  },
  {
    method: "POST",
    pattern: "/me/wallet/recharge/orders/:id/cancel",
    handler: ({ params }) => {
      const o = ordersStore.find((x) => x.id === params.id);
      if (!o) throw orderNotFound();
      if (o.status === "pending") {
        o.status = "cancelled";
        o.updatedAt = new Date().toISOString();
      }
      return mockDelay({ ...o });
    },
  },
  {
    method: "POST",
    pattern: "/dev/pay/shadow/confirm",
    handler: ({ body }) => {
      const { orderId, result = "success" } = (body ?? {}) as { orderId: string; result?: string };
      const o = ordersStore.find((x) => x.id === orderId);
      if (!o) throw orderNotFound();
      settleShadow(o, result);
      return mockDelay({ ...o });
    },
  },
]);
