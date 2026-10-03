// ─────────────────────────────────────────────────────────────────────────────
// api/asset-library.ts — 短剧素材库（用户个人素材，真实后端）。
// 文件经 DramaAssetsApi.uploadAssetRef 落 OSS（返回 cdnKey）→ 用 cdnKey 调本模块建库记录。
// 后端：/api/me/drama/assets（GET 列表 / POST 建 / PUT 改 / DELETE 删；按用户隔离）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { Material } from "@/mocks/drama-workshop";
import { mockUrlForKey } from "./drama-assets";

// mock 模式下的会话内素材表：上传 → 列表里真能看到，改 / 删也真生效（此前 list 恒为空，上传完什么都看不到）。
let MOCK_ASSETS: Material[] = [];

export interface CreateAssetInput {
  name: string;
  cat: string;
  kind?: "image" | "video";
  cdnKey: string;
  tags?: string[];
}

export async function listAssets(): Promise<Material[]> {
  if (USE_MOCK) return mockDelay<Material[]>(MOCK_ASSETS.map((m) => ({ ...m })), 60);
  return apiFetch<Material[]>("/me/drama/assets");
}

export async function createAsset(input: CreateAssetInput): Promise<Material> {
  if (USE_MOCK) {
    const m: Material = {
      id: "da_" + Date.now(),
      name: input.name,
      cat: input.cat,
      kind: input.kind ?? "image",
      from: "#f97316",
      to: "#e11d48",
      tags: input.tags ?? [],
      cdnKey: input.cdnKey,
      url: mockUrlForKey(input.cdnKey),
    };
    MOCK_ASSETS = [m, ...MOCK_ASSETS];
    return mockDelay<Material>({ ...m });
  }
  return apiFetch<Material>("/me/drama/assets", { method: "POST", body: input });
}

export async function updateAsset(
  id: string,
  patch: { name?: string; cat?: string; tags?: string[] },
): Promise<Material> {
  if (USE_MOCK) {
    MOCK_ASSETS = MOCK_ASSETS.map((m) => (m.id === id ? { ...m, ...patch } : m));
    const found = MOCK_ASSETS.find((m) => m.id === id);
    return mockDelay<Material>(found ? { ...found } : ({ id, ...patch } as unknown as Material));
  }
  return apiFetch<Material>(`/me/drama/assets/${id}`, { method: "PUT", body: patch });
}

export async function deleteAsset(id: string): Promise<void> {
  if (USE_MOCK) {
    MOCK_ASSETS = MOCK_ASSETS.filter((m) => m.id !== id);
    await mockDelay(undefined, 80);
    return;
  }
  await apiFetch<void>(`/me/drama/assets/${id}`, { method: "DELETE" });
}
