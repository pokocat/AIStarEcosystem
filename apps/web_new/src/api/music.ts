// ─────────────────────────────────────────────────────────────────────────────
// api/music.ts — 音乐业务（歌曲 / 专辑 / 演唱会）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { Song, Album, Concert, MusicGenre } from "@/types/music";
import { SONGS, ALBUMS, CONCERTS, MUSIC_GENRES } from "@/mocks/music";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listSongs(): Promise<Song[]> {
  if (USE_MOCK) return mockDelay(SONGS);
  return apiFetch<Song[]>("/music/songs");
}

export async function listAlbums(): Promise<Album[]> {
  if (USE_MOCK) return mockDelay(ALBUMS);
  return apiFetch<Album[]>("/music/albums");
}

export async function listConcerts(): Promise<Concert[]> {
  if (USE_MOCK) return mockDelay(CONCERTS);
  return apiFetch<Concert[]>("/music/concerts");
}

export async function listGenres(): Promise<MusicGenre[]> {
  if (USE_MOCK) return mockDelay(MUSIC_GENRES);
  return apiFetch<MusicGenre[]>("/music/genres");
}
