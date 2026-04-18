// ─────────────────────────────────────────────────────────────────────────────
// mocks/music.ts — 歌曲 / 专辑 / 演唱会样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { Song, Album, Concert, MusicGenre } from "@/types/music";

export const SONGS: Song[] = [
  { id: "1", title: "霓虹之夜", genre: "EDM",        duration: 245, status: "released", plays: 582000, revenue: 18600, rating: 4.8, releaseDate: "2026-03-15T00:00:00Z" },
  { id: "2", title: "星光漫步", genre: "Pop",        duration: 203, status: "released", plays: 423000, revenue: 12900, rating: 4.6, releaseDate: "2026-03-20T00:00:00Z" },
  { id: "3", title: "午夜电波", genre: "Electronic", duration: 198, status: "mixing",   plays: 0,      revenue: 0,     rating: 0 },
];

export const ALBUMS: Album[] = [
  { id: "1", name: "赛博梦境", cover: "https://images.unsplash.com/photo-1614149162883-504ce7dc5b73?w=400", trackCount: 10, status: "released",  sales: 18500, revenue: 555000 },
  { id: "2", name: "未来回响", cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400", trackCount: 8,  status: "recording", sales: 0,     revenue: 0 },
];

export const CONCERTS: Concert[] = [
  { id: "1", name: "霓虹之夜巡演", venue: "国际体育馆", date: "2026-05-15T00:00:00Z", ticketPrice: 380, capacity: 8000, soldTickets: 8000, status: "completed", revenue: 3040000 },
  { id: "2", name: "星空演唱会",   venue: "音乐厅",    date: "2026-06-20T00:00:00Z", ticketPrice: 280, capacity: 5000, soldTickets: 3200, status: "selling",   revenue: 896000 },
];

export const MUSIC_GENRES: MusicGenre[] = [
  { id: "pop",       name: "Pop",       icon: "🎵", color: "pink" },
  { id: "rock",      name: "Rock",      icon: "🎸", color: "red" },
  { id: "edm",       name: "EDM",       icon: "⚡", color: "purple" },
  { id: "hiphop",    name: "Hip-Hop",   icon: "🎤", color: "yellow" },
  { id: "classical", name: "古风",      icon: "🎻", color: "cyan" },
  { id: "jazz",      name: "Jazz",      icon: "🎺", color: "orange" },
];
