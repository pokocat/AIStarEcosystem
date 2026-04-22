// ─────────────────────────────────────────────────────────────────────────────
// api/wardrobe.ts — 服装资源管理
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem } from "@/types/wardrobe";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";

export async function listClothing(): Promise<ClothingItem[]> {
  if (USE_MOCK) return mockDelay(CLOTHING_DATABASE);
  // 复用 user-side read 端点；admin 通过 ROLE 网关仍可访问 `/api/wardrobe/items`
  return apiFetch<ClothingItem[]>("/wardrobe/items");
}
