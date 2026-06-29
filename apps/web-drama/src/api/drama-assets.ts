// ─────────────────────────────────────────────────────────────────────────────
// api/drama-assets.ts — 短剧素材库上传（v0.89）。
// 角色 / 场景「上传参考图」：multipart 上传到 OSS，返回 cdnKey + 稳定 URL；
// 调用方把它落到角色 / 场景 ref，并收进用户素材库（addLibraryMaterial）。
// 后端：POST /api/me/drama/assets/uploads（DramaAssetUploadController）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export interface UploadedAssetRef {
  cdnKey: string;
  url: string;
  cat: string;
  name: string;
}

/** 上传一张参考图（角色 / 场景）。cat ∈ 人物 / 场景 / 道具 / 其他。 */
export async function uploadAssetRef(file: File, cat: string): Promise<UploadedAssetRef> {
  if (USE_MOCK) {
    return mockDelay({ cdnKey: `mock/asset-refs/${Date.now()}`, url: URL.createObjectURL(file), cat, name: file.name || "参考图" });
  }
  const form = new FormData();
  form.append("file", file);
  form.append("cat", cat);
  return apiFetch<UploadedAssetRef>("/me/drama/assets/uploads", { method: "POST", body: form });
}
