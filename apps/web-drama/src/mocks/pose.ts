// ─────────────────────────────────────────────────────────────────────────────
// mocks/pose.ts — 姿态 / 表情 / 手势样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { Pose, Expression, Gesture } from "@ai-star-eco/types/pose";

export const POSE_DATABASE: Pose[] = [
  // 站姿
  { id: "p1",  name: "自信站姿", category: "standing", thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300", difficulty: "easy",   isNew: true },
  { id: "p2",  name: "休闲倚靠", category: "standing", thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300", difficulty: "easy" },
  { id: "p3",  name: "超模姿态", category: "standing", thumbnail: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300", difficulty: "medium" },
  { id: "p4",  name: "战斗姿态", category: "standing", thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300", difficulty: "hard",   isLocked: true },
  // 坐姿
  { id: "p5",  name: "优雅端坐", category: "sitting",  thumbnail: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300", difficulty: "easy" },
  { id: "p6",  name: "翘腿坐姿", category: "sitting",  thumbnail: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300", difficulty: "medium", isNew: true },
  { id: "p7",  name: "慵懒斜倚", category: "sitting",  thumbnail: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300", difficulty: "medium" },
  // 舞蹈
  { id: "p8",  name: "爵士舞步", category: "dancing",  thumbnail: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300", difficulty: "hard" },
  { id: "p9",  name: "街舞风格", category: "dancing",  thumbnail: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300", difficulty: "hard",   isNew: true },
  { id: "p10", name: "芭蕾姿态", category: "dancing",  thumbnail: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300", difficulty: "hard",   isLocked: true },
  // 演唱
  { id: "p11", name: "麦克风握姿", category: "singing",thumbnail: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300", difficulty: "easy" },
  { id: "p12", name: "高音姿态",  category: "singing", thumbnail: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300", difficulty: "medium", isNew: true },
  { id: "p13", name: "摇滚手势",  category: "singing", thumbnail: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300", difficulty: "medium" },
  // 动作
  { id: "p14", name: "飞吻动作", category: "action",   thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300", difficulty: "easy" },
  { id: "p15", name: "胜利手势", category: "action",   thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", difficulty: "easy",   isNew: true },
  { id: "p16", name: "跳跃瞬间", category: "action",   thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", difficulty: "hard",   isLocked: true },
];

export const EXPRESSION_DATABASE: Expression[] = [
  { id: "e1",  name: "开心",   emoji: "😊", intensity: 80,  category: "happy" },
  { id: "e2",  name: "大笑",   emoji: "😆", intensity: 100, category: "happy" },
  { id: "e3",  name: "微笑",   emoji: "🙂", intensity: 60,  category: "happy" },
  { id: "e4",  name: "悲伤",   emoji: "😢", intensity: 70,  category: "sad" },
  { id: "e5",  name: "哭泣",   emoji: "😭", intensity: 90,  category: "sad" },
  { id: "e6",  name: "酷炫",   emoji: "😎", intensity: 85,  category: "cool" },
  { id: "e7",  name: "得意",   emoji: "😏", intensity: 75,  category: "cool" },
  { id: "e8",  name: "惊讶",   emoji: "😲", intensity: 80,  category: "surprised" },
  { id: "e9",  name: "震惊",   emoji: "😱", intensity: 95,  category: "surprised" },
  { id: "e10", name: "生气",   emoji: "😠", intensity: 85,  category: "other" },
  { id: "e11", name: "害羞",   emoji: "😳", intensity: 70,  category: "other" },
  { id: "e12", name: "爱心",   emoji: "😍", intensity: 90,  category: "happy" },
];

export const GESTURE_DATABASE: Gesture[] = [
  { id: "g1", name: "比心",     icon: "❤️", category: "love" },
  { id: "g2", name: "点赞",     icon: "👍", category: "approval" },
  { id: "g3", name: "OK手势",   icon: "👌", category: "approval" },
  { id: "g4", name: "和平手势", icon: "✌️", category: "peace" },
  { id: "g5", name: "摇滚手势", icon: "🤘", category: "rock" },
  { id: "g6", name: "挥手",     icon: "👋", category: "greeting" },
  { id: "g7", name: "祈祷",     icon: "🙏", category: "respect" },
  { id: "g8", name: "鼓掌",     icon: "👏", category: "applause" },
];
