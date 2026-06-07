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

/** v0.33+: 可购买的充值套餐列表 */
export async function listRechargePackages(): Promise<RechargePackage[]> {
  return apiFetch<RechargePackage[]>("/me/wallet/packages");
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
