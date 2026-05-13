// ─────────────────────────────────────────────────────────────────────────────
// api/store.ts — 统一商店与用户库存 API。
// 覆盖跨品类商品目录（wardrobe/pose/expression/gesture）+ 积分兑换 + 我的库存。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "@ai-star-eco/types/_shared";
import type { SaleStatus } from "@ai-star-eco/types/wardrobe";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export type StoreItemType = "WARDROBE" | "POSE" | "EXPRESSION" | "GESTURE" | "NFT" | "FORGE_BLUEPRINT";
export type AcquireSource = "PURCHASE" | "GRANT" | "DEFAULT";

export interface StoreItemWire {
  id: ID;
  itemType: StoreItemType;
  name: string;
  category: string | null;
  previewUrl: string | null;
  rarity: string | null;
  priceCredits: number;
  saleStatus: SaleStatus;
  owned: boolean;
}

export interface UserInventoryWire {
  id: ID;
  userId: ID;
  itemType: StoreItemType;
  itemId: ID;
  source: AcquireSource;
  creditsSpent: number;
  ledgerEntryId: string | null;
  acquiredAt: ISODateTime;
}

export async function getCatalog(type?: StoreItemType): Promise<StoreItemWire[]> {
  if (USE_MOCK) return mockDelay([]);
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return apiFetch<StoreItemWire[]>(`/store/catalog${qs}`);
}

export async function redeem(type: StoreItemType, itemId: ID): Promise<UserInventoryWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-inv-${Date.now()}`,
      userId: "mock-user",
      itemType: type, itemId,
      source: "PURCHASE",
      creditsSpent: 0,
      ledgerEntryId: null,
      acquiredAt: new Date().toISOString(),
    });
  }
  return apiFetch<UserInventoryWire>(
    `/store/items/${encodeURIComponent(type)}/${encodeURIComponent(itemId)}/redeem`,
    { method: "POST" }
  );
}

export async function getInventory(type?: StoreItemType): Promise<UserInventoryWire[]> {
  if (USE_MOCK) return mockDelay([]);
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return apiFetch<UserInventoryWire[]>(`/me/inventory${qs}`);
}
