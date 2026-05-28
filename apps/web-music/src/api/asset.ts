// ─────────────────────────────────────────────────────────────────────────────
// api/asset.ts — 数字资产库 API。
// 真后端：GET /api/me/assets / POST /api/me/assets / DELETE /api/me/assets/{id}
// 上传走 multipart（与 wardrobe 上传同模式），MVP mock 直接合成记录。
// ─────────────────────────────────────────────────────────────────────────────

import type { Asset, AssetUploadInput } from "@ai-star-eco/types/asset";
import type { ID } from "@ai-star-eco/types/_shared";
import { ASSETS } from "@/mocks/asset";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listAssets(): Promise<Asset[]> {
  if (USE_MOCK) return mockDelay(ASSETS);
  return apiFetch<Asset[]>("/me/assets");
}

export async function uploadAsset(input: AssetUploadInput): Promise<Asset> {
  if (USE_MOCK) {
    const id = `ast-${Date.now()}`;
    const asset: Asset = {
      id,
      title: input.title,
      type: input.type,
      status: "reviewing",
      authStatus: "authorized",
      partnerName: input.partnerName,
      duration: input.duration,
      versions: 1,
      usageCount: 0,
      thumbColor: "#a855f7",
      tags: input.tags,
      uploadDate: new Date().toISOString().slice(0, 10),
      fileSize: input.fileSize,
      resolution: input.resolution,
    };
    ASSETS.unshift(asset);
    return mockDelay(asset, 400);
  }
  return apiFetch<Asset>("/me/assets", { method: "POST", body: input });
}

/** 冻结素材（授权过期或合作方申诉时）。 */
export async function freezeAsset(id: ID): Promise<Asset> {
  if (USE_MOCK) {
    const a = ASSETS.find(x => x.id === id);
    if (!a) throw new Error(`asset not found: ${id}`);
    a.status = "frozen";
    return mockDelay(a, 200);
  }
  return apiFetch<Asset>(`/me/assets/${encodeURIComponent(id)}/freeze`, { method: "POST" });
}
