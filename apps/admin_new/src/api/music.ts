// ─────────────────────────────────────────────────────────────────────────────
// api/music.ts — 音乐资源管理：歌曲、专辑、演唱会、流派
// 注：当前审核策略为「默认通过并上架」，通过 / 驳回接口仍保留，
// 用于后台人工干预（应对违规内容下架）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Song, Album, Concert, MusicGenre } from "@/types/music";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { SONGS, ALBUMS, CONCERTS, MUSIC_GENRES } from "@/mocks/music";

export async function listSongs(): Promise<Song[]> {
  if (USE_MOCK) return mockDelay(SONGS);
  return apiFetch<Song[]>("/admin/music/songs");
}

export async function getSong(id: string): Promise<Song> {
  if (USE_MOCK) {
    const song = SONGS.find((s) => s.id === id);
    if (!song) throw new Error(`song not found: ${id}`);
    return mockDelay(song);
  }
  return apiFetch<Song>(`/admin/music/songs/${encodeURIComponent(id)}`);
}

export interface SongActionPayload {
  /** 操作原因（写入审计日志） */
  reason?: string;
}

/** 审核通过并发行。默认策略：新建曲目自动通过，此接口用于人工复核场景。 */
export async function approveSong(id: string, payload?: SongActionPayload): Promise<Song> {
  if (USE_MOCK) {
    const song = SONGS.find((s) => s.id === id);
    if (!song) throw new Error(`song not found: ${id}`);
    // 本地就地变更，便于页面刷新后状态一致
    song.status = "released";
    song.releaseDate = song.releaseDate ?? new Date().toISOString();
    return mockDelay(song);
  }
  return apiFetch<Song>(`/admin/music/songs/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: payload ?? {},
  });
}

/** 驳回并下架（需填写原因）。 */
export async function rejectSong(id: string, payload: SongActionPayload): Promise<Song> {
  if (USE_MOCK) {
    const song = SONGS.find((s) => s.id === id);
    if (!song) throw new Error(`song not found: ${id}`);
    song.status = "mixing";
    song.releaseDate = undefined;
    return mockDelay(song);
  }
  return apiFetch<Song>(`/admin/music/songs/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: payload,
  });
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
