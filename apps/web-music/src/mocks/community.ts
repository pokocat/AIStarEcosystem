// ─────────────────────────────────────────────────────────────────────────────
// mocks/community.ts — 粉丝社区样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CommunityEvent,
  FanActivity,
  FanGrowthPoint,
  FanTier,
} from "@ai-star-eco/types/community";

export const FAN_TIERS: FanTier[] = [
  { name: "铁粉",   icon: "💎", count: 3248,   color: "text-purple-400", bg: "bg-purple-500/10" },
  { name: "真爱粉", icon: "❤️", count: 12800,  color: "text-pink-400",   bg: "bg-pink-500/10" },
  { name: "路人粉", icon: "👋", count: 45600,  color: "text-blue-400",   bg: "bg-blue-500/10" },
  { name: "潜在粉", icon: "👀", count: 100000, color: "text-gray-400",   bg: "bg-gray-500/10" },
];

export const FAN_GROWTH: FanGrowthPoint[] = [
  { date: "1月", fans: 82000,  active: 12000 },
  { date: "2月", fans: 95000,  active: 14500 },
  { date: "3月", fans: 112000, active: 18000 },
  { date: "4月", fans: 128000, active: 22000 },
  { date: "5月", fans: 145000, active: 25800 },
  { date: "6月", fans: 162000, active: 28500 },
];

export const ACTIVITIES: FanActivity[] = [
  { id: "a1", user: "CyberFan_01",    avatar: "🎮", action: "打赏了 ¥500",            time: "2min",  type: "gift" },
  { id: "a2", user: "NeonLover",      avatar: "🌟", action: "评论了《Neon Tears》",    time: "5min",  type: "comment" },
  { id: "a3", user: "MusicHunter",    avatar: "🎧", action: "分享了你的MV",            time: "8min",  type: "share" },
  { id: "a4", user: "NewFollower_X",  avatar: "✨", action: "关注了你",                time: "12min", type: "follow" },
  { id: "a5", user: "StageQueen",     avatar: "👑", action: "打赏了 ¥200",             time: "15min", type: "gift" },
  { id: "a6", user: "PixelDream",     avatar: "💫", action: "评论了《Cyber City》",    time: "20min", type: "comment" },
];

export const EVENTS: CommunityEvent[] = [
  { id: "e1", title: "粉丝投票：下张单曲风格",  type: "vote",        status: "live",     participants: 8520, date: "2025-04-15" },
  { id: "e2", title: "线上见面会 Spring Edition", type: "meetup",      status: "upcoming", participants: 0,    date: "2025-04-25" },
  { id: "e3", title: "翻唱挑战赛 #NeonCovers",   type: "challenge",   status: "live",     participants: 3240, date: "2025-04-10" },
  { id: "e4", title: "出道一周年庆典",             type: "anniversary", status: "upcoming", participants: 0,    date: "2025-05-01" },
];
