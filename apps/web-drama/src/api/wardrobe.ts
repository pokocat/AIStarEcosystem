// ─────────────────────────────────────────────────────────────────────────────
// api/wardrobe.ts — 衣橱系统 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/wardrobe.ts 拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem, EquipSlot } from "@ai-star-eco/types/wardrobe";
import type { ID } from "@ai-star-eco/types/_shared";
import type { ForgeResult } from "@ai-star-eco/types/appearance-forge";
import { apiFetch } from "./_client";

export async function listClothing(): Promise<ClothingItem[]> {
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
  return apiFetch<SavedOutfitWire[]>("/wardrobe/outfits");
}

export async function saveOutfit(name: string, slots: Record<string, string>): Promise<SavedOutfitWire> {
  return apiFetch<SavedOutfitWire>("/wardrobe/outfits", {
    method: "POST",
    body: { name, slots },
  });
}

export async function deleteOutfit(id: ID): Promise<void> {
  await apiFetch<void>(`/wardrobe/outfits/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── 衣帽间 v2：装备搭配一键锻造 ─────────────────────────────────────────────

/** 锻造请求：slot → itemId；未装备的槽位留空。 */
export interface WardrobeLookRequest {
  artistId: ID;
  equipped: Partial<Record<EquipSlot, ID>>;
  /** 本次消耗的积分。 */
  costCredits: number;
}

/**
 * 根据当前装备生成一张融合形象图（轻量锻造，仅返回草稿，不入艺人形象库）。
 * 入库交给 saveForgeResult()。
 */
export async function generateLook(req: WardrobeLookRequest): Promise<ForgeResult> {
  return apiFetch<ForgeResult>("/wardrobe/generate-look", {
    method: "POST",
    body: req,
  });
}
