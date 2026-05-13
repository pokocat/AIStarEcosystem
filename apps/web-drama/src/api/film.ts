// ─────────────────────────────────────────────────────────────────────────────
// api/film.ts — 影视业务（短剧 / 电影 / 广告 / 配音）API 封装。
// 注意：OpenAPI 尚未覆盖本域，真实后端上线前仅建议使用 mock 数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { Drama, Movie, Advertisement, VoiceWork } from "@ai-star-eco/types/film";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listDramas(): Promise<Drama[]> {
  if (USE_MOCK) return mockDelay(DRAMAS);
  return apiFetch<Drama[]>("/film/dramas");
}

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
