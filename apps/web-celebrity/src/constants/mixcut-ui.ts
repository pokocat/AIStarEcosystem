// 混剪专区 UI 常量（从 mixcut/frontend/lib/types.ts 末段剥离）
// 与 constants/celebrity-zone-ui.ts 对称：枚举映射、tone 颜色、文案配套。

import type { Tier, PerturbationProfile } from "@/components/mixcut-zone/types";

export const TIER_LABELS: Record<Tier, string> = {
  trial: "体验版",
  basic: "基础版",
  standard: "标准版",
  professional: "专业版",
  annual_pro: "年度专业版",
  city_agent: "城市代理",
};

export const TIER_COLORS: Record<Tier, string> = {
  trial: "muted",
  basic: "secondary",
  standard: "default",
  professional: "brand",
  annual_pro: "brand",
  city_agent: "warning",
};

export const PROFILE_LABELS: Record<PerturbationProfile, string> = {
  light: "轻度扰动",
  moderate: "中度扰动",
  aggressive: "高强度扰动",
};

export const PROFILE_DESCRIPTIONS: Record<PerturbationProfile, string> = {
  light: "色彩/速度微调,画面变化小,渲染最快",
  moderate: "推荐档:含镜像、噪点、slot 位置抖动,平衡量产与差异化",
  aggressive: "画中画 + 前景遮罩 + 大幅参数扰动,差异最大但偶有质量损失",
};
