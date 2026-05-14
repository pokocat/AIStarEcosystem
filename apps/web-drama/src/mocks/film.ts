// ─────────────────────────────────────────────────────────────────────────────
// mocks/film.ts — 短剧 / 电影 / 广告 / 配音样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { Drama, Movie, Advertisement, VoiceWork } from "@ai-star-eco/types/film";

export const DRAMAS: Drama[] = [
  { id: "d-001", title: "暮色未央",     genre: "都市悬疑",     episodes: 24, role: "苏念 / 陆烬", status: "released",        views: 3_180_000, revenue: 226_400, rating: 4.6, releaseDate: "2026-04-28T12:00:00Z" },
  { id: "d-002", title: "盛夏来信",     genre: "青春治愈",     episodes: 18, role: "林晓 / 周野", status: "filming",         views: 0,         revenue: 0,       rating: 0 },
  { id: "d-003", title: "摩天与月光",   genre: "都市情感",     episodes: 12, role: "苏念 / 顾辰", status: "post-production", views: 0,         revenue: 0,       rating: 0,   releaseDate: "2026-05-17T12:00:00Z" },
  { id: "d-004", title: "雾隐 · 1992", genre: "年代悬疑",     episodes: 10, role: "Aiko / 林宛", status: "casting",         views: 0,         revenue: 0,       rating: 0 },
  { id: "d-005", title: "拾月",         genre: "古风轻喜",     episodes: 8,  role: "陆烬 / 沈知夏", status: "casting",        views: 0,         revenue: 0,       rating: 0 },
];

export const MOVIES: Movie[] = [
  { id: "m-001", title: "便利店长夜", genre: "悬疑短片", role: "lead",       status: "released",        boxOffice: 420_000, revenue: 38_000, rating: 4.4 },
  { id: "m-002", title: "第十七层",   genre: "都市惊悚", role: "supporting", status: "post-production", boxOffice: 0,       revenue: 0,      rating: 0 },
];

export const ADS: Advertisement[] = [
  { id: "ad-001", brand: "晴山防晒", product: "轻量防晒衣", type: "digital", duration: 30, status: "completed", payment: 42_000, views: 640_000 },
  { id: "ad-002", brand: "浮岛饮品", product: "低糖柠檬茶", type: "social",  duration: 15, status: "completed", payment: 28_000, views: 410_000 },
  { id: "ad-003", brand: "远山童鞋", product: "春季跑鞋",   type: "TVC",     duration: 45, status: "shooting",  payment: 76_000, views: 0 },
];

export const VOICE_WORKS: VoiceWork[] = [
  { id: "vw-001", project: "有声番外《苏念的第三封信》", type: "audiobook",    duration: 28, status: "delivered", payment: 12_000 },
  { id: "vw-002", project: "幕后纪录《数字演员试镜日》", type: "documentary", duration: 42, status: "recording", payment: 18_000 },
];
