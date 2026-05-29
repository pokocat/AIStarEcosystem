// ─────────────────────────────────────────────────────────────────────────────
// 素材运营（material-ops）领域类型 —— 迁自「素材运营平台」原型（声量算法运营端）。
//
// 策略：复用并改造现有 celebrity 实体，而非另起平行模型。
//   · 商品          → 直接复用 packages/types 的 `Product`（这里用 MaterialProduct 薄扩展）
//   · 视频资产       → 字段对齐 mixcut `RenderOutput`/`RenderJob`（file_url/thumbnail_url/cdn_url/
//                      status/progress/publish_count/product_id/parent），追加原型独有的
//                      script_id / variant_config(6 轴) / metrics / kind
//   · 脚本资产       → 概念对齐 celebrity-zone `TemplateScript`/`Scene`（blocks≈Scene），
//                      追加 tier/kind/source/metrics
//   · 爆款 / 变量轴 / 视频结构化配置 → 原型独有，新增类型
// 仅前端 + Mock；不落 server / openapi。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product } from "@ai-star-eco/types/product";

// ── 分级 / 来源 ──────────────────────────────────────────────────────────────
export type Tier = "S" | "A" | "B" | "D"; // 爆款 / 优质 / 普通 / 草稿
export type AssetKind = "my_script" | "template" | "viral_clone" | "ai_seed";
export type PlatformId = "douyin" | "xhs" | "wechat" | "kuaishou";
export type ShotKind = "hook" | "scene" | "emotion" | "product" | "effect" | "cta";

// ── 商品（复用 Product + 展示扩展） ───────────────────────────────────────────
// 原型 PRODUCTS 的 color/audience/suggested_angles 在 celebrity Product 上没有，
// 作为 mock 展示字段挂在 MaterialProduct 上；商品缩略图走真实后端 Product.images（无图回退首字
// monogram，见 shared.ProductThumb）；price/commission 走 Product 的 priceCents/commissionRate。
export interface MaterialProduct extends Product {
  accentColor?: string;
  stock?: number;
  /** 卖点 chip 列表（Product.sellingPoints 是单串，这里拆开供 hero 展示） */
  sellingPointList?: string[];
  audience?: string[];
  suggestedAngles?: string[];
}

// ── 脚本资产（对齐 celebrity-zone TemplateScript/Scene，blocks≈Scene） ─────────
export interface ScriptBlock {
  kind: ShotKind;
  label: string;
  /** 时长（秒），对齐 Scene.durationSec */
  dur: number;
  /** 字幕 / 口播语音（要念出来、显示为字幕的台词；会用于 TTS 配音 + 字幕条） */
  text: string;
  /** 脚本 / 画面 / 分镜（这一镜画面里发生什么、怎么拍：场景/动作/运镜/产品出现） */
  shot: string;
  /** 是否为该镜生成字幕 / 口播语音（默认生成；取消则该镜为纯画面，无配音/字幕） */
  genVoice?: boolean;
}

export interface ScriptMetrics {
  uses_count: number;
  ctr_pct: number;
  diversity_pct: number;
  completion_pct: number;
  best_video: { script_id: string; plays: string; likes: string; gmv: string } | null;
  last_used_at: string;
}

export interface ScriptSource {
  type: "user" | "viral" | "system" | "ai";
  ref_id?: string | null;
  original_url?: string | null;
  cloned_from?: string | null;
  author: string;
}

export interface ScriptAsset {
  id: string;
  kind: AssetKind;
  name: string;
  title?: string;
  tier: Tier;
  category: string;
  hook_type: string;
  audience: string[];
  platforms: PlatformId[];
  duration_sec: number;
  blocks: ScriptBlock[];
  metrics: ScriptMetrics;
  source: ScriptSource;
  tags: string[];
  cover_color: string;
  /** 关联商品 id（复用 Product.id；mock 里显式链接，避免靠 category 模糊匹配） */
  product_id?: string;
  /** 关联商品（编辑/预览时挂上 Product 实体） */
  product?: MaterialProduct;
  /** 挂车 */
  cart?: boolean;
  created_by?: string;
  workspace_id?: string;
}

// ── 视频资产（字段对齐 mixcut RenderOutput/RenderJob） ─────────────────────────
export type MaterialVideoStatus = "ready" | "rendering" | "queued" | "failed";
export type MaterialVideoKind = "baseline" | "variant";

export interface VariantConfig {
  character: string;
  scene: string;
  weather: string;
  lighting: string;
  role_relation: string;
  voice: string;
}

export interface VideoMetrics {
  plays: string;
  likes: string;
  ctr_pct: number;
  gmv: string;
  completion_pct: number;
  comments: number;
}

