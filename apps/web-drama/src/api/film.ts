// ─────────────────────────────────────────────────────────────────────────────
// api/film.ts — 影视业务 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/film.ts 拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Drama,
  DramaStatus,
  Movie,
  Advertisement,
  VoiceWork,
} from "@ai-star-eco/types/film";
import type { ID } from "@ai-star-eco/types/_shared";
import { apiFetch } from "./_client";

// ── Drama ───────────────────────────────────────────────────────────────────

export async function listDramas(): Promise<Drama[]> {
  return apiFetch<Drama[]>("/film/dramas");
}

export async function getDrama(id: ID): Promise<Drama | null> {
  return apiFetch<Drama | null>(`/film/dramas/${encodeURIComponent(id)}`);
}

export interface CreateDramaInput {
  title: string;
  genre: string;
  episodes: number;
  role: string;
  status?: DramaStatus;
  releaseDate?: string;
}

export async function createDrama(input: CreateDramaInput): Promise<Drama> {
  return apiFetch<Drama>("/film/dramas", { method: "POST", body: input });
}

export async function updateDramaStatus(id: ID, status: DramaStatus): Promise<Drama> {
  return apiFetch<Drama>(`/film/dramas/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function patchDrama(id: ID, patch: Partial<Drama>): Promise<Drama> {
  return apiFetch<Drama>(`/film/dramas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteDrama(id: ID): Promise<void> {
  await apiFetch<void>(`/film/dramas/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Movie / Ad / Voice (read-only stubs) ────────────────────────────────────

export async function listMovies(): Promise<Movie[]> {
  return apiFetch<Movie[]>("/film/movies");
}

export async function listAds(): Promise<Advertisement[]> {
  return apiFetch<Advertisement[]>("/film/ads");
}

export async function listVoiceWorks(): Promise<VoiceWork[]> {
  return apiFetch<VoiceWork[]>("/film/voice-works");
}
