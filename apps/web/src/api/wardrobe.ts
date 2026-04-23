// ─────────────────────────────────────────────────────────────────────────────
// api/wardrobe.ts — 衣橱系统 API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem, EquipSlot, SavedOutfit } from "@/types/wardrobe";
import type { ID } from "@/types/_shared";
import type { ForgeResult } from "@/types/appearance-forge";
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

// ── 衣帽间 v2：装备搭配一键锻造 ─────────────────────────────────────────────
//
// 输入一套已装备的服饰，输出一张融合形象图（ForgeResult，status='draft'）。
// Response 复用 appearance-forge 的 ForgeResult，保存走 saveForgeResult()。
// 后端端点 POST /wardrobe/generate-look 暂未实现（见 FRONTEND_CONTRACT_DIFF.md）。

/** 锻造请求：slot → itemId；未装备的槽位留空。 */
export interface WardrobeLookRequest {
  artistId: ID;
  equipped: Partial<Record<EquipSlot, ID>>;
  /** 本次消耗的积分（前端展示与后端 ledger 对账都读这个字段）。 */
  costCredits: number;
}

/**
 * 根据当前装备生成一张融合形象图（轻量锻造）。
 * 只返回草稿结果，不入艺人形象库——入库交给 saveForgeResult()。
 * （一旦入库就会改变 listForgeHistory 的"空艺人合成种子形象"判定，
 *  所以"生成"阶段不落地，避免未保存的草稿挤掉艺人画廊的种子形象。）
 */
export async function generateLook(req: WardrobeLookRequest): Promise<ForgeResult> {
  if (USE_MOCK) {
    const equippedIds = Object.values(req.equipped).filter((id): id is ID => !!id);
    const equippedItems = CLOTHING_DATABASE.filter(item => equippedIds.includes(item.id));
    // 稀有度排序：legendary > epic > rare > common
    const rarityRank: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
    const hero = equippedItems.slice().sort(
      (a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0),
    )[0];
    const imageSource = hero?.imageUrl ?? CLOTHING_DATABASE[0]?.imageUrl ?? "";
    const promptParts = equippedItems.map(i => i.name);
    const result: ForgeResult = {
      id: `look-${Date.now()}`,
      artistId: req.artistId,
      image: imageSource,
      prompt: promptParts.length ? `衣帽间锻造：${promptParts.join(" / ")}` : "衣帽间锻造",
      mode: "random",
      createdAt: new Date().toISOString(),
      locked: [],
      status: "draft",
      usageCount: 0,
    };
    return mockDelay(result, 1800);
  }
  return apiFetch<ForgeResult>("/wardrobe/generate-look", {
    method: "POST",
    body: req,
  });
}
