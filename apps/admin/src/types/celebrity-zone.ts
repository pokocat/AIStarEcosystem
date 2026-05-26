// ─────────────────────────────────────────────────────────────────────────────
// celebrity-zone.ts — AI 明星专区：模板/盲盒双模式 × 多引擎 × 视频生成。
// 设计源：figma 「AI明星专区-生成工作台 v3」 + 「AI明星专区-线框 v2」 + project README。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate, ISODateTime } from "./_shared";

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

// ── 明星资料图集与视频（v0.4：admin 后台上传 → 详情页展示） ─────────────────
/** 明星资料图集中的单图 */
export interface CelebrityStarPhoto {
  id: ID;
  /** 公开图床 URL */
  url: string;
  /** 图注（如"形象照·演播厅"） */
  caption?: string;
}

/** 明星形象/代言视频 */
export interface CelebrityStarVideo {
  id: ID;
  title: string;
  /** 时长秒数 */
  durationSec: number;
  /** 缩略图 URL */
  coverUrl?: string;
  /** 可播放视频 URL */
  playUrl?: string;
  /** 视频标签：代言 / 综艺 / 介绍 等 */
  tag?: string;
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

  // ── v0.4 字段：详情页扩展（带货方小程序消费） ──────────────────────────────
  /** 一段简介，约 50-200 字 */
  bio?: string;
  /** 所在地，如 "上海 / 北京" */
  location?: string;
  /** 粉丝数（原始整数，前端用 formatCompactNumber 格式化） */
  fans?: number;
  /** 历史合作次数 */
  cooperationCount?: number;
  /** 历史平均单条 GMV（人民币元，原始整数） */
  avgGmv?: number;
  /** 资料图集（admin 后台上传） */
  photos?: CelebrityStarPhoto[];
  /** 形象/代言视频（admin 后台上传） */
  videos?: CelebrityStarVideo[];
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

  // ── v0.4 字段：模板效果预览（admin 后台上传整段预览视频，小程序点缩略图弹层播放） ──
  /** 缩略图 URL */
  previewCover?: string;
  /** 整段效果预览视频 URL */
  previewVideoUrl?: string;
  /** 推荐时长 */
  durationSec?: CelebrityVideoDuration;

  // ── v0.34 字段：工厂 vs 用户私有模板归属 ──────────────────────────────────
  isFactory: boolean;
  ownerScope: string;
  ownerUserId?: ID | null;
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

  // ── v0.4 字段：模型选择 + 动态扣分（小程序生成器使用） ────────────────────
  /** 引擎名（与 engine 字段冗余，用于 mini-program 简单 payload） */
  engineName?: CelebrityEngine;
  /** 时长秒数（与 duration 字段冗余） */
  durationSec?: CelebrityVideoDuration;
  /** 本次生成预计消耗积分（前端按 engine.creditPrice × 时长系数计算后透传） */
  creditCost?: number;
  /** 文案语言：普通话 / 粤语 / 英语 */
  language?: string;
  /** 关键卖点（选填，AI 推荐勾选项） */
  keypoints?: string[];
}

// ── 步骤条（模板配置流程） ────────────────────────────────────────────────────
export type TemplateConfigStep = "selectTemplate" | "fillProduct" | "selectEngine" | "generate";

// ── v0.5：模板脚本系统（TemplateScript，对齐 docs/ADMIN_PRODUCT_SPEC.md §3.2.7） ────

/** 脚本生命周期 */
export type TemplateScriptStatus = "draft" | "in_review" | "published" | "archived";

/** 双模选择：text = 结构化分镜 / video_ref = 上传参考视频 */
export type TemplateScriptKind = "text" | "video_ref";

/** 角色画像（明星该"演什么"） */
export interface TemplateScriptPersona {
  voiceTone: string;
  speakingStyle: string;
  personality: string[];
  forbiddenTone: string[];
}

/** 单个分镜（text 模式必填；video_ref 可选叠加） */
export interface Scene {
  id: ID;
  order: number;
  durationSec: number;
  shotType: "近景" | "中景" | "远景" | "特写" | "运镜";
  cameraMotion?: "推" | "拉" | "摇" | "移" | "跟" | "静止";
  composition: string;
  setting: string;
  props?: string[];
  action: string;
  expression: string;
  gestureRefs?: ID[];
  dialogue: string;
  voiceEmotion: "calm" | "excited" | "warm" | "professional";
  onScreenText?: string;
  productAppearance: {
    angle: "front" | "side" | "top" | "in_use";
    durationSec: number;
    closeUpFraming: string;
  };
  positivePromptFragment: string;
  negativePromptFragment?: string;
}

/** 视觉风格修饰 */
export interface TemplateVisualStyle {
  lighting: string;
  colorPalette: string[];
  cinematography: string;
  referenceUrls?: string[];
}

/** 变量插槽 */
export interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "textArray" | "number" | "image" | "enum";
  source: "product" | "star" | "engine" | "duration" | "manual";
  required: boolean;
  default?: string;
  enumValues?: string[];
  maxLength?: number;
  examples?: string[];
}

