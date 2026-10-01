// ─────────────────────────────────────────────────────────────────────────────
// 视频生成（web-celebrity「AI 创作 → 视频生成」，v0.199）跨端契约 —— 唯一事实源（CLAUDE.md §4.1）。
// server mirror：apps/server …/videostudio/dto/VideoStudioDtos.java（字段名 1:1）。
// 设计真源：docs/video-studio-plan.md。
//
// 这块区域是把视频模型的原生能力直接搬过来（当前对标 MiniMax H3 的四种模式），
// 不做产品化的封装：模式、规格、素材限制都照厂商合同来，由服务端下发，前端只负责渲染和预检。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

/** 生成模式，取值即厂商 wire 值（H3 generationMode）。 */
export type VideoStudioMode =
  | "t2v"
  | "i2v"
  | "first_last_frame_video"
  | "universal_reference_video";

/** 素材类型。 */
export type VideoStudioMediaType = "image" | "video" | "audio";

/** 一个受控画布：比例 + 像素（厂商固定的六种之一）。 */
export interface VideoStudioCanvas {
  /** "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" */
  aspectRatio: string;
  width: number;
  height: number;
}

/** 一档清晰度及其可选画布。 */
export interface VideoStudioTier {
  /** "768p" | "544p" */
  tier: string;
  canvases: VideoStudioCanvas[];
}

/** 某类素材的限制。 */
export interface VideoStudioMediaLimit {
  mediaType: VideoStudioMediaType;
  /** 本类最多几个（全能参考：图 9 / 视频 1 / 音频 3）。 */
  maxCount: number;
  /** 单个文件上限（字节）。 */
  maxBytes: number;
  /** 展示用格式名，如 ["PNG","JPEG","WEBP"]。 */
  formats: string[];
  /** 单段时长下限（秒）；null = 不限。音频为 2。 */
  minDurationSec: number | null;
  /** 单段时长上限（秒）；null = 不限。音频为 15。 */
  maxDurationSec: number | null;
}

/** 全能参考模式的组合限制。 */
export interface VideoStudioReferenceRules {
  image: VideoStudioMediaLimit;
  video: VideoStudioMediaLimit;
  audio: VideoStudioMediaLimit;
  /** 带了视频时图片最多几张（H3 为 8）。 */
  maxImagesWithVideo: number;
  /** 素材总数上限（H3 为 12）。 */
  maxTotal: number;
  /** 视觉素材（图 + 视频）至少几个（H3 为 1）。 */
  minVisual: number;
  /** 所有音频加起来最长几秒（H3 为 15）。 */
  maxAudioTotalSec: number;
}

/** 某个模式要什么输入。 */
export interface VideoStudioModeSpec {
  mode: VideoStudioMode;
  /** 是否必须传首帧图（i2v / 首尾帧）。 */
  needsFirstFrame: boolean;
  /** 是否必须传尾帧图（首尾帧）。 */
  needsLastFrame: boolean;
  /** 首帧 / 尾帧图的限制；本模式不用帧图时为 null。 */
  frameImage: VideoStudioMediaLimit | null;
  /** 参考素材规则；只有全能参考非 null。 */
  references: VideoStudioReferenceRules | null;
}

/** 一个模型的完整合同（服务端下发，前端不写死）。 */
export interface VideoStudioContract {
  modes: VideoStudioModeSpec[];
  tiers: VideoStudioTier[];
  /** 有效时长区间（秒，整数）= 厂商硬边界 ∩ 后台候选配置。 */
  minSeconds: number;
  maxSeconds: number;
  /** 提示词最多多少个字符（去掉首尾空白后，按 Unicode 字符数）。 */
  promptMaxChars: number;
  /** 随机种子上限（含）；下限为 0。 */
  seedMax: number;
}

/**
 * 计价参数（v0.199 起**我们自己定、后台可配**，不照搬厂商价格；服务端算好下发，前端据此显示报价，
 * 提交时服务端用同一组数冻结积分）。
 *
 * 生成：总价 = (perSecond[模式][清晰度] + 超出张数 × extraRefImagePerSecond) × 秒数；
 *       超出张数 = max(0, 全能参考的图片张数 − freeRefImages)，其他模式为 0。
 *       perSecond 某一格为 null = 这个组合还没定价，不能提交（不回落任何写死的价）。
 * 智能优化：每次 promptOptimizationPerCall（0 = 不收费），与生成分开扣。
 */
