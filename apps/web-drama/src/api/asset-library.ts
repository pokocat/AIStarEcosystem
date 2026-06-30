// ─────────────────────────────────────────────────────────────────────────────
// api/asset-library.ts — 短剧素材库（用户个人素材，真实后端）。
// 文件经 DramaAssetsApi.uploadAssetRef 落 OSS（返回 cdnKey）→ 用 cdnKey 调本模块建库记录。
// 后端：/api/me/drama/assets（GET 列表 / POST 建 / PUT 改 / DELETE 删；按用户隔离）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { Material } from "@/mocks/drama-workshop";

export interface CreateAssetInput {
  name: string;
  cat: string;
  kind?: "image" | "video";
  cdnKey: string;
  tags?: string[];
}

export async function listAssets(): Promise<Material[]> {
  if (USE_MOCK) return mockDelay<Material[]>([], 60);
  return apiFetch<Material[]>("/me/drama/assets");
}

export async function createAsset(input: CreateAssetInput): Promise<Material> {
  if (USE_MOCK) {
    return mockDelay<Material>({
      id: "da_" + Date.now(),
      name: input.name,
      cat: input.cat,
      kind: input.kind ?? "image",
      from: "#f97316",
      to: "#e11d48",
      tags: input.tags ?? [],
      cdnKey: input.cdnKey,
    });
  }
  return apiFetch<Material>("/me/drama/assets", { method: "POST", body: input });
}

export async function updateAsset(
  id: string,
  patch: { name?: string; cat?: string; tags?: string[] },
): Promise<Material> {
  if (USE_MOCK) return mockDelay<Material>({ id, ...patch } as unknown as Material);
  return apiFetch<Material>(`/me/drama/assets/${id}`, { method: "PUT", body: patch });
}

export async function deleteAsset(id: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined, 80);
    return;
  }
  await apiFetch<void>(`/me/drama/assets/${id}`, { method: "DELETE" });
}
