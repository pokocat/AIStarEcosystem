// ─────────────────────────────────────────────────────────────────────────────
// mocks/pose.ts — 表演姿态 / 表情 / 手势样本数据（短剧主线）。
// pose 偏镜头表演（站姿 / 坐姿 / 舞台 / 念白 / 动作），不再覆盖音乐舞蹈；
// expression / gesture 与原 web-music 共用，已为中文。
// ─────────────────────────────────────────────────────────────────────────────

import type { Pose, Expression, Gesture } from "@ai-star-eco/types/pose";

export const POSE_DATABASE: Pose[] = [
  // 站姿
  { id: "p1",  name: "自信站姿",   category: "standing", thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300", difficulty: "easy",   isNew: true },
  { id: "p2",  name: "倚墙独白",   category: "standing", thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300", difficulty: "easy" },
  { id: "p3",  name: "雨夜伫立",   category: "standing", thumbnail: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300", difficulty: "medium" },
  { id: "p4",  name: "对峙怒视",   category: "standing", thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300", difficulty: "hard",   isLocked: true },
  // 坐姿
  { id: "p5",  name: "优雅端坐",   category: "sitting",  thumbnail: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300", difficulty: "easy" },
  { id: "p6",  name: "翘腿沉思",   category: "sitting",  thumbnail: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300", difficulty: "medium", isNew: true },
  { id: "p7",  name: "落座叹息",   category: "sitting",  thumbnail: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300", difficulty: "medium" },
  // 舞台
  { id: "p8",  name: "古风敛衣",   category: "dancing",  thumbnail: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=300", difficulty: "medium" },
  { id: "p9",  name: "回眸定格",   category: "dancing",  thumbnail: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300", difficulty: "hard",   isNew: true },
  { id: "p10", name: "舞台谢幕",   category: "dancing",  thumbnail: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300", difficulty: "hard",   isLocked: true },
  // 念白 / 唱段
  { id: "p11", name: "正面念白",   category: "singing",  thumbnail: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300", difficulty: "easy" },
  { id: "p12", name: "怒吼咆哮",   category: "singing",  thumbnail: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300", difficulty: "medium", isNew: true },
  { id: "p13", name: "低语耳边",   category: "singing",  thumbnail: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300", difficulty: "medium" },
  // 镜头动作
  { id: "p14", name: "拥抱告别",   category: "action",   thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300", difficulty: "easy" },
  { id: "p15", name: "回头一瞥",   category: "action",   thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", difficulty: "easy",   isNew: true },
  { id: "p16", name: "倒地特写",   category: "action",   thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", difficulty: "hard",   isLocked: true },
];

export const EXPRESSION_DATABASE: Expression[] = [
  { id: "e1",  name: "浅笑",   emoji: "🙂", intensity: 60,  category: "happy" },
  { id: "e2",  name: "大笑",   emoji: "😆", intensity: 100, category: "happy" },
  { id: "e3",  name: "甜笑",   emoji: "😊", intensity: 80,  category: "happy" },
  { id: "e4",  name: "落泪",   emoji: "😢", intensity: 70,  category: "sad" },
  { id: "e5",  name: "崩溃哭", emoji: "😭", intensity: 95,  category: "sad" },
  { id: "e6",  name: "冷峻",   emoji: "😐", intensity: 75,  category: "cool" },
  { id: "e7",  name: "挑眉",   emoji: "😏", intensity: 70,  category: "cool" },
  { id: "e8",  name: "惊讶",   emoji: "😲", intensity: 80,  category: "surprised" },
  { id: "e9",  name: "震惊",   emoji: "😱", intensity: 95,  category: "surprised" },
  { id: "e10", name: "怒视",   emoji: "😠", intensity: 85,  category: "other" },
  { id: "e11", name: "脸红",   emoji: "😳", intensity: 70,  category: "other" },
  { id: "e12", name: "深情",   emoji: "🥰", intensity: 90,  category: "happy" },
];

export const GESTURE_DATABASE: Gesture[] = [
  { id: "g1", name: "比心",      icon: "❤️", category: "love" },
  { id: "g2", name: "点赞",      icon: "👍", category: "approval" },
  { id: "g3", name: "OK 手势",   icon: "👌", category: "approval" },
  { id: "g4", name: "和平手势",  icon: "✌️", category: "peace" },
  { id: "g5", name: "握拳",      icon: "✊", category: "rock" },
  { id: "g6", name: "挥手",      icon: "👋", category: "greeting" },
  { id: "g7", name: "作揖",      icon: "🙏", category: "respect" },
  { id: "g8", name: "鼓掌",      icon: "👏", category: "applause" },
];
