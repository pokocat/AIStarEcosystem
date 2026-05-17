// ─────────────────────────────────────────────────────────────────────────────
// api/store.ts — 统一商店与用户库存 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/store.ts 拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "@ai-star-eco/types/_shared";
import type { SaleStatus } from "@ai-star-eco/types/wardrobe";
import { apiFetch } from "./_client";

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
  return apiFetch<StoreItemWire[]>("/store/catalog", {
    query: type ? { type } : undefined,
  });
}

export async function redeem(type: StoreItemType, itemId: ID): Promise<UserInventoryWire> {
  return apiFetch<UserInventoryWire>(
    `/store/items/${encodeURIComponent(type)}/${encodeURIComponent(itemId)}/redeem`,
    { method: "POST" },
  );
}

export async function getInventory(type?: StoreItemType): Promise<UserInventoryWire[]> {
  return apiFetch<UserInventoryWire[]>("/me/inventory", {
    query: type ? { type } : undefined,
  });
}
