// ─────────────────────────────────────────────────────────────────────────────
// celebrity-zone.ts — AI 明星专区：模板/盲盒双模式 × 多引擎 × 视频生成。
// 设计源：figma 「AI明星专区-生成工作台 v3」 + 「AI明星专区-线框 v2」 + project README。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

// ── 引擎与价格档 ─────────────────────────────────────────────────────────────
export type CelebrityEngine = "KeLing" | "HiGen" | "MiniMax";
export type EnginePriceLevel = "经济" | "标准" | "高级";

export interface EngineMeta {
  name: CelebrityEngine;
  level: EnginePriceLevel;
  /** 内部额度等级（占套餐扣减条数；与 creditPrice 解耦） */
  cost: number;
  /** 单条视频的积分单价（来自后端 /celebrity/engine-pricing 接口） */
  creditPrice: number;
  /** 大致耗时文案，如 "~3分钟" */
  speed: string;
  /** 画质评级（实星数，0~5） */
  quality: 1 | 2 | 3 | 4 | 5;
  desc: string;
  /** 视觉强调色，如 "#22c55e" */
  color: string;
}

// ── 风格 / 类型 ───────────────────────────────────────────────────────────────
export type CelebrityCategory = "演员" | "歌手" | "主持人" | "运动员" | "网红" | "综艺";
export type TemplateStyle =
  | "种草安利"
  | "硬核测评"
  | "轻松开箱"
  | "直播切片"
  | "剧情植入";

export type CelebrityVideoDuration = 15 | 30 | 60;

export type GenerationMode = "template" | "blindbox";

export type CreativeTendency =
  | "不限制"
  | "偏搞笑"
  | "偏温馨"
  | "偏专业"
  | "偏潮流"
  | "偏反转";

// ── 授权 ─────────────────────────────────────────────────────────────────────
/** 4 态授权流转：从未授权 / 待审核 / 已授权 / 已过期 */
export type CelebrityAuthStatus = "unauthorized" | "pending" | "authorized" | "expired";

export type PricingTierName = "体验版" | "标准版" | "旗舰版";

export interface CelebrityAuthorization {
  status: CelebrityAuthStatus;
  /** 已授权场景：带货/种草/测评 等；unauthorized 时为空 */
  scenes: string[];
  /** ISO 日期；unauthorized/pending 时为 undefined */
  expireDate?: ISODate;
  /** 可选风格数 */
  availableStyles: number;
  /** 仅 pending 状态：审核预计耗时文案 */
  pendingNote?: string;
  /** expired/unauthorized 时跳转的申请/续约入口（站内路由） */
  applyUrl?: string;
}

export interface CelebrityPricingTier {
  id: ID;
  name: PricingTierName;
  /** "¥299/条" / "¥1,999/月" */
  price: string;
  features: string[];
  recommended: boolean;
}

export interface CelebritySampleVideo {
  id: ID;
  /** 视频品类标签（用于水印/小标题） */
  label: string;
  category: string;
  /** 缩略图 URL（公开图床） */
  thumb: string;
  /** 视频文件 URL，可选 */
  videoUrl?: string;
}

// ── 明星 ─────────────────────────────────────────────────────────────────────
export interface CelebrityStar {
  id: ID;
  name: string;
  /** 头像 URL（公开图床） */
  avatar: string;
  /** 详情页大图 / 市场卡片 3:4 大图 URL（公开图床） */
  cover: string;
  /** 主分类 */
  category: CelebrityCategory;
  /** 多 tag 显示用 */
  subCategories?: CelebrityCategory[];
  isHot: boolean;
  /** 简介 */
  description: string;
  /** "¥299起" 起拍价文案 */
  startingPrice: string;
  /** 当前用户已购套餐档位；未授权或未购买时 undefined */
  pricingTier?: PricingTierName;
  /** 已用条数；未授权时 undefined */
  quotaUsed?: number;
  /** 套餐总条数；未授权时 undefined */
  quotaTotal?: number;
  authorization: CelebrityAuthorization;
  stats: {
    totalGenerated: number;
    totalPlays: string;
    conversionRate: string;
    gmv: string;
  };
  sampleVideos: CelebritySampleVideo[];
  pricing: CelebrityPricingTier[];
}

