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
  { id: "p1",  name: "爱奇艺",     icon: "🎞️", category: "video",  status: "connected",    followers: "—",     lastSync: "2 分钟前" },
  { id: "p2",  name: "腾讯视频",   icon: "📺", category: "video",  status: "connected",    followers: "—",     lastSync: "5 分钟前" },
  { id: "p3",  name: "优酷",       icon: "🎬", category: "video",  status: "connected",    followers: "—",     lastSync: "3 分钟前" },
  { id: "p4",  name: "芒果 TV",    icon: "🥭", category: "video",  status: "pending",      followers: "—",     lastSync: "—" },
  // 短视频
  { id: "p5",  name: "抖音",       icon: "🎵", category: "video",  status: "connected",    followers: "126 万", lastSync: "30 秒前" },
  { id: "p6",  name: "快手",       icon: "⚡", category: "video",  status: "connected",    followers: "82 万",  lastSync: "1 分钟前" },
  { id: "p7",  name: "视频号",     icon: "💬", category: "video",  status: "connected",    followers: "41 万",  lastSync: "2 分钟前" },
  { id: "p8",  name: "B 站",       icon: "📺", category: "video",  status: "connected",    followers: "63 万",  lastSync: "2 分钟前" },
  { id: "p9",  name: "小红书",     icon: "📕", category: "social", status: "connected",    followers: "28 万",  lastSync: "5 分钟前" },
  { id: "p10", name: "西瓜视频",   icon: "🍉", category: "video",  status: "connected",    followers: "19 万",  lastSync: "8 分钟前" },
  // 垂类短剧
  { id: "p11", name: "红果短剧",   icon: "🎯", category: "video",  status: "connected",    followers: "47 万",  lastSync: "1 分钟前" },
  { id: "p12", name: "番茄短剧",   icon: "🍅", category: "video",  status: "pending",      followers: "—",     lastSync: "—" },
  // 微博舆情
  { id: "p13", name: "微博",       icon: "🌐", category: "social", status: "connected",    followers: "94 万",  lastSync: "2 分钟前" },
  // 海外尝鲜
  { id: "p14", name: "YouTube",    icon: "▶️", category: "video",  status: "disconnected", followers: "—",     lastSync: "—" },
];

export const CONTENT_ITEMS: DistributionContentItem[] = [
  { id: "c1", title: "《暮色未央》EP08 切片",      type: "video", status: "published",    platforms: 8,  totalViews: "1240 万", date: "2026-04-22" },
  { id: "c2", title: "《盛夏来信》30 秒预告",       type: "video", status: "distributing", platforms: 5,  totalViews: "320 万",  date: "2026-05-04" },
  { id: "c3", title: "《摩天与月光》先导片",        type: "video", status: "scheduled",    platforms: 10, totalViews: "—",      date: "2026-05-16" },
  { id: "c4", title: "幕后花絮 ·《暮色未央》定妆",   type: "video", status: "published",    platforms: 6,  totalViews: "78 万",   date: "2026-04-12" },
  { id: "c5", title: "《雾隐 1992》开机仪式",        type: "video", status: "draft",        platforms: 0,  totalViews: "—",      date: "2026-05-13" },
];

export const PLATFORM_DATA: PlatformViewPoint[] = [
  { name: "抖音",       views: 4_820_000 },
  { name: "腾讯视频",   views: 3_120_000 },
  { name: "爱奇艺",     views: 2_640_000 },
  { name: "红果短剧",   views: 1_980_000 },
  { name: "B 站",       views: 1_150_000 },
  { name: "视频号",     views: 860_000 },
  { name: "快手",       views: 720_000 },
  { name: "小红书",     views: 410_000 },
];
