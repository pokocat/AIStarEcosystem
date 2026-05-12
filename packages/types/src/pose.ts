// ─────────────────────────────────────────────────────────────────────────────
// pose.ts — 姿态 / 表情 / 手势（动作捕捉）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "./_shared";

export type PoseCategory = "standing" | "sitting" | "dancing" | "singing" | "action";
export type PoseDifficulty = "easy" | "medium" | "hard";

export type SaleStatus = "FREE" | "PAID" | "LOCKED";

export interface Pose {
  id: ID;
  name: string;
  category: PoseCategory;
  thumbnail: string;
  difficulty: PoseDifficulty;
  isLocked?: boolean;
  isNew?: boolean;
  animation?: string;
  priceCredits?: number;
  saleStatus?: SaleStatus;
  previewUrl?: string;
  owned?: boolean;
}

export type ExpressionCategory = "happy" | "sad" | "cool" | "surprised" | "other";

export interface Expression {
  id: ID;
  name: string;
  emoji: string;
  intensity: number;
  category: ExpressionCategory;
  priceCredits?: number;
  saleStatus?: SaleStatus;
  previewUrl?: string;
  owned?: boolean;
}

export interface Gesture {
  id: ID;
  name: string;
  icon: string;
  category: string;
  priceCredits?: number;
  saleStatus?: SaleStatus;
  previewUrl?: string;
  owned?: boolean;
}
