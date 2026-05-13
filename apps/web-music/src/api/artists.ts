// ─────────────────────────────────────────────────────────────────────────────
// api/artists.ts — 艺人领域 API 封装。
// 用户侧端点：/api/me/digital-ips
// USE_MOCK=1 时返回 mocks/artists.ts；否则走 apiFetch。
// ─────────────────────────────────────────────────────────────────────────────

import type { Artist } from "@ai-star-eco/types/artist";
import type { ID } from "@ai-star-eco/types/_shared";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/** 列出当前用户名下的所有 Digital IP */
export async function listArtists(): Promise<Artist[]> {
  if (USE_MOCK) return mockDelay(MOCK_ARTISTS);
  return apiFetch<Artist[]>("/me/digital-ips");
}

/** 查询单个艺人详情 */
export async function getArtist(id: ID): Promise<Artist | null> {
  if (USE_MOCK) {
    return mockDelay(MOCK_ARTISTS.find((a) => a.id === id) ?? null);
  }
  return apiFetch<Artist | null>(`/me/digital-ips/${encodeURIComponent(id)}`);
}

/** 创建新艺人。后端会基于 Principal 自动绑定 ownerUserId。 */
export async function createArtist(data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) {
    const fake: Artist = {
      ...MOCK_ARTISTS[0],
      ...data,
      id: `mock-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    } as Artist;
    return mockDelay(fake);
  }
  return apiFetch<Artist>("/me/digital-ips", {
    method: "POST",
    body: data,
  });
}

/** 全量替换艺人（PUT） */
export async function updateArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) return mockDelay({ ...MOCK_ARTISTS[0], ...data, id } as Artist);
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}

/** 增量更新艺人（PATCH） */
export async function patchArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) return mockDelay({ ...MOCK_ARTISTS[0], ...data, id } as Artist);
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: data,
  });
}

/** 删除艺人 */
export async function deleteArtist(id: ID): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch<void>(`/me/digital-ips/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
