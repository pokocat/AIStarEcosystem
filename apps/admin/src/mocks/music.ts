// ─────────────────────────────────────────────────────────────────────────────
// mocks/music.ts — admin 端音乐样本。
// 字段结构与 apps/web/src/mocks/music.ts 保持一致；admin 额外保留过渡字段
// （trackCount / status / sales / revenue / venue / capacity 等）供存量页面使用，
// P1 迁"歌单运营 / 线上直播管理"后一并删除。
// ─────────────────────────────────────────────────────────────────────────────

import type { Song, Album, Concert, MusicGenre } from "@/types/music";

const MOCK_AUDIO_URL = "https://cdn.placeholder.local/mock/audio.mp3";

export const SONGS: Song[] = [
  {
    id: "s-1",
    title: "霓虹之夜",
    genre: "电子舞曲",
    duration: 245,
    status: "released",
    plays: 582_000,
    revenue: 18_600,
    rating: 4.8,
    releaseDate: "2026-03-15T00:00:00Z",
    artistId: "1",
    audioUrl: MOCK_AUDIO_URL,
    coverUrl: "https://images.unsplash.com/photo-1614149162883-504ce7dc5b73?w=400",
    modelVersion: "suno-v3",
    thinkDepth: "standard",
    creditsSpent: 80,
    createdAt: "2026-02-20T08:00:00Z",
    studioId: "s-skywave",
    artistName: "Neon V",
    studioName: "星浪工作室",
    description: "收录于《赛博梦境精选》合集的主打曲，融合复古合成器与未来主义节拍。",
  },
  {
    id: "s-2",
    title: "星光漫步",
    genre: "流行",
    duration: 203,
    status: "released",
    plays: 423_000,
    revenue: 12_900,
    rating: 4.6,
    releaseDate: "2026-03-20T00:00:00Z",
    artistId: "2",
    audioUrl: MOCK_AUDIO_URL,
    coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
    modelVersion: "suno-v3",
    thinkDepth: "fast",
    creditsSpent: 60,
    createdAt: "2026-03-01T08:00:00Z",
    studioId: "s-nebula",
    artistName: "Luna Soft",
    studioName: "星云 MCN",
    description: "甜系偶像曲目，粉丝应援现场高频点播。",
  },
  {
    id: "s-3",
    title: "午夜电波",
    genre: "电子",
    duration: 198,
    status: "mixing",
    plays: 0,
    revenue: 0,
    rating: 0,
    artistId: "1",
    audioUrl: MOCK_AUDIO_URL,
    modelVersion: "suno-v3-deep",
    thinkDepth: "deep",
    creditsSpent: 230,
    createdAt: "2026-04-10T08:00:00Z",
    studioId: "s-skywave",
    artistName: "Neon V",
    studioName: "星浪工作室",
    description: "Neon V 的实验性单曲，混音阶段。",
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
    // 遗留字段：过渡页面仍引用
    trackCount: 2,
    status: "released",
    sales: 18500,
    revenue: 555000,
  },
  {
    id: "al-2",
    name: "Luna 甜蜜合辑",
    cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
    artistId: "2",
    trackIds: ["s-2"],
    createdAt: "2026-03-25T00:00:00Z",
    trackCount: 1,
    status: "recording",
    sales: 0,
    revenue: 0,
  },
];

export const CONCERTS: Concert[] = [
  {
    id: "c-1",
    name: "霓虹之夜线上直播",
    artistIds: ["1"],
    date: "2026-06-20T12:00:00Z",
    status: "planning",
    // 遗留字段：过渡页面仍引用
    venue: "线上直播",
    ticketPrice: 0,
    capacity: 0,
    soldTickets: 0,
    revenue: 0,
  },
];

export const MUSIC_GENRES: MusicGenre[] = [
  { id: "pop",       name: "流行",      icon: "🎵", color: "pink" },
  { id: "rock",      name: "摇滚",      icon: "🎸", color: "red" },
  { id: "edm",       name: "电子舞曲",  icon: "⚡", color: "purple" },
  { id: "hiphop",    name: "说唱",      icon: "🎤", color: "yellow" },
  { id: "classical", name: "古风",      icon: "🎻", color: "cyan" },
  { id: "jazz",      name: "爵士",      icon: "🎺", color: "orange" },
  { id: "electronic",name: "电子",      icon: "💿", color: "indigo" },
];
