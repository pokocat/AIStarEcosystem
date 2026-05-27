// ─────────────────────────────────────────────────────────────────────────────
// mocks/notifications.ts — 通知样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@ai-star-eco/types/notification";

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "revenue",     title: "Spotify 版税到账",   desc: "¥8,200 已到账，来自《Neon Tears》流媒体版税",            time: "2min",  viewedAt: null },
  { id: "n2", type: "achievement", title: "成就解锁: 万人迷",    desc: "Neon V 粉丝突破 128K！",                                 time: "15min", viewedAt: null },
  { id: "n3", type: "fan",         title: "新粉丝涌入",          desc: "过去1小时新增 520 名粉丝",                               time: "1h",    viewedAt: null },
  { id: "n4", type: "content",     title: "内容审核通过",        desc: "《Cyber City Vibe》MV 已通过审核，可发布",               time: "2h",    viewedAt: "2026-05-01T00:00:00Z" },
  { id: "n5", type: "system",      title: "系统维护通知",        desc: "4月20日 02:00-04:00 系统升级，部分功能暂停",             time: "5h",    viewedAt: "2026-05-01T00:00:00Z" },
  { id: "n6", type: "revenue",     title: "NFT #287 售出",      desc: "¥4,800 收入，买家: CryptoFan_X",                         time: "8h",    viewedAt: "2026-05-01T00:00:00Z" },
  { id: "n7", type: "achievement", title: "里程碑: 百万播放",    desc: "《Digital Sunset》总播放量突破 100 万！",                time: "1d",    viewedAt: "2026-05-01T00:00:00Z" },
];
