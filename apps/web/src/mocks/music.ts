// ─────────────────────────────────────────────────────────────────────────────
// mocks/music.ts — 歌曲 / 歌单 / 演唱会 样本数据。
// 每首 Song 必须绑定 artistId（见 product_spec.md §10.1）。
// audioUrl 为 mock 占位，后续迁 OSS。
// ─────────────────────────────────────────────────────────────────────────────

import type { Song, Album, Concert, MusicGenre, MusicTrendPoint } from "@/types/music";
import { PLACEHOLDER_AUDIO_URL } from "@/constants/music-ui";

export const SONGS: Song[] = [
  {
    id: "s-1",
    title: "霓虹之夜",
    genre: "EDM",
    duration: 245,
    status: "released",
    plays: 582_000,
    revenue: 18_600,
    rating: 4.8,
    releaseDate: "2026-03-15T00:00:00Z",
    artistId: "1",
    audioUrl: PLACEHOLDER_AUDIO_URL,
    coverUrl: "https://images.unsplash.com/photo-1614149162883-504ce7dc5b73?w=400",
    modelVersion: "suno-v3",
    thinkDepth: "standard",
    creditsSpent: 80,
    createdAt: "2026-02-20T08:00:00Z",
  },
  {
    id: "s-2",
    title: "星光漫步",
    genre: "Pop",
    duration: 203,
    status: "released",
    plays: 423_000,
    revenue: 12_900,
    rating: 4.6,
    releaseDate: "2026-03-20T00:00:00Z",
    artistId: "2",
    audioUrl: PLACEHOLDER_AUDIO_URL,
    coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
    modelVersion: "suno-v3",
    thinkDepth: "fast",
    creditsSpent: 60,
    createdAt: "2026-03-01T08:00:00Z",
  },
  {
    id: "s-3",
    title: "午夜电波",
    genre: "Electronic",
    duration: 198,
    status: "mixing",
    plays: 0,
    revenue: 0,
    rating: 0,
    artistId: "1",
    audioUrl: PLACEHOLDER_AUDIO_URL,
    modelVersion: "suno-v3-deep",
    thinkDepth: "deep",
    creditsSpent: 230,
    createdAt: "2026-04-10T08:00:00Z",
  },
];

export const ALBUMS: Album[] = [
  {
    id: "al-1",
    name: "赛博梦境精选",
    cover: "https://images.unsplash.com/photo-1614149162883-504ce7dc5b73?w=400",
    artistId: "1",
    trackIds: ["s-1", "s-3"],
    createdAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "al-2",
    name: "Luna 甜蜜合辑",
    cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
    artistId: "2",
    trackIds: ["s-2"],
    createdAt: "2026-03-25T00:00:00Z",
  },
];

export const CONCERTS: Concert[] = [
  {
    id: "c-1",
    name: "霓虹之夜线上直播",
    artistIds: ["1"],
    date: "2026-06-20T12:00:00Z",
    status: "planning",
  },
];

export const MUSIC_GENRES: MusicGenre[] = [
  { id: "pop",       name: "Pop",       icon: "🎵", color: "pink" },
  { id: "rock",      name: "Rock",      icon: "🎸", color: "red" },
  { id: "edm",       name: "EDM",       icon: "⚡", color: "purple" },
  { id: "hiphop",    name: "Hip-Hop",   icon: "🎤", color: "yellow" },
  { id: "classical", name: "古风",      icon: "🎻", color: "cyan" },
  { id: "jazz",      name: "Jazz",      icon: "🎺", color: "orange" },
];

/**
 * 近 30 天音乐业务趋势占位数据。实现后端时：按 song.releaseDate / plays / revenue 的
 * 时序事件表聚合产出（GET /me/music/trends?range=30d）。
 */
function genTrends(): MusicTrendPoint[] {
  const out: MusicTrendPoint[] = [];
  const now = new Date("2026-04-18T00:00:00Z").getTime();
  const DAY = 86400000;
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now - i * DAY);
    // 合成波动：基线 + 周内升降 + 轻微噪声
    const weekday = t.getUTCDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.25 : 1;
    const base = 12_000 + (29 - i) * 800;
    const plays = Math.round(base * weekendBoost * (0.85 + Math.random() * 0.3));
    const revenue = Math.round(plays * (0.04 + Math.random() * 0.015));
    out.push({
      date: t.toISOString().slice(0, 10),
      plays,
      revenue,
    });
  }
  return out;
}

export const MUSIC_TRENDS_30D: MusicTrendPoint[] = genTrends();
