// ─────────────────────────────────────────────────────────────────────────────
// api/store.ts — 管理端商店配置：定价 / 上下架 / 赠送
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export type StoreItemType = "WARDROBE" | "POSE" | "EXPRESSION" | "GESTURE";
export type SaleStatus = "FREE" | "PAID" | "LOCKED";

export interface UpdatePricingBody {
  priceCredits?: number;
  saleStatus?: SaleStatus;
  previewUrl?: string;
}

/**
 * 修改指定品类商品的定价 / 销售状态 / 预览图。
 * 缺省字段保留原值。
 */
export async function updatePricing(
  type: StoreItemType,
  id: string,
  body: UpdatePricingBody,
): Promise<unknown> {
  if (USE_MOCK) return mockDelay({});
  return apiFetch(`/admin/store/items/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });
}

export interface GrantBody {
  userId: string;
}

export async function grantItem(type: StoreItemType, id: string, userId: string): Promise<unknown> {
  if (USE_MOCK) return mockDelay({});
  return apiFetch(`/admin/store/items/${encodeURIComponent(type)}/${encodeURIComponent(id)}/grant`, {
    method: "POST",
    body: { userId },
  });
}
