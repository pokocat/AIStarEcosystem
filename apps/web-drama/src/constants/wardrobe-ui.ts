// ─────────────────────────────────────────────────────────────────────────────
// wardrobe-ui.ts — 服装系统 UI 配置（稀有度样式、分类筛选、槽位标签）。
// ─────────────────────────────────────────────────────────────────────────────

import { ShoppingBag, Shirt, Crown, Footprints, Sparkles, type LucideIcon } from "lucide-react";
import type { Rarity } from "@ai-star-eco/types/_shared";
import type { ClothingCategory, EquipSlot } from "@ai-star-eco/types/wardrobe";

export const RARITY_COLORS: Record<Rarity, string> = {
  common:    "text-gray-400 border-gray-400/20",
  rare:      "text-blue-400 border-blue-400/20",
  epic:      "text-purple-400 border-purple-400/20",
  legendary: "text-yellow-400 border-yellow-400/20",
};

export const RARITY_GLOW: Record<Rarity, string> = {
  common:    "shadow-gray-500/10",
  rare:      "shadow-blue-500/20",
  epic:      "shadow-purple-500/30",
  legendary: "shadow-yellow-500/40",
};

export const RARITY_STAR_COUNT: Record<Rarity, number> = {
  common: 2, rare: 3, epic: 4, legendary: 5,
};

export interface WardrobeCategoryOption {
  /** "all" 表示不筛选；其它为 ClothingCategory。 */
  id: "all" | ClothingCategory;
  label: string;
  icon: LucideIcon;
}

export const WARDROBE_CATEGORY_OPTIONS: WardrobeCategoryOption[] = [
  { id: "all",       label: "全部", icon: ShoppingBag },
  { id: "top",       label: "上衣", icon: Shirt },
  { id: "bottom",    label: "下装", icon: Shirt },
  { id: "accessory", label: "配饰", icon: Crown },
  { id: "shoes",     label: "鞋子", icon: Footprints },
  { id: "hair",      label: "发型", icon: Sparkles },
];

export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  top:       "上衣",
  bottom:    "下装",
  accessory: "配饰",
  shoes:     "鞋子",
  hair:      "发型",
};
