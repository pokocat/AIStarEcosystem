// ─────────────────────────────────────────────────────────────────────────────
// pose-ui.ts — 姿态 UI 配置（难度色、分类筛选标签）。
// ─────────────────────────────────────────────────────────────────────────────

import type { PoseCategory, PoseDifficulty } from "@/types/pose";

export const POSE_DIFFICULTY_COLORS: Record<PoseDifficulty, string> = {
  easy:   "text-green-400 border-green-400/20",
  medium: "text-yellow-400 border-yellow-400/20",
  hard:   "text-red-400 border-red-400/20",
};

export interface PoseCategoryOption {
  id: PoseCategory;
  label: string;
}

export const POSE_CATEGORY_OPTIONS: PoseCategoryOption[] = [
  { id: "standing", label: "站姿" },
  { id: "sitting",  label: "坐姿" },
  { id: "dancing",  label: "舞蹈" },
  { id: "singing",  label: "演唱" },
  { id: "action",   label: "动作" },
];