// ── 模板 ─────────────────────────────────────────────────────────────────────
export interface CelebrityTemplate {
  id: ID;
  name: string;
  style: TemplateStyle;
  description: string;
  recommendedEngine: CelebrityEngine;
  recommendedPrice: EnginePriceLevel;
  isHot: boolean;
  plays: string;
  conversionRate: string;
  /** 模板适配度提示（口型匹配度等说明文案） */
  fitHint?: string;
  /** 预览（缩略图 + 可选视频）。视频用于真实可播放的列表预览。 */
  previews?: Array<{ thumb: string; videoUrl?: string }>;
}

// ── 项目 ─────────────────────────────────────────────────────────────────────
export type CelebrityProjectStatus = "进行中" | "筹备中" | "已完成";

export interface ChannelStatus {
  id: ID;
  name: "抖音" | "快手" | "小红书" | "视频号" | "B站";
  connected: boolean;
  publishedCount: number;
}

export interface CelebrityProject {
  id: ID;
  name: string;
  starId: ID;
  starName: string;
  starAvatar: string;
  status: CelebrityProjectStatus;
  videoCount: number;
  /** 累计播放展示文案，"-" 表示暂无 */
  totalPlays: string;
  totalInteractions: string;
  conversions: number;
  /** 预估 GMV 展示文案 */
  gmv: string;
  createdAt: ISODate;
  pricingTier: PricingTierName;
  channels: ChannelStatus[];
  quota: { used: number; total: number };
}

// ── 项目视频 ─────────────────────────────────────────────────────────────────
export type ProjectVideoStatus = "已发布" | "待审核" | "生成中" | "已驳回";

export interface CelebrityProjectVideo {
  id: ID;
  projectId: ID;
  projectName: string;
  starId: ID;
  starName: string;
  productName: string;
  status: ProjectVideoStatus;
  /** "12.4K" 之类展示文案；生成中/待审核可能为 undefined */
  plays?: string;
  durationSec: CelebrityVideoDuration;
  engine: CelebrityEngine;
  /** 缩略图 URL（用作 video poster） */
  thumb: string;
  /** 可播放视频 URL（公开样片或 AI 生成静态资源） */
  videoUrl: string;
  createdAt: ISODate;
}

// ── 往期案例（带水印展示） ────────────────────────────────────────────────────
export interface CelebrityShowcase {
  id: ID;
  caption: string;
  engine: CelebrityEngine;
  plays: string;
  approval?: string;
  /** 缩略图 URL */
  thumb?: string;
  /** 可播放视频 URL */
  videoUrl?: string;
}

// ── 商品信息（生成请求） ──────────────────────────────────────────────────────
export interface CelebrityProductInput {
  name: string;
  link?: string;
  images?: string[];
  sellingPoints: string;
}

// ── 生成请求（前端 → 服务端） ────────────────────────────────────────────────
export interface CelebrityGenerationRequest {
  starId: ID;
  mode: GenerationMode;
  templateId?: ID;
  product: CelebrityProductInput;
  engine: CelebrityEngine;
  duration: CelebrityVideoDuration;
  creativeTendency?: CreativeTendency;
  projectId: ID;
  channels?: string[];
}

// ── 步骤条（模板配置流程） ────────────────────────────────────────────────────
export type TemplateConfigStep = "selectTemplate" | "fillProduct" | "selectEngine" | "generate";

// ── 数据中心 ────────────────────────────────────────────────────────────────
export interface CelebrityZoneOverview {
  hero: {
    totalPlays: string;
    totalConversions: string;
    activeStars: number;
  };
  starLeaderboard: Array<{
    starId: ID;
    name: string;
    avatar: string;
    plays: string;
    gmv: string;
    videoCount: number;
  }>;
  weeklyTrend: Array<{ date: ISODate; plays: number; conversions: number }>;
  /** share 0~1 */
  channelMix: Array<{ channel: string; share: number }>;
}
