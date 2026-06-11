// ─────────────────────────────────────────────────────────────────────────────
// api/artists.ts — 艺人领域 API（network-only）。
// USE_MOCK 模式下由 src/mocks/_handlers/artists.ts 在 apiFetch 网络层拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { Artist, ImportAvatarRequest } from "@ai-star-eco/types/artist";
import type { ID } from "@ai-star-eco/types/_shared";
import { apiFetch } from "./_client";

export async function listArtists(): Promise<Artist[]> {
  return apiFetch<Artist[]>("/me/digital-ips");
}

export async function getArtist(id: ID): Promise<Artist | null> {
  return apiFetch<Artist | null>(`/me/digital-ips/${encodeURIComponent(id)}`);
}

export async function createArtist(data: Partial<Artist>): Promise<Artist> {
  return apiFetch<Artist>("/me/digital-ips", { method: "POST", body: data });
}

/**
 * v0.60 收敛：从 AiAvatar 引入数字人为演员（引用不复制，不扣孵化积分）。
 * 形象与展示名实时跟随数字人；展示图可用 dapDisplayRef 指定（缺省跟随定妆照）。
 */
export async function importAvatarAsArtist(req: ImportAvatarRequest): Promise<Artist> {
  return apiFetch<Artist>("/me/digital-ips/import-avatar", { method: "POST", body: req });
}

export async function updateArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, { method: "PUT", body: data });
}

export async function patchArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, { method: "PATCH", body: data });
}

export async function archiveArtist(id: ID): Promise<Artist> {
  return updateArtist(id, { status: "retired" } as Partial<Artist>);
}

export async function activateArtist(id: ID): Promise<Artist> {
  return updateArtist(id, { status: "active" } as Partial<Artist>);
}

export async function deleteArtist(id: ID): Promise<void> {
  await apiFetch<void>(`/me/digital-ips/${encodeURIComponent(id)}`, { method: "DELETE" });
}
