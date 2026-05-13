// ─────────────────────────────────────────────────────────────────────────────
// api/config.ts — 平台可配置项读取器。
// 对应后端 /api/config/{key}（公开读，permitAll）。
// 业务用法：getConfig<FaceStyle[]>("incubation.faceStyles", FALLBACK_FACE_STYLES)。
// 后端返回形如 { key, value, version, description, updatedAt, updatedBy }，
// 本模块只吐出 value；在内存里按 key 缓存一份（LRU 不需要，key 是有限枚举）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK } from "./_client";

export interface PlatformConfigEnvelope<T> {
  key: string;
  value: T;
  version: number;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

// 本模块内存缓存；SSR 每次新实例，浏览器单页缓存整个会话。
const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

/**
 * 读取平台配置；fetch 失败或 USE_MOCK=1 时返回 fallback。
 * 永远 resolve — 不抛错。
 */
export async function getConfig<T>(key: string, fallback: T): Promise<T> {
  if (USE_MOCK) return fallback;
  if (cache.has(key)) return cache.get(key) as T;
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const p = apiFetch<PlatformConfigEnvelope<T>>(`/config/${encodeURIComponent(key)}`)
    .then(env => {
      const v = env?.value;
      // 后端返回的 value 可能是 null（未 seed）——此时仍用 fallback
      const resolved = (v === null || v === undefined) ? fallback : v;
      cache.set(key, resolved);
      return resolved;
    })
    .catch(() => fallback)
    .finally(() => { pending.delete(key); });

  pending.set(key, p);
  return p as Promise<T>;
}

/** 强制失效缓存（管理端改完 config 后可以通知前端）。 */
export function invalidateConfig(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
