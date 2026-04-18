// ─────────────────────────────────────────────────────────────────────────────
// api/film.ts — 影视资源管理：电视剧、电影、广告、配音作品
// ─────────────────────────────────────────────────────────────────────────────

import type { Drama, Movie, Advertisement, VoiceWork } from "@/types/film";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";

export async function listDramas(): Promise<Drama[]> {
  if (USE_MOCK) return mockDelay(DRAMAS);
  return apiFetch<Drama[]>("/admin/film/dramas");
}

export async function listMovies(): Promise<Movie[]> {
  if (USE_MOCK) return mockDelay(MOVIES);
  return apiFetch<Movie[]>("/admin/film/movies");
}

export async function listAds(): Promise<Advertisement[]> {
  if (USE_MOCK) return mockDelay(ADS);
  return apiFetch<Advertisement[]>("/admin/film/ads");
}

export async function listVoiceWorks(): Promise<VoiceWork[]> {
  if (USE_MOCK) return mockDelay(VOICE_WORKS);
  return apiFetch<VoiceWork[]>("/admin/film/voice-works");
}
