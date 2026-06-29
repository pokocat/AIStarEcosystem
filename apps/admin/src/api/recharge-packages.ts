// ─────────────────────────────────────────────────────────────────────────────
// api/recharge-packages.ts — Admin 充值套餐 CRUD（软删）。
// 对应 AdminFinanceRechargePackageController。v0.5 新增。
// ─────────────────────────────────────────────────────────────────────────────

import type { RechargePackage } from "@/types/wallet";
import { apiFetch } from "./_client";

export interface AdminRechargePackageUpsert {
  id?: string;
  credits: number;
  priceCents: number;
  tag: string;
  recommended: boolean;
  bonusCredits?: number;
  sortOrder?: number;
  active?: boolean;
  /** v2 §6 适用子应用：all=通用 / music|drama|celebrity|aiavatar|star */
  appScope?: string;
  /** v0.92 存储套餐：购买授予的存储扩容（MB），>0 即为「存储套餐」（可与积分共存或纯存储 credits=0） */
  grantStorageMb?: number;
}

const BASE = "/admin/finance/recharge-packages";

export async function list(): Promise<RechargePackage[]> {
  return apiFetch<RechargePackage[]>(BASE);
}
export async function get(id: string): Promise<RechargePackage> {
  return apiFetch<RechargePackage>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AdminRechargePackageUpsert): Promise<RechargePackage> {
  return apiFetch<RechargePackage>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AdminRechargePackageUpsert): Promise<RechargePackage> {
  return apiFetch<RechargePackage>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
/** 软删：返回 active=false 的套餐对象。 */
export async function softDelete(id: string): Promise<RechargePackage> {
  return apiFetch<RechargePackage>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