export interface VideoStudioPricing {
  /** 每秒价：按模式、清晰度（"768p" / "544p"）。null = 未定价。 */
  perSecond: Record<VideoStudioMode, Record<string, number | null>>;
  /** 全能参考里前几张参考图不加价。 */
  freeRefImages: number;
  /** 全能参考第 freeRefImages+1 张起，每张每秒加价（0 = 不加）。 */
  extraRefImagePerSecond: number;
  /** 智能优化每次多少积分（0 = 不收费）。 */
  promptOptimizationPerCall: number;
}

/**
 * 后台「引擎定价 → 视频生成」那一页编辑的配置（GET/PUT /admin/celebrity/video-studio-pricing）。
 * 与 {@link VideoStudioPricing} 的区别：这里的 null 表示「这一格不单独定价，按后台给模型配的每秒价」，
 * 而下发给用户的 pricing 已经把这层回落算好了（仍是 null 就是真没价）。
 */
export interface VideoStudioPricingConfig {
  perSecond: Record<VideoStudioMode, Record<string, number | null>>;
  freeRefImages: number;
  extraRefImagePerSecond: number;
  promptOptimizationPerCall: number;
}

/** 可选模型（GET /me/celebrity/video-studio/models 的一项）。 */
export interface VideoStudioModel {
  endpointId: string;
  /** 展示名（后台端点名）。 */
  name: string;
  isDefault: boolean;
  /** false = 合成的默认项（无候选行），提交时必须省略 endpointId。 */
  selectableById: boolean;
  contract: VideoStudioContract;
  pricing: VideoStudioPricing;
}

/** 上传一个素材的结果（POST /me/celebrity/video-studio/uploads）。 */
export interface VideoStudioUpload {
  /** 存储 key；提交任务时原样带回。 */
  key: string;
  /** 短期签名地址，只用于预览。 */
  url: string;
  mediaType: VideoStudioMediaType;
  bytes: number;
  /** 原文件名（展示用）。 */
  name: string;
  /** 音频 / 视频的时长（秒，可带小数）；图片为 null。 */
  durationSec: number | null;
  /** 图片 / 视频的像素；读不到为 null。 */
  width: number | null;
  height: number | null;
}

/** 全能参考的一项素材。顺序有意义：同类素材按出现顺序编号（图1、图2…）。 */
export interface VideoStudioReferenceInput {
  mediaType: VideoStudioMediaType;
  key: string;
}

/** 提交一条生成任务（POST /me/celebrity/video-studio/jobs）。 */
export interface VideoStudioJobRequest {
  /** 省略 = 默认端点；selectableById=false 的模型必须省略。 */
  endpointId?: string | null;
  mode: VideoStudioMode;
  prompt: string;
  /** "768p" | "544p" */
  resolutionTier: string;
  /** 所选清晰度下的六种比例之一。 */
  aspectRatio: string;
  seconds: number;
  /** 0 ~ seedMax；不传 = 随机。 */
  seed?: number | null;
  /** i2v / 首尾帧必填：首帧图的 key。 */
  firstFrameKey?: string | null;
  /** 首尾帧必填：尾帧图的 key。 */
  lastFrameKey?: string | null;
  /** 全能参考必填（1 ~ maxTotal 项）。 */
  references?: VideoStudioReferenceInput[] | null;
  /**
   * 做同款时带上模板 id：此时素材 key 既可以是自己上传的，也可以是这个模板自带的原素材
   * （服务端按模板核对，别的 key 一律拒）。
   */
  templateId?: ID | null;
  /** 用了智能优化的结果时带上优化记录 id（服务端核对归属，记下原提示词）。 */
  optimizationId?: ID | null;
}

export type VideoStudioJobStatus = "queued" | "running" | "succeeded" | "failed";

/** 任务用到的一个输入素材（回显用）。 */
export interface VideoStudioJobInput {
  mediaType: VideoStudioMediaType;
  /** 首帧 / 尾帧 / 图1 / 视频1 / 音频1 … */
  label: string;
  /** 短期签名地址；素材已被删除时为 null。 */
  url: string | null;
}

