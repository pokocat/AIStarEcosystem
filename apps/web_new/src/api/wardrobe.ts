// ─────────────────────────────────────────────────────────────────────────────
// api/wardrobe.ts — 衣橱系统 API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem } from "@/types/wardrobe";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listClothing(): Promise<ClothingItem[]> {
  if (USE_MOCK) return mockDelay(CLOTHING_DATABASE);
  return apiFetch<ClothingItem[]>("/wardrobe/items");
}
