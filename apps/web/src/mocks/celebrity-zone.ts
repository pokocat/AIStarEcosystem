// ─────────────────────────────────────────────────────────────────────────────
// mocks/celebrity-zone.ts — 明星专区：演示数据。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityStar,
  CelebrityTemplate,
  CelebrityProject,
  CelebrityShowcase,
} from "@/types/celebrity-zone";

export const ACTIVE_STAR: CelebrityStar = {
  id: "star-zhang",
  name: "张某某",
  avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80",
  category: "演员",
  isHot: true,
  pricingTier: "标准版",
  quotaUsed: 27,
  quotaTotal: 50,
};

export const CELEBRITY_TEMPLATES: CelebrityTemplate[] = [
  {
    id: "tpl-bff-recommend",
    name: "闺蜜种草",
    style: "种草安利",
    description: "闺蜜对话场景，自然推荐商品，亲和力强，适合美妆/日用品。",
    recommendedEngine: "HiGen",
    recommendedPrice: "标准",
    isHot: true,
    plays: "12.5K",
    conversionRate: "3.8%",
    fitHint: "口型匹配度 92%",
  },
  {
    id: "tpl-pro-review",
    name: "专业测评",
    style: "硬核测评",
    description: "正面镜头 + 产品特写，逐项分析产品优缺点，适合数码/家电。",
    recommendedEngine: "HiGen",
    recommendedPrice: "标准",
    isHot: false,
    plays: "8.2K",
    conversionRate: "4.1%",
  },
  {
    id: "tpl-unbox",
    name: "开箱惊喜",
    style: "轻松开箱",
    description: "拆包裹 + 第一反应，悬念感强，适合新品/礼盒。",
    recommendedEngine: "MiniMax",
    recommendedPrice: "高级",
    isHot: true,
    plays: "15.1K",
    conversionRate: "2.9%",
  },
  {
    id: "tpl-live-clip",
    name: "直播片段",
    style: "直播切片",
    description: "模拟直播间风格，紧迫感强的口播带货，适合限时促销。",
    recommendedEngine: "HiGen",
    recommendedPrice: "标准",
    isHot: false,
    plays: "20.3K",
    conversionRate: "5.2%",
  },
  {
    id: "tpl-vlog",
    name: "日常 Vlog",
    style: "种草安利",
    description: "日常场景中自然露出商品，生活化表达，适合食品/饮品。",
    recommendedEngine: "KeLing",
    recommendedPrice: "经济",
    isHot: false,
    plays: "6.8K",
    conversionRate: "2.4%",
  },
  {
    id: "tpl-plot-twist",
    name: "剧情反转",
    style: "剧情植入",
    description: "15 秒小剧场 + 产品解决问题的反转，适合功效型产品。",
    recommendedEngine: "MiniMax",
    recommendedPrice: "高级",
    isHot: true,
    plays: "18.7K",
    conversionRate: "3.5%",
  },
];

export const CELEBRITY_PROJECTS: CelebrityProject[] = [
  {
    id: "proj-618-beauty",
    name: "618大促 · 美妆专场",
    starName: "张某某",
    status: "进行中",
    videoCount: 12,
    totalPlays: "444K",
    gmv: "¥67.8K",
    createdAt: "2026-04-01",
  },
  {
    id: "proj-summer-drink",
    name: "夏日饮品种草季",
    starName: "张某某",
    status: "筹备中",
    videoCount: 3,
    totalPlays: "12.4K",
    gmv: "¥4.2K",
    createdAt: "2026-04-22",
  },
];

// 模板模式：往期生成案例
export const TEMPLATE_SHOWCASES: CelebrityShowcase[] = [
  { id: "case-1", caption: "口红", engine: "HiGen", plays: "3.2K" },
  { id: "case-2", caption: "面霜", engine: "MiniMax", plays: "5.8K" },
  { id: "case-3", caption: "香水", engine: "KeLing", plays: "1.9K" },
];

// 盲盒模式：往期作品
export const BLINDBOX_SHOWCASES: CelebrityShowcase[] = [
  {
    id: "bb-1",
    caption: "AI 选了种草风格",
    engine: "HiGen",
    plays: "2.1K",
    approval: "👍 88%好评",
  },
  {
    id: "bb-2",
    caption: "AI 选了剧情反转",
    engine: "MiniMax",
    plays: "4.6K",
    approval: "👍 95%好评",
  },
  {
    id: "bb-3",
    caption: "AI 选了 Vlog 风格",
    engine: "KeLing",
    plays: "1.2K",
    approval: "👍 72%好评",
  },
];
