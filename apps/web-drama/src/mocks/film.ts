// ─────────────────────────────────────────────────────────────────────────────
// mocks/film.ts — 短剧 / 电影 / 广告 / 配音样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { Drama, Movie, Advertisement, VoiceWork } from "@ai-star-eco/types/film";

export const DRAMAS: Drama[] = [
  { id: "1", title: "霓虹都市", genre: "都市剧", episodes: 12, role: "女主角", status: "released", views: 5820000, revenue: 186000, rating: 4.7, releaseDate: "2026-03-01T00:00:00Z" },
  { id: "2", title: "未来之眼", genre: "科幻剧", episodes: 8,  role: "配角",   status: "released", views: 3210000, revenue: 128000, rating: 4.5, releaseDate: "2026-03-15T00:00:00Z" },
  { id: "3", title: "星际爱恋", genre: "爱情剧", episodes: 16, role: "女主角", status: "filming",  views: 0,       revenue: 0,      rating: 0 },
  // drama sub-app cinematic 主线剧集
  { id: "d-001", title: "暮色未央",     genre: "都市悬疑",     episodes: 16, role: "苏念 + 陆烬", status: "released",        views: 12_800_000, revenue: 880_000, rating: 4.8, releaseDate: "2026-04-12T00:00:00Z" },
  { id: "d-002", title: "盛夏来信",     genre: "青春治愈",     episodes: 14, role: "林晓",         status: "filming",         views: 0,          revenue: 0,       rating: 0 },
  { id: "d-003", title: "摩天与月光",   genre: "商战 + 爱情",  episodes: 20, role: "苏念 + 陆烬", status: "post-production", views: 0,          revenue: 0,       rating: 0,   releaseDate: "2026-05-16T00:00:00Z" },
  { id: "d-004", title: "雾隐 · 1992", genre: "悬疑短剧",     episodes: 10, role: "Aiko",         status: "casting",         views: 0,          revenue: 0,       rating: 0 },
  { id: "d-005", title: "拾月",         genre: "古风言情",     episodes: 0,  role: "陆烬",         status: "casting",         views: 0,          revenue: 0,       rating: 0 },
];

export const MOVIES: Movie[] = [
  { id: "1", title: "赛博觉醒", genre: "科幻动作", role: "lead",       status: "released",        boxOffice: 8500000, revenue: 425000, rating: 4.8 },
  { id: "2", title: "记忆碎片", genre: "悬疑惊悚", role: "supporting", status: "post-production", boxOffice: 0,       revenue: 0,      rating: 0 },
];

export const ADS: Advertisement[] = [
  { id: "1", brand: "NeuroTech",   product: "智能手环", type: "TVC",     duration: 30, status: "completed", payment: 85000,  views: 2800000 },
  { id: "2", brand: "Cyber Cola",  product: "能量饮料", type: "digital", duration: 15, status: "completed", payment: 65000,  views: 4200000 },
  { id: "3", brand: "Luna Fashion",product: "时尚服饰", type: "social",  duration: 60, status: "shooting",  payment: 120000, views: 0 },
];

export const VOICE_WORKS: VoiceWork[] = [
  { id: "1", project: "星际冒险",       type: "animation",   duration: 120, status: "delivered", payment: 45000 },
  { id: "2", project: "未来世界纪录片", type: "documentary", duration: 60,  status: "recording", payment: 32000 },
];
