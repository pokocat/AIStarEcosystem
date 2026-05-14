// ─────────────────────────────────────────────────────────────────────────────
// mocks/community.ts — 短剧粉丝社区样本数据。
// 围绕 drama 主线剧集（《暮色未央》/《盛夏来信》/《摩天与月光》）与演员
// （苏念 / 陆烬）展开，去掉原 web-music 残留的「Neon Tears / Cyber City」。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CommunityEvent,
  FanActivity,
  FanGrowthPoint,
  FanTier,
} from "@ai-star-eco/types/community";

export const FAN_TIERS: FanTier[] = [
  { name: "铁粉",   icon: "💎", count: 1420,  color: "text-purple-400", bg: "bg-purple-500/10" },
  { name: "真爱粉", icon: "❤️", count: 6800,  color: "text-pink-400",   bg: "bg-pink-500/10" },
  { name: "路人粉", icon: "👋", count: 18600, color: "text-blue-400",   bg: "bg-blue-500/10" },
  { name: "潜在粉", icon: "👀", count: 41200, color: "text-gray-400",   bg: "bg-gray-500/10" },
];

export const FAN_GROWTH: FanGrowthPoint[] = [
  { date: "1 月", fans:  12_000, active: 2_400 },
  { date: "2 月", fans:  18_500, active: 3_700 },
  { date: "3 月", fans:  29_000, active: 5_800 },
  { date: "4 月", fans:  48_600, active: 9_200 },
  { date: "5 月", fans:  68_200, active: 12_400 },
  { date: "6 月", fans:  72_000, active: 13_000 },
];

export const ACTIVITIES: FanActivity[] = [
  { id: "a1", user: "苏念后援总会",  avatar: "🌙", action: "打赏了 ¥500",                       time: "2 分钟",  type: "gift" },
  { id: "a2", user: "陆烬观察笔记",  avatar: "📝", action: "评论了《暮色未央》EP07",            time: "5 分钟",  type: "comment" },
  { id: "a3", user: "盛夏来信打卡组", avatar: "☀️", action: "分享了《盛夏来信》操场花絮",        time: "8 分钟",  type: "share" },
  { id: "a4", user: "新粉_念念",      avatar: "✨", action: "关注了你",                          time: "12 分钟", type: "follow" },
  { id: "a5", user: "夜雨研究所",    avatar: "🎬", action: "打赏了 ¥200",                       time: "15 分钟", type: "gift" },
  { id: "a6", user: "影评碎碎念",    avatar: "🍃", action: "评论了《摩天与月光》先导花絮",     time: "20 分钟", type: "comment" },
];

export const EVENTS: CommunityEvent[] = [
  { id: "e1", title: "粉丝投票：《摩天与月光》主题曲风格", type: "vote",        status: "live",     participants: 8520, date: "2026-05-10" },
  { id: "e2", title: "苏念生日应援会 · 线上直播",          type: "meetup",      status: "upcoming", participants: 0,    date: "2026-05-22" },
  { id: "e3", title: "《暮色未央》电话亭二创剪辑挑战",     type: "challenge",   status: "live",     participants: 2140, date: "2026-05-02" },
  { id: "e4", title: "《盛夏来信》片场探班直播",            type: "anniversary", status: "upcoming", participants: 0,    date: "2026-06-01" },
];
