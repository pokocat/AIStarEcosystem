// ─────────────────────────────────────────────────────────────────────────────
// api/wardrobe.ts — 衣橱系统 API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem, SavedOutfit } from "@/types/wardrobe";
import type { ID } from "@/types/_shared";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listClothing(): Promise<ClothingItem[]> {
  if (USE_MOCK) return mockDelay(CLOTHING_DATABASE);
  return apiFetch<ClothingItem[]>("/wardrobe/items");
}

/** 后端返回的 SavedOutfit 轻量视图（slots 是 slotKey → itemId 的映射）。 */
export interface SavedOutfitWire {
  id: ID;
  userId: ID;
  name: string;
  /** slotKey (top/bottom/accessory/shoes/hair) → itemId */
  slots: Record<string, string>;
  createdAt: string;
}

export async function listOutfits(): Promise<SavedOutfitWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<SavedOutfitWire[]>("/wardrobe/outfits");
}

export async function saveOutfit(name: string, slots: Record<string, string>): Promise<SavedOutfitWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      userId: "mock-user",
      name, slots,
      createdAt: new Date().toISOString(),
    });
  }
  return apiFetch<SavedOutfitWire>("/wardrobe/outfits", {
    method: "POST",
    body: { name, slots },
  });
}

export async function deleteOutfit(id: ID): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(`/wardrobe/outfits/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
