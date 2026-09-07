// ─────────────────────────────────────────────────────────────────────────────
// 图片存储 —— 顶替上游的 `services/image-storage.ts`。
//
// 上游把图存在浏览器的 IndexedDB（localforage）里：它是单机工具，这么做合理。
// 本仓不行 —— 资产必须落 OSS（§4.7），DB 存 cdnKey、URL 出 wire 时派生：
//   · 存本地 = 换台电脑打开画布，图全没了
//   · 存本地 = 发布成数字资产时没有可引用的 key
//   · 存本地 = 名片引用这张图时拿不到地址
//
// 所以这里的 storageKey 就是 **OSS key**（服务端的真值），url 是当次派生的签名地址。
// 签名有 TTL，所以还有个 resolveImageUrl 负责过期后重新换一张。
// ─────────────────────────────────────────────────────────────────────────────

import { signKeys, uploadImage as uploadToOss } from "./api";

export type UploadedImage = {
  url: string;
  storageKey?: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
};

export type ImageReadOptions = { signal?: AbortSignal };

/** 进程内的签名地址缓存：同一个 key 在一次会话里反复要地址，不必每次都问服务端。 */
const signedCache = new Map<string, { url: string; at: number }>();
/** 比服务端 TTL（默认 1 小时）短一截就主动换新的 —— 别等到用户看见破图。 */
const SIGN_TTL_MS = 40 * 60_000;

function remember(key: string, url: string) {
  signedCache.set(key, { url, at: Date.now() });
  return url;
}

async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== "function") return { width: 0, height: 0 };
  try {
    const bmp = await createImageBitmap(blob);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    return out;
  } catch {
    // 拿不到尺寸不影响上传，画布会按自然尺寸兜底
    return { width: 0, height: 0 };
  }
}

async function toBlob(input: string | Blob): Promise<Blob> {
  if (typeof input !== "string") return input;
  const res = await fetch(input);
  if (!res.ok) throw new Error(`读取图片失败（${res.status}）`);
  return res.blob();
}

/**
 * 已经在 OSS 上的图 —— 生成层出图后登记在这儿。
 *
 * 画布的流程是「拿到图 → 调 uploadImage 存起来」，而我们的图出生就在 OSS 上。
 * 不记这一笔的话，每张成图都会被下载回来再原样传一遍：多一个来回、多一份对象、多一份钱。
 */
const alreadyUploaded = new Map<string, UploadedImage>();
export function rememberUploaded(url: string, record: UploadedImage) {
  alreadyUploaded.set(url, record);
  if (record.storageKey) remember(record.storageKey, record.url);
}

/** 上传一张图到 OSS。入参可以是 Blob，也可以是 dataURL / 远程地址。 */
export async function uploadImage(input: string | Blob, _options?: ImageReadOptions): Promise<UploadedImage> {
  if (typeof input === "string") {
    const known = alreadyUploaded.get(input);
    if (known) return known;   // 服务端刚生成的图，别再传一遍
  }
  const blob = await toBlob(input);
  const { width, height } = await measure(blob);
  const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const res = await uploadToOss(blob, `canvas-${Date.now()}.${ext}`);
  remember(res.key, res.url);
  return {
    url: res.url,
    storageKey: res.key,
    width: res.width ?? width,
    height: res.height ?? height,
    bytes: blob.size,
    mimeType: blob.type || "image/png",
  };
}

/**
 * key → 可用的图片地址。
 *
 * 缓存过期就回服务端重签。签不出来时**返回 fallback 而不是空串** ——
 * 空串会让 img 标签渲染成破图图标，用户以为图丢了；保留旧地址至少还有机会命中浏览器缓存。
 */
export async function resolveImageUrl(storageKey?: string, fallback = ""): Promise<string> {
  if (!storageKey) return fallback;
  const hit = signedCache.get(storageKey);
  if (hit && Date.now() - hit.at < SIGN_TTL_MS) return hit.url;
  try {
    const map = await signKeys([storageKey]);
    const url = map[storageKey];
    if (url) return remember(storageKey, url);
  } catch {
    // 网络抖动不该让画布上的图消失
  }
  return fallback;
}

/** 批量重签 —— 画布一次要几十张图，逐张问服务端太浪费。 */
export async function resolveImageUrls(keys: string[]): Promise<Record<string, string>> {
  const missing = keys.filter((k) => {
    const hit = signedCache.get(k);
    return !hit || Date.now() - hit.at >= SIGN_TTL_MS;
  });
  if (missing.length) {
    try {
      const map = await signKeys(missing);
      Object.entries(map).forEach(([k, u]) => remember(k, u));
    } catch {
      /* 同上 */
    }
  }
  const out: Record<string, string> = {};
  for (const k of keys) {
    const hit = signedCache.get(k);
    if (hit) out[k] = hit.url;
  }
  return out;
}

export async function getImageBlob(storageKey: string): Promise<Blob | null> {
  const url = await resolveImageUrl(storageKey);
  if (!url) return null;
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** 给需要 base64 的地方（裁剪 / 蒙版编辑）用。 */
export async function imageToDataUrl(
  image: { url?: string; dataUrl?: string; storageKey?: string },
  _options?: ImageReadOptions,
): Promise<string> {
  if (image.dataUrl) return image.dataUrl;
  const src = image.storageKey ? await resolveImageUrl(image.storageKey, image.url ?? "") : image.url;
  if (!src) throw new Error("这张图读不出来");
  const blob = await toBlob(src);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

/**
 * 上游在这里清理 IndexedDB 里没人用的图。本仓**刻意不做**：
 * 资产在 OSS 上，生命周期由服务端管 —— 让浏览器去删云上的文件，
 * 一个误判就是用户的图没了，而且删了不可逆。
 */
export async function cleanupUnusedImages(_usedData: unknown): Promise<void> {
  /* no-op：见上 */
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value) return keys;
  if (Array.isArray(value)) {
    value.forEach((v) => collectImageStorageKeys(v, keys));
    return keys;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "storageKey" && typeof v === "string" && v) keys.add(v);
      else collectImageStorageKeys(v, keys);
    }
  }
  return keys;
}

export async function setImageBlob(_storageKey: string, _blob: Blob): Promise<void> {
  /* 本仓的图都在 OSS 上，没有「写本地某个 key」这回事 */
}

export async function deleteStoredImages(_keys: Iterable<string>): Promise<void> {
  /* 同 cleanupUnusedImages：删云上文件不由前端发起 */
}
