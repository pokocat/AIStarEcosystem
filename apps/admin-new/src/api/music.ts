// ─────────────────────────────────────────────────────────────────────────────
// api/music.ts — 音乐资源管理：歌曲、专辑、演唱会、流派
// ─────────────────────────────────────────────────────────────────────────────

import type { Song, Album, Concert, MusicGenre } from "@/types/music";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { SONGS, ALBUMS, CONCERTS, MUSIC_GENRES } from "@/mocks/music";

export async function listSongs(): Promise<Song[]> {
  if (USE_MOCK) return mockDelay(SONGS);
  return apiFetch<Song[]>("/admin/music/songs");
}

export async function listAlbums(): Promise<Album[]> {
  if (USE_MOCK) return mockDelay(ALBUMS);
  return apiFetch<Album[]>("/admin/music/albums");
}

export async function listConcerts(): Promise<Concert[]> {
  if (USE_MOCK) return mockDelay(CONCERTS);
  return apiFetch<Concert[]>("/admin/music/concerts");
}

export async function listGenres(): Promise<MusicGenre[]> {
  if (USE_MOCK) return mockDelay(MUSIC_GENRES);
  return apiFetch<MusicGenre[]>("/admin/music/genres");
}
