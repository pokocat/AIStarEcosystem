// ─────────────────────────────────────────────────────────────────────────────
// api/film.ts — 影视业务（短剧 / 电影 / 广告 / 配音）API 封装。
// USE_MOCK=1 时使用 mutable 内存缓存；后端真接通前 USE_MOCK=0 会抛 501。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Drama,
  DramaStatus,
  Movie,
  Advertisement,
  VoiceWork,
} from "@ai-star-eco/types/film";
import type { ID } from "@ai-star-eco/types/_shared";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import { apiFetch, USE_MOCK, mockDelay, clientError } from "./_client";

// 可变副本
const dramaStore: Drama[] = DRAMAS.map((d) => ({ ...d }));

// ── Drama ───────────────────────────────────────────────────────────────────

export async function listDramas(): Promise<Drama[]> {
  if (USE_MOCK) return mockDelay(dramaStore.map((d) => ({ ...d })));
  return apiFetch<Drama[]>("/film/dramas");
}

export async function getDrama(id: ID): Promise<Drama | null> {
  if (USE_MOCK) {
    const found = dramaStore.find((d) => d.id === id);
    return mockDelay(found ? { ...found } : null);
  }
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
  if (USE_MOCK) {
    const drama: Drama = {
      id: `d-${Date.now()}`,
      title: input.title,
      genre: input.genre,
      episodes: input.episodes,
      role: input.role,
      status: input.status ?? "casting",
      views: 0,
      revenue: 0,
      rating: 0,
      releaseDate: input.releaseDate,
    };
    dramaStore.unshift(drama);
    return mockDelay({ ...drama });
  }
  return apiFetch<Drama>("/film/dramas", { method: "POST", body: input });
}

export async function updateDramaStatus(id: ID, status: DramaStatus): Promise<Drama> {
  if (USE_MOCK) {
    const idx = dramaStore.findIndex((d) => d.id === id);
    if (idx < 0) throw clientError(`未找到剧集 ${id}`, 404, "drama.not_found");
    const updated: Drama = { ...dramaStore[idx]!, status };
    dramaStore[idx] = updated;
    return mockDelay({ ...updated });
  }
  return apiFetch<Drama>(`/film/dramas/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function patchDrama(id: ID, patch: Partial<Drama>): Promise<Drama> {
  if (USE_MOCK) {
    const idx = dramaStore.findIndex((d) => d.id === id);
    if (idx < 0) throw clientError(`未找到剧集 ${id}`, 404, "drama.not_found");
    const updated: Drama = { ...dramaStore[idx]!, ...patch, id };
    dramaStore[idx] = updated;
    return mockDelay({ ...updated });
  }
  return apiFetch<Drama>(`/film/dramas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteDrama(id: ID): Promise<void> {
  if (USE_MOCK) {
    const idx = dramaStore.findIndex((d) => d.id === id);
    if (idx >= 0) dramaStore.splice(idx, 1);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/film/dramas/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Movie / Ad / Voice (read-only stubs, 暂未启用 CRUD) ─────────────────────

export async function listMovies(): Promise<Movie[]> {
  if (USE_MOCK) return mockDelay(MOVIES);
  return apiFetch<Movie[]>("/film/movies");
}

export async function listAds(): Promise<Advertisement[]> {
  if (USE_MOCK) return mockDelay(ADS);
  return apiFetch<Advertisement[]>("/film/ads");
}

export async function listVoiceWorks(): Promise<VoiceWork[]> {
  if (USE_MOCK) return mockDelay(VOICE_WORKS);
  return apiFetch<VoiceWork[]>("/film/voice-works");
}
