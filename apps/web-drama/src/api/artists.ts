// ─────────────────────────────────────────────────────────────────────────────
// api/artists.ts — 艺人领域 API 封装。
// USE_MOCK=1 时使用 mutable 内存缓存（页面内 CRUD 立即反映到后续 list）；
// USE_MOCK=0 走 apiFetch（后端尚未上线，会返回 501）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Artist } from "@ai-star-eco/types/artist";
import type { ID } from "@ai-star-eco/types/_shared";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { apiFetch, USE_MOCK, mockDelay, clientError } from "./_client";

// 可变副本：深拷贝种子；create/update/delete 直接改 store。
const store: Artist[] = MOCK_ARTISTS.map((a) => JSON.parse(JSON.stringify(a)));

/** 列出当前用户名下的所有 Digital IP */
export async function listArtists(): Promise<Artist[]> {
  if (USE_MOCK) return mockDelay(store.map((a) => ({ ...a })));
  return apiFetch<Artist[]>("/me/digital-ips");
}

/** 查询单个艺人详情 */
export async function getArtist(id: ID): Promise<Artist | null> {
  if (USE_MOCK) {
    const found = store.find((a) => a.id === id);
    return mockDelay(found ? { ...found } : null);
  }
  return apiFetch<Artist | null>(`/me/digital-ips/${encodeURIComponent(id)}`);
}

/** 创建新艺人。 */
export async function createArtist(data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) {
    const seed = store[0]!;
    const now = new Date().toISOString();
    const artist: Artist = {
      ...seed,
      ...data,
      id: data.id ?? `art-${Date.now()}`,
      stats: { ...seed.stats, ...(data.stats ?? {}) },
      talents: { ...seed.talents, ...(data.talents ?? {}) },
      createdAt: now,
      lastActive: now,
    } as Artist;
    store.unshift(artist);
    return mockDelay({ ...artist });
  }
  return apiFetch<Artist>("/me/digital-ips", { method: "POST", body: data });
}

/** 全量替换艺人（PUT） */
export async function updateArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) {
    const idx = store.findIndex((a) => a.id === id);
    if (idx < 0) throw clientError(`未找到艺人 ${id}`, 404, "drama.not_found");
    const updated: Artist = { ...store[idx]!, ...data, id } as Artist;
    store[idx] = updated;
    return mockDelay({ ...updated });
  }
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, { method: "PUT", body: data });
}

/** 增量更新艺人（PATCH） */
export async function patchArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) return updateArtist(id, data);
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, { method: "PATCH", body: data });
}

/** 归档：status -> retired */
export async function archiveArtist(id: ID): Promise<Artist> {
  return updateArtist(id, { status: "retired" } as Partial<Artist>);
}

/** 重新上线：status -> active */
export async function activateArtist(id: ID): Promise<Artist> {
  return updateArtist(id, { status: "active" } as Partial<Artist>);
}

/** 删除艺人 */
export async function deleteArtist(id: ID): Promise<void> {
  if (USE_MOCK) {
    const idx = store.findIndex((a) => a.id === id);
    if (idx >= 0) store.splice(idx, 1);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/digital-ips/${encodeURIComponent(id)}`, { method: "DELETE" });
}