/** 引擎适配器：同一脚本可装配为三引擎方言 */
export interface EngineAdapter {
  enabled: boolean;
  /** 顶层 prompt 模板，可引用 {{systemPrompt}} / {{scenes}} / 任意变量 */
  promptTemplate: string;
  /** 引擎专属参数 */
  params: {
    aspectRatio?: "9:16" | "16:9" | "1:1";
    fps?: 24 | 30 | 60;
    seed?: number;
    cfgScale?: number;
    [key: string]: unknown;
  };
  /** 后端调用引擎时的请求体 schema 引用 */
  requestSchemaRef?: string;
  /** 引擎拒绝/超时时的兜底 */
  fallbackEngine?: CelebrityEngine;
}

/** 时长适配 */
export interface TemplateDurationVariant {
  sceneIds: ID[];
  cutHint: string;
}

/** 后处理（剪辑/字幕/水印/BGM） */
export interface TemplatePostProcess {
  subtitleTemplate: string;
  watermarkPolicy: "always" | "if_unauth" | "never";
  bgmCategory?: string;
  transitionStyle?: string;
}

/** 风控 */
export interface TemplateSafety {
  forbiddenWords: string[];
  requiredDisclaimers: string[];
  brandRestrictions?: string[];
}

/** A/B 实验 */
export interface TemplateExperiment {
  bucket: "A" | "B";
  rolloutPct: number;
  siblingScriptId?: ID;
}

/** 评估反馈（系统回填） */
export interface TemplateMetrics {
  runs: number;
  avgPlays: number;
  conversionRate: number;
  avgFitScore: number;
  rejectRate: number;
}

/** 视频参考片段（kind="video_ref" 专属） */
export interface TemplateReferenceClip {
  videoUrl: string;
  thumbUrl: string;
  durationSec: number;
  meta: {
    width: number;
    height: number;
    fps: number;
    codec: string;
    sizeBytes: number;
  };
  /** 参考用途：决定模型如何"用"这段素材 */
  usage: "style" | "structure" | "rhythm" | "all";
  /** 影响强度 0–1，越高越接近参考视频 */
  influence: number;
  /** 重点参考片段（视频内时间窗） */
  segments?: Array<{ startSec: number; endSec: number; note: string }>;
  /** 系统抽帧产物（v0.6 自动产生；v0.5 手填可空） */
  keyFrames?: Array<{ url: string; tSec: number; tags?: string[] }>;
  /** 系统检测产物（v0.6 自动；v0.5 可空） */
  autoAnalysis?: {
    detectedShots: Array<{ tSec: number; shotType: string }>;
    detectedBgmBpm?: number;
    dominantColors?: string[];
    suggestedScenes?: Scene[];
  };
  /** 版权 / 授权 */
  license: {
    source: "self_owned" | "licensed" | "platform_official";
    licenseDoc?: string;
    expireAt?: ISODate;
    creditTo?: string;
  };
  /** 风控状态 */
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNotes?: string;
  reviewedBy?: ID;
}

/** 模板脚本 — 视频生成的真正"剧本" */
export interface TemplateScript {
  id: ID;
  templateId: ID;
  version: number;
  status: TemplateScriptStatus;
  language: "zh-CN";

  /** 模式选择 */
  kind: TemplateScriptKind;

  /** video_ref 模式专属 */
  referenceClip?: TemplateReferenceClip;

  /** 角色画像 */
  persona: TemplateScriptPersona;

  /** 系统提示 */
  systemPrompt: string;

  /** 场景序列（text 模式必填；video_ref 模式可空） */
  scenes: Scene[];

  /** 风格修饰 */
  visualStyle: TemplateVisualStyle;

  /** 负向提示 */
  negativePrompt: string;

  /** 变量插槽 */
  variables: TemplateVariable[];

  /** 引擎适配（同时可注册三引擎） */
  engineAdapters: {
    KeLing?: EngineAdapter;
    HiGen?: EngineAdapter;
    MiniMax?: EngineAdapter;
  };

  /** 时长适配 */
  durationVariants: {
    "15"?: TemplateDurationVariant;
    "30"?: TemplateDurationVariant;
    "60"?: TemplateDurationVariant;
  };

  /** 后处理 */
  postProcess: TemplatePostProcess;

  /** 风控 */
  safety: TemplateSafety;

  /** A/B 实验（可选） */
  experiment?: TemplateExperiment;

  /** 系统回填指标 */
  metrics?: TemplateMetrics;

  createdAt: ISODateTime;
  publishedAt?: ISODateTime;
  publishedBy?: ID;
}

// ── PromptAssemblyService 输入/输出（dry-run 与生成器都用） ──────────────

/** 试跑请求（运营在 admin 编辑器填模拟入参） */
export interface DryRunRequest {
  engine: CelebrityEngine;
  durationSec: 15 | 30 | 60;
  product: CelebrityProductInput;
  starId: ID;
  variables?: Record<string, string | string[]>;
}

/** 装配后的引擎请求（PromptAssemblyService 的输出） */
export interface EngineRequestBody {
  engine: CelebrityEngine;
  positive: string;
  negative: string;
  params: Record<string, unknown>;
  /** video_ref 模式才有 */
  videoReference?: {
    url: string;
    usage: "style" | "structure" | "rhythm" | "all";
    influence: number;
    segments?: Array<{ startSec: number; endSec: number }>;
  };
  fallbackEngine?: CelebrityEngine;
}

export interface DryRunResponse {
  scriptId: ID;
  scriptVersion: number;
  request: EngineRequestBody;
  /** 风控 / 变量缺失等的诊断信息 */
  warnings?: string[];
}

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