export interface MaterialVideo {
  id: string;
  /** 关联脚本（≈ RenderJob 之于模板） */
  script_id: string;
  /** 关联商品（复用 RenderJob.product_id 语义） */
  product_id?: string;
  kind: MaterialVideoKind;
  name: string;
  status: MaterialVideoStatus;
  /** 派生来源（≈ RenderJob.forked_from_job_id / RenderOutput 血缘） */
  parent_video_id?: string | null;
  duration_sec: number;
  aspect_ratio: string;
  variant_config: VariantConfig;
  metrics: VideoMetrics | null;
  cover_color: string;
  created_at: string;
  generated_at: string | null;
  render_cost_sec: number | null;
  model: string;
  /** 渲染中任务（status=rendering）才有 */
  progress_pct?: number;
  eta_sec?: number;
  stage?: string;
  /** 标记由后台异步任务合成的渲染中卡 */
  isAsyncTask?: boolean;
  /** 真实视频大模型出片地址（status=ready 时非空）；mock 模式为空（用渐变封面占位）。 */
  video_url?: string | null;
  thumbnail_url?: string | null;
  /** status=failed 时的失败原因（后端透传，前端直接展示）。 */
  error_message?: string | null;
  /** 视频大模型异步任务 id（排障用）。 */
  external_task_id?: string | null;
}

// 视频生成任务提交载荷（前端 → POST /api/material/videos/generate { items: [...] }）。
export interface VideoGenJobRequest {
  script_id: string;
  product_id?: string;
  name: string;
  kind: MaterialVideoKind;
  parent_video_id?: string | null;
  /** 提交给视频大模型的完整提示词（前端拼好；见 lib.buildVideoPrompt）。 */
  prompt: string;
  variant_config: VariantConfig;
  duration_sec: number;
  aspect_ratio: string;
}

// 渲染中后台任务（提交到后台后回库展示进度）。结构与 MaterialVideo 渲染态对齐。
export interface AsyncRenderTask {
  id: string;
  script_id: string;
  product_id?: string;
  parent_video_id?: string | null;
  kind: MaterialVideoKind;
  name: string;
  status: "pending" | "rendering";
  submitted_at: string;
  eta_sec: number;
  progress_pct: number;
  stage: string;
  variant_config: VariantConfig;
}

// ── 爆款雷达（原型独有） ──────────────────────────────────────────────────────
export interface ViralShot {
  t: string;
  label: string;
  text: string;
  tag: string;
}

export interface ViralHit {
  id: string;
  platform: PlatformId;
  plays: string;
  likes: string;
  author: string;
  title: string;
  cat: string;
  cat_color: string;
  duration: number;
  postedAt: string;
  hook: string;
  structure: ViralShot[];
  tags: string[];
  score: number;
  risk: number;
  reproduces: number;
}

// ── 变量轴（派生变体的可变维度，原型独有） ─────────────────────────────────────
export type VariantAxisKey =
  | "character"
  | "scene"
  | "weather"
  | "lighting"
  | "role_relation"
  | "voice";

export interface VariantAxisOption {
  id: string;
  label: string;
  sub?: string;
  tags?: string[];
}

export interface VariantAxis {
  label: string;
  /** 该轴的语义色 token（CSS var 名，creator 配色） */
  toneVar: string;
  options: VariantAxisOption[];
}

// 变量替换（派生变体：AI 把脚本里的实体抽成 {变量}） ──────────────────────────
export interface ScriptVariable {
  id: string;
  name: string;
  /** 语义色 token（CSS var 名） */
  toneVar: string;
  appearances: { shot: number; phrase: string }[];
  values: string[];
  suggestions: string[];
}

export interface VariantSample {
  idx: number;
  _label: string;
  subs: Record<string, string>;
  blocks: (ScriptBlock & { originalText?: string })[];
}

// ── 视频结构化配置（5 组 18 字段，原型独有） ───────────────────────────────────
export interface VideoConfigFieldDef {
  label: string;
  options: string[];
  default: string;
}

export interface VideoConfigGroupDef {
  label: string;
  /** lucide 图标名（在 UI 常量里映射成组件） */
  icon: string;
  toneVar: string;
  fields: Record<string, VideoConfigFieldDef>;
}

// ── 智能体训练 ────────────────────────────────────────────────────────────────
export type BannedTier = "hard" | "medical" | "soft";
export interface BannedWord {
  word: string;
  tier: BannedTier;
  count: number;
}

export interface PlatformRule {
  name: string;
  /** lucide 图标名 */
  icon: string;
  /** 平台品牌色（hex，原样保留作 chip 点缀） */
  color: string;
  duration_sweet: string;
  hook_window: number;
  topics: string[];
  notes: string;
}

// ── 效果回流表格行 ────────────────────────────────────────────────────────────
export interface LoopRow {
  id: string;
  title: string;
  plat: PlatformId;
  plays: string;
  ctr: number;
  gmv: string;
  diff: number;
  status: string;
  /** 语义色 token（CSS var 名） */
  toneVar: string;
}

// ── 起稿中心起稿载荷 ──────────────────────────────────────────────────────────
export interface ApplyDraftPayload {
  asset: ScriptAsset | null;
  blocks: ScriptBlock[];
}
