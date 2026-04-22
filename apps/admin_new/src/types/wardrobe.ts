// ─────────────────────────────────────────────────────────────────────────────
// wardrobe.ts — 服装 / 造型 / 搭配。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime, Rarity } from "./_shared";

export type ClothingCategory = "top" | "bottom" | "accessory" | "shoes" | "hair" | "outfit";

/** 可装备槽位（outfit 类型不占单槽，排除）。 */
export type EquipSlot = Exclude<ClothingCategory, "outfit">;

export type SaleStatus = "FREE" | "PAID" | "LOCKED";

export interface ClothingItem {
  id: ID;
  name: string;
  category: ClothingCategory;
  imageUrl: string;
  rarity: Rarity;
  price: number;
  tags: string[];
  isLocked?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
  priceCredits?: number;
  saleStatus?: SaleStatus;
  previewUrl?: string;
}

export type EquippedSlots = Record<EquipSlot, ClothingItem | null>;

export interface SavedOutfit {
  id: ID;
  name: string;
  items: EquippedSlots;
  createdAt: ISODateTime;
}
