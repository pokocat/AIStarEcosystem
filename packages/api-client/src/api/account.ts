// ─────────────────────────────────────────────────────────────────────────────
// api/account.ts — 用户账户 / 钱包 / 流水 API（network-only）。
// 对应后端 AccountController: /api/me/*
//
// USE_MOCK 模式由 _bootstrap-mocks.ts 在 apiFetch 网络层拦截，提供占位用户 / 钱包，
// 让 AuthProvider 启动 / shell 顶栏 wallet badge 在无后端时也能渲染。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant } from "@ai-star-eco/types/account";
import type {
  Wallet,
  LedgerEntry,
  RechargePackage,
  RechargeRequest,
  RechargeOrder,
} from "@ai-star-eco/types/wallet";
import { apiFetch } from "../_client";

/** 获取当前登录用户信息 */
export async function getMe(): Promise<AepUser> {
  return apiFetch<AepUser>("/me");
}

/** 更新当前用户的可编辑资料 */
export async function updateProfile(
  data: Partial<Pick<AepUser, "displayName" | "avatarUrl" | "phone" | "email" | "bio" | "langPreference">>,
): Promise<AepUser> {
  return apiFetch<AepUser>("/me", {
    method: "PATCH",
    body: data,
  });
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  changed: boolean;
  hasPassword: boolean;
}

/** 当前登录账号设置 / 修改密码。首次设置可不传 currentPassword。 */
export async function changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResult> {
  return apiFetch<ChangePasswordResult>("/me/password", {
    method: "POST",
    body: payload,
  });
}

/** 获取当前用户关联的机构列表 */
export async function getMyTenants(): Promise<Tenant[]> {
  return apiFetch<Tenant[]>("/me/tenants");
}

/** 获取当前用户钱包 */
export async function getMyWallet(): Promise<Wallet> {
  return apiFetch<Wallet>("/me/wallet");
}

/** 获取当前用户点数流水（分页） */
export async function getMyLedger(page = 0, size = 20): Promise<LedgerEntry[]> {
  return apiFetch<LedgerEntry[]>("/me/ledger", {
    query: { page, size },
  });
}

/** v0.33+: 可购买的充值套餐列表。v2 §6：传 sourceApp 只看「通用 + 该子应用专属」套餐。 */
export async function listRechargePackages(sourceApp?: string): Promise<RechargePackage[]> {
  return apiFetch<RechargePackage[]>("/me/wallet/packages", {
    query: sourceApp ? { sourceApp } : undefined,
  });
}

/**
 * v0.56：充值下单（不再直接入账）。
 * 生成一张待确认账单；平台运营线下收款后在 admin 核准方入账。返回新建的订单。
 */
export async function createRechargeOrder(req: RechargeRequest): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>("/me/wallet/recharge", {
    method: "POST",
    body: req,
  });
}

/** v0.56：我的充值订单（待确认 / 已到账 / 已驳回 / 已取消）。 */
export async function listMyRechargeOrders(): Promise<RechargeOrder[]> {
  return apiFetch<RechargeOrder[]>("/me/wallet/recharge/orders");
}

/** v0.56：取消自己的待确认充值订单。 */
export async function cancelRechargeOrder(orderId: string): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>(`/me/wallet/recharge/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
  });
}

/** v2 §6 收银台：取单当前态（轮询）。 */
export async function getRechargeOrder(orderId: string): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>(`/me/wallet/recharge/orders/${encodeURIComponent(orderId)}`);
}

/** v2 §6 收银台「我已支付 / 刷新状态」：主动查网关 → 已支付则结算 / 超时则关单，返回最新态。 */
export async function syncRechargeOrder(orderId: string): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>(`/me/wallet/recharge/orders/${encodeURIComponent(orderId)}/sync`, {
    method: "POST",
  });
}

/** v2：充值在线支付下单返回体。payData 供前端拉起支付（影子链路 → 模拟收银台）。 */
export interface CheckoutResponse {
  orderId: string;
  /** shadow / wxapp / payurl … */
  payDataType: string;
  payData: string;
}

export interface CheckoutPayload {
  packageId: string;
  /** 支付渠道 alipay / wechat / shadow；空则取首个可用渠道。 */
  channel?: string;
  /** ALI_PC / ALI_WAP / ALI_QR / WX_NATIVE / WX_JSAPI / WX_H5 / SHADOW；空则按渠道默认。 */
  wayCode?: string;
  /** 微信小程序 openid（WX_JSAPI 必填）。 */
  openid?: string;
  /** 发起子应用（仅营销标签）。 */
  sourceApp?: string;
}

/** v2：充值在线支付下单（子应用内发起，后端调支付网关开单）。 */
export async function rechargeCheckout(payload: CheckoutPayload): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>("/me/wallet/recharge/checkout", {
    method: "POST",
    body: payload,
  });
}

/** v0.94 多渠道：收银台可用支付渠道（已启用 + 配置齐全）。 */
export interface PaymentChannel {
  code: string;          // alipay / wechat / shadow
  label: string;
  sandbox: boolean;
  defaultWayCode: string;
  wayCodes: { code: string; label: string; scene: string }[]; // pc/wap/qr/jsapi/h5/shadow
}

export async function getRechargeChannels(): Promise<PaymentChannel[]> {
  return apiFetch<PaymentChannel[]>("/me/wallet/recharge/channels");
}

/**
 * v2 dev 影子链路：模拟收银台确认（仅后端 driver=shadow 时可用，生产无此端点）。
 * result：success（默认，→ 入账）/ fail（→ 取消）/ timeout（→ 留 PENDING）。
 */
export async function confirmShadowPay(
  orderId: string,
  result: "success" | "fail" | "timeout" = "success",
): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>("/dev/pay/shadow/confirm", {
    method: "POST",
    body: { orderId, result },
  });
}
