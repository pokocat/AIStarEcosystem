// ─────────────────────────────────────────────────────────────────────────────
// api/artists.ts — 艺人领域 API 封装。
// USE_MOCK=1 时返回 mocks/artists.ts；否则走 apiFetch。
// ─────────────────────────────────────────────────────────────────────────────

import type { Artist } from "@/types/artist";
import type { ID } from "@/types/_shared";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listArtists(): Promise<Artist[]> {
  if (USE_MOCK) return mockDelay(MOCK_ARTISTS);
  return apiFetch<Artist[]>("/artists");
}

export async function getArtist(id: ID): Promise<Artist | null> {
  if (USE_MOCK) {
    return mockDelay(MOCK_ARTISTS.find((a) => a.id === id) ?? null);
  }
  return apiFetch<Artist | null>(`/artists/${encodeURIComponent(id)}`);
}
