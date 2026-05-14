// ─────────────────────────────────────────────────────────────────────────────
// mocks/distribution.ts — 分发样本数据（中文短剧主线）。
// 平台覆盖：长视频（爱奇艺 / 优酷 / 腾讯视频 / 芒果 TV）+ 短视频（抖音 / 快手 /
// 视频号 / B 站 / 小红书 / 西瓜）+ 垂类短剧（红果短剧）+ 一个海外尝鲜位
// （YouTube），符合 drama 子产品「短剧 + 数字演员」的真实分发动线。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DistributionContentItem,
  Platform,
  PlatformViewPoint,
} from "@ai-star-eco/types/distribution";

export const PLATFORMS: Platform[] = [
  // 长视频
  { id: "p1",  name: "爱奇艺",     icon: "🎞️", category: "video",  status: "connected",    followers: "—",      lastSync: "14 分钟前" },
  { id: "p2",  name: "腾讯视频",   icon: "📺", category: "video",  status: "connected",    followers: "—",      lastSync: "18 分钟前" },
  { id: "p3",  name: "优酷",       icon: "🎬", category: "video",  status: "pending",      followers: "—",      lastSync: "—" },
  { id: "p4",  name: "芒果 TV",    icon: "🥭", category: "video",  status: "disconnected", followers: "—",      lastSync: "—" },
  // 短视频
  { id: "p5",  name: "抖音",       icon: "🎵", category: "video",  status: "connected",    followers: "18.6 万", lastSync: "1 分钟前" },
  { id: "p6",  name: "快手",       icon: "⚡", category: "video",  status: "connected",    followers: "9.4 万",  lastSync: "2 分钟前" },
  { id: "p7",  name: "视频号",     icon: "💬", category: "video",  status: "connected",    followers: "5.2 万",  lastSync: "4 分钟前" },
  { id: "p8",  name: "B 站",       icon: "📺", category: "video",  status: "connected",    followers: "3.8 万",  lastSync: "8 分钟前" },
  { id: "p9",  name: "小红书",     icon: "📕", category: "social", status: "connected",    followers: "2.1 万",  lastSync: "11 分钟前" },
  { id: "p10", name: "西瓜视频",   icon: "🍉", category: "video",  status: "disconnected", followers: "—",      lastSync: "—" },
  // 垂类短剧
  { id: "p11", name: "红果短剧",   icon: "🎯", category: "video",  status: "connected",    followers: "—",      lastSync: "3 分钟前" },
  { id: "p12", name: "番茄短剧",   icon: "🍅", category: "video",  status: "pending",      followers: "—",      lastSync: "—" },
  // 微博舆情
  { id: "p13", name: "微博",       icon: "🌐", category: "social", status: "connected",    followers: "7.3 万",  lastSync: "6 分钟前" },
  // 海外尝鲜
  { id: "p14", name: "YouTube",    icon: "▶️", category: "video",  status: "disconnected", followers: "—",      lastSync: "—" },
];

export const CONTENT_ITEMS: DistributionContentItem[] = [
  { id: "c1", title: "《暮色未央》EP01-03 合集",      type: "video", status: "published",    platforms: 5, totalViews: "318 万", date: "2026-04-28" },
  { id: "c2", title: "《暮色未央》雨夜电话亭切片",    type: "video", status: "published",    platforms: 3, totalViews: "74 万",  date: "2026-05-02" },
  { id: "c3", title: "《盛夏来信》操场重逢花絮",      type: "video", status: "distributing", platforms: 4, totalViews: "18 万",  date: "2026-05-12" },
  { id: "c4", title: "《摩天与月光》30 秒先导预告",   type: "video", status: "scheduled",    platforms: 6, totalViews: "—",     date: "2026-05-17" },
  { id: "c5", title: "《雾隐 · 1992》电话亭试拍素材", type: "video", status: "draft",        platforms: 0, totalViews: "—",     date: "2026-05-13" },
];

export const PLATFORM_DATA: PlatformViewPoint[] = [
  { name: "抖音",       views: 1_040_000 },
  { name: "快手",       views: 620_000 },
  { name: "红果短剧",   views: 520_000 },
  { name: "视频号",     views: 410_000 },
  { name: "B 站",       views: 280_000 },
  { name: "小红书",     views: 170_000 },
  { name: "腾讯视频",   views: 95_000 },
  { name: "爱奇艺",     views: 45_000 },
];
