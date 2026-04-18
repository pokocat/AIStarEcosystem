// ─────────────────────────────────────────────────────────────────────────────
// api/wardrobe.ts — 服装资源管理
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem } from "@/types/wardrobe";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";

export async function listClothing(): Promise<ClothingItem[]> {
  if (USE_MOCK) return mockDelay(CLOTHING_DATABASE);
  return apiFetch<ClothingItem[]>("/admin/wardrobe/items");
}
