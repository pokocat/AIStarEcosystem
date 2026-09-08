// 媒体文件（视频 / 音频）存储 —— 顶替上游的 `services/file-storage.ts`。
// 与 image-storage 同一条纪律：落 OSS，storageKey 就是 OSS key，url 是派生的签名地址。

import { signKeys } from "./api";
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

// v0.179：**这里刻意没有 `uploadMediaFile`**（上游有，用来把视频 / 音频文件传进画布）。
//
// 事实是服务端 `POST /v1/ip-studio/uploads` 只收 JPG / PNG（`IpProjectService.UPLOAD_EXTS`，
// 连 WebP 都刻意不收 —— JDK 的 ImageIO 读不了它）。而画布里那几个入口是
// `void createVideoFileNode(...)` 这种没有 catch 的调用：用户拖个 mp4 进来，
// 界面上什么都不发生，只有控制台一条 unhandled rejection。
//
// 留一个「必然失败」的同名函数比删掉更糟：下一个人照着签名接上去，就又是一次静默失败。
// 产品上也不该为这件事放开后端上传范围 —— 画布的输入是**照片**，视频是**产出**：
// 成片由服务端镜像进我方存储，`storeGeneratedVideo` 直接引用那份 key，不走 `/uploads`；
// 用户自己传的 mp3 在本仓没有任何消费方（语音生成还没开通）。真要支持的那天，
// 它需要自己的一条上传端点 —— 大小 / 时长 / 转码 / 内容探测跟图片不是一回事。

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