/** 一条生成任务（GET /me/celebrity/video-studio/jobs[/{id}]）。 */
export interface VideoStudioJob {
  id: ID;
  mode: VideoStudioMode;
  prompt: string;
  resolutionTier: string;
  aspectRatio: string;
  /** 画布像素；查不到为 null。 */
  width: number | null;
  height: number | null;
  seconds: number;
  seed: number | null;
  /** 实际调用的模型展示名；还没提交到厂商时为 null。 */
  modelName: string | null;
  status: VideoStudioJobStatus;
  /** 0 ~ 100。 */
  progressPct: number;
  /** 进度文案（已入队 / 提交生成请求 / AI 生成中 / 已完成 / 生成失败）。 */
  stage: string;
  inputs: VideoStudioJobInput[];
  /** 成片短期签名地址；未完成为 null。 */
  videoUrl: string | null;
  thumbnailUrl: string | null;
  /** 失败原因（可直接给用户看）；未失败为 null。 */
  errorMessage: string | null;
  /** 本条冻结 / 扣除的积分：进行中 = 已冻结，成功 = 已扣，失败 = 已退回。 */
  credits: number;
  /** 用了智能优化时的原提示词（prompt 是最终送去生成的那版）；没优化为 null。 */
  originalPrompt: string | null;
  /** 做同款时来自哪个模板；不是做同款为 null。 */
  templateId: ID | null;
  createdAt: ISODateTime;
  completedAt: ISODateTime | null;
}

// ── 智能优化（v0.199，厂商 POST /media/prompt-optimizations；同步但最长要等约 10 分钟，所以我们做成后台任务）──

export type VideoStudioOptimizationStatus = "queued" | "running" | "succeeded" | "failed";

/**
 * 发起一次智能优化（POST /me/celebrity/video-studio/prompt-optimizations）。
 * 与生成请求同一套字段（优化要按模式和素材来改写），外加防重复点击的 clientRequestId。
 */
export interface VideoStudioOptimizationRequest {
  /** 前端生成的唯一串（8~128 个可见 ASCII），同一次点击重试时不变。 */
  clientRequestId: string;
  endpointId?: string | null;
  mode: VideoStudioMode;
  prompt: string;
  resolutionTier: string;
  aspectRatio: string;
  seconds: number;
  firstFrameKey?: string | null;
  lastFrameKey?: string | null;
  references?: VideoStudioReferenceInput[] | null;
  templateId?: ID | null;
}

/** 一次智能优化（GET /me/celebrity/video-studio/prompt-optimizations/{id}）。 */
export interface VideoStudioOptimization {
  id: ID;
  status: VideoStudioOptimizationStatus;
  originalPrompt: string;
  /** 优化后的完整提示词；成功前为 null。用户可以改了再用。 */
  optimizedPrompt: string | null;
  /** 失败原因（可直接给用户看）。 */
  errorMessage: string | null;
  /** 本次冻结 / 扣除的积分（进行中 = 冻结，成功 = 扣除，失败 = 已退回）。 */
  credits: number;
  createdAt: ISODateTime;
  completedAt: ISODateTime | null;
}

// ── 模板 / 做同款（v0.199）──
// 普通用户存的模板只有自己能用；运营账号（operatorRole = operator / super_admin）可以发布全员可见的官方模板。
// 模板带着原作的素材（首帧 / 尾帧 / 参考素材），做同款的人可以直接用，也可以逐个换成自己的。

export type VideoStudioTemplateScope = "official" | "private";

/** 模板里的一个原素材。做同款时可以原样带回（配合 templateId），也可以换成自己上传的。 */
export interface VideoStudioTemplateMaterial {
  role: "first_frame" | "last_frame" | "reference";
  mediaType: VideoStudioMediaType;
  /** 素材 key：做同款时原样放进请求（firstFrameKey / lastFrameKey / references[].key）。 */
  key: string;
  /** 首帧 / 尾帧 / 图1 / 视频1 / 音频1 … */
  label: string;
  /** 短期签名地址，预览用；素材已删除时为 null。 */
  url: string | null;
}

export interface VideoStudioTemplate {
  id: ID;
  scope: VideoStudioTemplateScope;
  title: string;
  description: string | null;
  mode: VideoStudioMode;
  prompt: string;
  resolutionTier: string;
  aspectRatio: string;
  seconds: number;
  seed: number | null;
  /** 原作用的模型；做同款时若还能选就默认选它。 */
  endpointId: string | null;
  modelName: string | null;
  materials: VideoStudioTemplateMaterial[];
  /** 原作成片（短期签名地址）。 */
  previewVideoUrl: string | null;
  previewThumbnailUrl: string | null;
  /** 有多少次「做同款」提交。 */
  useCount: number;
  /** 是不是当前用户自己存的（能删）。 */
  mine: boolean;
  createdAt: ISODateTime;
}

/** 把一条成功的生成记录存成模板（POST /me/celebrity/video-studio/templates）。 */
export interface VideoStudioTemplateCreateRequest {
  jobId: ID;
  /** 1~40 个字。 */
  title: string;
  /** 0~200 个字。 */
  description?: string | null;
  /** 发布为官方模板（全员可见）；只有运营账号能传 true。 */
  official?: boolean;
}
