// ─────────────────────────────────────────────────────────────────────────────
// mocks/distribution.ts — 分发样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DistributionContentItem,
  Platform,
  PlatformViewPoint,
} from "@/types/distribution";

export const PLATFORMS: Platform[] = [
  { id: "p1",  name: "Spotify",        icon: "🎵", category: "music",  status: "connected",    followers: "45.2K", lastSync: "2min ago" },
  { id: "p2",  name: "Apple Music",    icon: "🍎", category: "music",  status: "connected",    followers: "32.1K", lastSync: "5min ago" },
  { id: "p3",  name: "YouTube Music",  icon: "▶️", category: "music",  status: "connected",    followers: "128K",  lastSync: "1min ago" },
  { id: "p4",  name: "NetEase Music",  icon: "🎶", category: "music",  status: "connected",    followers: "89.5K", lastSync: "3min ago" },
  { id: "p5",  name: "QQ Music",       icon: "🎧", category: "music",  status: "pending",      followers: "-",     lastSync: "-" },
  { id: "p6",  name: "Douyin",         icon: "🎬", category: "video",  status: "connected",    followers: "256K",  lastSync: "30s ago" },
  { id: "p7",  name: "Bilibili",       icon: "📺", category: "video",  status: "connected",    followers: "182K",  lastSync: "2min ago" },
  { id: "p8",  name: "YouTube",        icon: "📹", category: "video",  status: "connected",    followers: "95.3K", lastSync: "1min ago" },
  { id: "p9",  name: "TikTok",         icon: "🎵", category: "video",  status: "connected",    followers: "310K",  lastSync: "15s ago" },
  { id: "p10", name: "Xiaohongshu",    icon: "📕", category: "social", status: "connected",    followers: "67.8K", lastSync: "5min ago" },
  { id: "p11", name: "Weibo",          icon: "🌐", category: "social", status: "connected",    followers: "145K",  lastSync: "2min ago" },
  { id: "p12", name: "Instagram",      icon: "📷", category: "social", status: "disconnected", followers: "-",     lastSync: "-" },
  { id: "p13", name: "Twitch",         icon: "🟣", category: "live",   status: "pending",      followers: "-",     lastSync: "-" },
  { id: "p14", name: "Douyu",          icon: "🐟", category: "live",   status: "connected",    followers: "28.5K", lastSync: "10min ago" },
];

export const CONTENT_ITEMS: DistributionContentItem[] = [
  { id: "c1", title: "Neon Tears (Single)",      type: "music", status: "published",    platforms: 8,  totalViews: "1.2M", date: "2025-03-10" },
  { id: "c2", title: "Cyber City MV",            type: "video", status: "distributing", platforms: 5,  totalViews: "450K", date: "2025-04-01" },
  { id: "c3", title: "Ghost Signal EP",          type: "music", status: "scheduled",    platforms: 12, totalViews: "-",    date: "2025-04-20" },
  { id: "c4", title: "Behind the Scenes Vlog",   type: "video", status: "published",    platforms: 4,  totalViews: "89K",  date: "2025-03-25" },
  { id: "c5", title: "Midnight Protocol",        type: "music", status: "draft",        platforms: 0,  totalViews: "-",    date: "2025-04-15" },
];

export const PLATFORM_DATA: PlatformViewPoint[] = [
  { name: "Spotify",  views: 320000 },
  { name: "YouTube",  views: 450000 },
  { name: "Douyin",   views: 280000 },
  { name: "Bilibili", views: 180000 },
  { name: "NetEase",  views: 150000 },
  { name: "TikTok",   views: 210000 },
];
