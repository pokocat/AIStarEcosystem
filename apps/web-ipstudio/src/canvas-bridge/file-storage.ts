// 媒体文件（视频 / 音频）存储 —— 顶替上游的 `services/file-storage.ts`。
// 与 image-storage 同一条纪律：落 OSS，storageKey 就是 OSS key，url 是派生的签名地址。

import { signKeys, uploadImage as uploadToOss } from "./api";
import { resolveImageUrl } from "./image-storage";

export type UploadedFile = {
  url: string;
  storageKey: string;
  bytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
};

export async function uploadMediaFile(input: string | Blob, prefix = "file"): Promise<UploadedFile> {
  const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
  const ext = (blob.type.split("/")[1] || "bin").split(";")[0];
  const res = await uploadToOss(blob, `${prefix}-${Date.now()}.${ext}`);
  return {
    url: res.url,
    storageKey: res.key,
    bytes: blob.size,
    mimeType: blob.type || "application/octet-stream",
    width: res.width,
    height: res.height,
  };
}

export const resolveMediaUrl = (storageKey?: string, fallback = "") => resolveImageUrl(storageKey, fallback);

export async function getMediaBlob(storageKey: string): Promise<Blob | null> {
  const url = await resolveMediaUrl(storageKey);
  if (!url) return null;
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

export async function setMediaBlob(_storageKey: string, _blob: Blob): Promise<void> {}

/** 删云上文件不由前端发起 —— 一个误判就是用户的素材没了，且不可逆。 */
export async function deleteStoredMedia(_keys: Iterable<string>): Promise<void> {}
export async function cleanupUnusedMedia(_usedData: unknown): Promise<void> {}

export function collectMediaStorageKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value) return keys;
  if (Array.isArray(value)) {
    value.forEach((v) => collectMediaStorageKeys(v, keys));
    return keys;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "storageKey" && typeof v === "string" && v) keys.add(v);
      else collectMediaStorageKeys(v, keys);
    }
  }
  return keys;
}

/** 保留导出以对齐上游签名，避免改动那些调用点。 */
export { signKeys };
