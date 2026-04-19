// ─────────────────────────────────────────────────────────────────────────────
// api/music.ts — 音乐业务（歌曲 / 歌单 / 演唱会）API 封装。
// 见 product_spec.md §10.6：创作主动脉 = createSong → advanceSongStatus。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Song, Album, Concert, MusicGenre, MusicTrendPoint,
  CreateSongRequest, SongStatus,
} from "@/types/music";
import type { ID } from "@/types/_shared";
import { SONGS, ALBUMS, CONCERTS, MUSIC_GENRES, MUSIC_TRENDS_30D } from "@/mocks/music";
import {
  previewAudioForId,
  mockCreditsFor,
} from "@/constants/music-ui";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listSongs(): Promise<Song[]> {
  if (USE_MOCK) return mockDelay(SONGS);
  return apiFetch<Song[]>("/me/songs");
}

export async function listAlbums(): Promise<Album[]> {
  if (USE_MOCK) return mockDelay(ALBUMS);
  return apiFetch<Album[]>("/me/albums");
}

export async function listConcerts(): Promise<Concert[]> {
  if (USE_MOCK) return mockDelay(CONCERTS);
  return apiFetch<Concert[]>("/me/concerts");
}

export async function listGenres(): Promise<MusicGenre[]> {
  if (USE_MOCK) return mockDelay(MUSIC_GENRES);
  return apiFetch<MusicGenre[]>("/music/genres");
}

/** 近 30 天音乐业务趋势（播放 / 收入）。 */
export async function listTrends30d(): Promise<MusicTrendPoint[]> {
  if (USE_MOCK) return mockDelay(MUSIC_TRENDS_30D);
  return apiFetch<MusicTrendPoint[]>("/me/music/trends?range=30d");
}

/**
 * 创建 AI 歌曲。artistId 必填（见 product_spec.md §10.1）。
 * mock 模式：合成一条 recording 状态的新歌，creditsSpent 由 mockCreditsFor 产出。
 * 后端：按 modelVersion + thinkDepth 查工作流计费表扣 credits（§10.3）。
 */
export async function createSong(req: CreateSongRequest): Promise<Song> {
  if (USE_MOCK) {
    const id = `s-${Date.now()}`;
    const song: Song = {
      id,
      title: req.title,
      genre: req.genre,
      duration: req.duration ?? 180,
      status: "recording",
      plays: 0,
      revenue: 0,
      rating: 0,
      artistId: req.artistId,
      audioUrl: previewAudioForId(id),
      lyrics: req.lyrics,
      modelVersion: req.modelVersion,
      thinkDepth: req.thinkDepth,
      creditsSpent: mockCreditsFor(req.modelVersion, req.thinkDepth),
      createdAt: new Date().toISOString(),
    };
    return mockDelay(song, 400);
  }
  return apiFetch<Song>("/me/songs", { method: "POST", body: req });
}

/**
 * 更新歌曲（封面 / 歌词 / 曲风 / 标题）。仅允许作者本人操作。
 * mock 模式：就地改 SONGS（同进程可见）并返回 patched 对象。
 */
export async function updateSong(id: ID, patch: Partial<Song>): Promise<Song> {
  if (USE_MOCK) {
    const existing = SONGS.find(s => s.id === id);
    if (!existing) throw new Error(`song not found: ${id}`);
    Object.assign(existing, patch);
    return mockDelay(existing, 300);
  }
  return apiFetch<Song>(`/me/songs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

/**
 * 推进歌曲状态机：recording → mixing → released。
 * mock 模式仅返回新状态的 Song；真实后端可能再次扣费（MVP 不扣）。
 */
export async function advanceSongStatus(id: ID, next: SongStatus): Promise<Song> {
  if (USE_MOCK) {
    const existing = SONGS.find(s => s.id === id);
    if (!existing) throw new Error(`song not found: ${id}`);
    const updated: Song = {
      ...existing,
      status: next,
      releaseDate: next === "released" ? new Date().toISOString() : existing.releaseDate,
    };
    return mockDelay(updated, 300);
  }
  return apiFetch<Song>(`/me/songs/${encodeURIComponent(id)}/advance`, {
    method: "POST",
    body: { status: next },
  });
}
