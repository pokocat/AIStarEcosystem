// ─────────────────────────────────────────────────────────────────────────────
// celebrity-zone.ts — AI 明星专区：模板/盲盒双模式 × 多引擎 × 视频生成。
// 设计源：figma 「AI明星专区-生成工作台 v3」 + project README。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

// ── 引擎与价格档 ─────────────────────────────────────────────────────────────
export type CelebrityEngine = "KeLing" | "HiGen" | "MiniMax";
export type EnginePriceLevel = "经济" | "标准" | "高级";

export interface EngineMeta {
  name: CelebrityEngine;
  level: EnginePriceLevel;
  /** 单条消耗额度数 */
  cost: number;
  /** 大致耗时文案，如 "~3分钟" */
  speed: string;
  /** 画质评级（实星数，0~5） */
  quality: 1 | 2 | 3 | 4 | 5;
  desc: string;
  /** 视觉强调色，如 "#22c55e" */
  color: string;
}

// ── 风格 / 类型 ───────────────────────────────────────────────────────────────
export type CelebrityCategory = "演员" | "歌手" | "主持人" | "运动员" | "网红";
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

// ── 明星 ─────────────────────────────────────────────────────────────────────
export interface CelebrityStar {
  id: ID;
  name: string;
  avatar: string;
  category: CelebrityCategory;
  isHot: boolean;
  /** 当前用户已购买的套餐档位 */
  pricingTier: "体验版" | "标准版" | "旗舰版";
  /** 套餐已使用条数 */
  quotaUsed: number;
  /** 套餐总条数 */
  quotaTotal: number;
}

// ── 模板 ─────────────────────────────────────────────────────────────────────
export interface CelebrityTemplate {
  id: ID;
  name: string;
  style: TemplateStyle;
  description: string;
  /** 推荐引擎 */
  recommendedEngine: CelebrityEngine;
  recommendedPrice: EnginePriceLevel;
  isHot: boolean;
  /** 累计播放量展示文案，如 "12.5K" */
  plays: string;
  /** 转化率展示文案，如 "3.8%" */
  conversionRate: string;
  /** 模板适配度提示（口型匹配度等说明文案） */
  fitHint?: string;
}

// ── 项目（用于归属选择） ──────────────────────────────────────────────────────
export type CelebrityProjectStatus = "进行中" | "筹备中" | "已完成";

export interface CelebrityProject {
  id: ID;
  name: string;
  starName: string;
  status: CelebrityProjectStatus;
  videoCount: number;
  /** 累计播放展示文案 */
  totalPlays: string;
  /** 预估 GMV 展示文案 */
  gmv: string;
  createdAt: ISODate;
}

// ── 往期案例（带水印展示） ────────────────────────────────────────────────────
export interface CelebrityShowcase {
  id: ID;
  /** 商品名（template 模式） 或 风格描述（blindbox 模式） */
  caption: string;
  engine: CelebrityEngine;
  /** 播放量展示文案 */
  plays: string;
  /** 盲盒模式下的好评率展示文案，如 "👍 88%好评" */
  approval?: string;
}

// ── 商品信息（生成请求） ──────────────────────────────────────────────────────
export interface CelebrityProductInput {
  name: string;
  link?: string;
  /** 上传的商品图片 URL 列表 */
  images?: string[];
  sellingPoints: string;
}

// ── 生成请求（前端 → 服务端） ────────────────────────────────────────────────
export interface CelebrityGenerationRequest {
  starId: ID;
  mode: GenerationMode;
  /** 仅 template 模式 */
  templateId?: ID;
  product: CelebrityProductInput;
  engine: CelebrityEngine;
  duration: CelebrityVideoDuration;
  /** 仅 blindbox 模式 */
  creativeTendency?: CreativeTendency;
  /** 归属项目 ID */
  projectId: ID;
  /** 分发渠道（id 列表） */
  channels?: string[];
}

// ── 步骤条（模板配置流程） ────────────────────────────────────────────────────
export type TemplateConfigStep = "selectTemplate" | "fillProduct" | "selectEngine" | "generate";
