// 混剪专区类型定义 —— 从 mixcut/frontend/lib/types.ts 迁入。
// 4 个 UI 常量（TIER_LABELS / TIER_COLORS / PROFILE_LABELS / PROFILE_DESCRIPTIONS）已剥离到 @/constants/mixcut-ui.ts。

export type Tier = "trial" | "basic" | "standard" | "professional" | "annual_pro" | "city_agent";

export type PerturbationProfile = "light" | "moderate" | "aggressive";

export type LayerType = "video" | "image" | "text" | "audio";

export type FillStrategy =
  | "fixed"
  | "library_select"
  | "user_upload"
  | "user_input"
  | "api_generated"
  | "variable_binding"
  | "picgen_text";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotPerturbation {
  position_jitter?: number;
  scale_jitter?: number;
  opacity_jitter?: number;
  speed_range?: [number, number];
  color_jitter?: { brightness?: [number, number]; saturation?: [number, number] };
  mirror_probability?: number;
  rotation_jitter_deg?: number;
  fade_in_duration?: [number, number];
  font_size_jitter?: number;
  volume_jitter?: number;
  pitch_range?: [number, number];
}

/**
 * 每个 slot 的扰动准入 —— 只覆盖"逐素材抖动"算子（位置 / 缩放）。
 * 整段画面级算子（镜像 / 速度 / 亮度 / 饱和度）只在任务级 PerturbationOverrides 上开关,
 * slot 上没有意义。
 */
export interface SlotPerturbationPolicy {
  allow_position_jitter?: boolean;
  allow_scale_jitter?: boolean;
}

export interface TemplateSlot {
  slot_id: string;
  layer_type: LayerType;
  z_index: number;
  rect?: Rect;
  time_range: [number, number];
  fit?: "cover" | "contain";
  fill_strategy: FillStrategy;
  library_filter?: Record<string, any>;
  default_asset_id?: string;
  default_value?: string;
  asset_id?: string;
  accepts_mime?: string[];
  style_preset?: string;
  selection_strategy?: string;
  volume?: number;
  user_editable: boolean;
  required: boolean;
  perturbation?: SlotPerturbation;
  /** 槽位级扰动准入。省略时按 layer_type 默认。 */
  perturbation_policy?: SlotPerturbationPolicy;
  /** v0.13+: 扰动贴图池绑定（slot 级；可选）。从平台预置 GIF 池随机抽样叠加 overlay。 */
  perturbation_sticker_pool?: StickerPoolBinding;
  label?: string;
}

export interface TemplateCanvas {
  width: number;
  height: number;
  duration: number;
  fps: number;
  background_color: string;
}

export interface TemplateMetadata {
  category: string;
  tags: string[];
  thumbnail_url?: string;
  required_tier: Tier;
  cover_video_url?: string;
  daily_creation_count?: number;
  hit_rate?: number;
}

/**
 * v0.11: 流程模板 —— 每个 TemplateScene 是一段连续画面,串行拼接成最终视频。
 * 场景内的 slot.time_range 是相对本场景的 0..scene.duration。
 * 总片长 canvas.duration 必须 = sum(scenes[].duration)。
 */
export interface TemplateScene {
  id: string;
  label: string;
  duration: number;
  slots: TemplateSlot[];
}

export interface Template {
  template_id: string;
  name: string;
  version: string;
  canvas: TemplateCanvas;
  /** 场景串行,每个场景独立组合。一定至少 1 个场景。 */
  scenes: TemplateScene[];
  perturbation_profile: PerturbationProfile;
  output_variants_default: number;
  quality_gate: { min_phash_distance: number; max_retries: number };
  metadata: TemplateMetadata;
  /** v0.12+: server 模板行归属。factory 不可删；user copy 可删。 */
  is_factory?: boolean;
  owner_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StarClip {
  id: string;
  star_id: string;
  star_name: string;
  thumbnail_url: string;
  file_url: string;
  duration: number;
  resolution: string;
  script_category: string;
  script_text: string;
  tags: string[];
  authorization_status: "authorized" | "pending" | "rejected";
}

export interface ProductClip {
  id: string;
  user_id: string;
  thumbnail_url: string;
  file_url: string;
  duration: number;
  media_type: "video" | "image";
  resolution: string;
  product_name: string;
  selling_points: string[];
  category: string;
  uploaded_at: string;
}

export interface Asset {
  id: string;
  asset_type: "sticker" | "bgm" | "title" | "promo_label" | "brand_bar";
  file_url: string;
  thumbnail_url?: string;
  name: string;
  category: string;
}

/**
 * 用户上传的混剪素材（v0.9 真后端）。
 * 与前端 mock 的 `Asset` 不同：MixcutAsset 是用户实际上传到 server 的资源，
 * file_url 指向 /static/mixcut-assets/<userId>/<id>.<ext>，可直接 `<video src>` / `<img src>` 引用。
 */
export type MixcutAssetKind = "video" | "image" | "sticker" | "bgm";

export interface MixcutAsset {
  id: string;
  user_id?: string;          // 预置素材为 undefined / null
  kind: MixcutAssetKind;
  name: string;
  original_name?: string;
  file_url: string;
  thumbnail_url?: string;
  mime_type?: string;
  file_size: number;
  duration: number;
  tags?: string;
  uploaded_at: string;
  /** v0.13+: 是否为平台预置素材（全用户可见，不可删除）。 */
  is_preset?: boolean;
  /** v0.13+: 预置分组（sparkle / ribbon / emoji_burst 等），仅预置素材有值。 */
  preset_group?: string;
  /** v0.13+: 缩略图 URL（GIF 抽第一帧），优先于 thumbnail_url。 */
  preview_url?: string;
  /** v0.21+: 官方明星片段标记（运营后台上传，用户只读消费）。 */
  is_official?: boolean;
  /** v0.21+: 官方片段分类（直播切片 / 综艺 / 访谈等）。 */
  official_category?: string;
  /** v0.21+: 关联明星 id（CelebrityStar.id），可空。 */
  related_star_id?: string;
  /**
   * v0.26+: 关联商品 id（Product.id），可空。
   * 商品链接解析时落的图片素材（subkind=product-photo）会带此字段；
   * 未来 AI 生成的带货视频（subkind=ai-marketing-video）也会带此字段。
   */
  related_product_id?: string;
  /**
   * v0.26+: 素材子类。
   *   "user-upload"            — 用户手动上传（默认）
   *   "product-photo"          — 从商品链接解析落的图片（外网 CDN URL 直接登记）
   *   "product-video"          — 商品相关视频（用户上传或解析视频帧）
   *   "ai-marketing-video"     — AI 生成的带货视频（future scope，结构预留）
   */
  subkind?: string;
}

/**
 * v0.13+ 扰动贴图池绑定。挂在 TemplateSlot 上（slot 级），渲染器为每变体从 pool_ids 随机抽 pick_count 张 GIF。
 * pool_ids 中存的是 MixcutAsset.id（is_preset=true 的）。
 */
export interface StickerPoolBinding {
  pool_ids: string[];
  /** 时间覆盖：intro=前 3s / outro=后 3s / loop=全片 / random_3s=随机 3s 窗口 */
  coverage: "intro" | "outro" | "loop" | "random_3s";
  /** 整体不透明度 0..1（GIF binary alpha 上仅"降不透明像素"，等于贴图整体变薄） */
  opacity: number;
  /** 相对画布宽度的目标尺寸百分比 (5..50) */
  scale_pct: number;
  /** 每变体抽样数量 1..2，默认 1 */
  pick_count?: number;
}

export type SlotBinding =
  | { source: "library"; asset_id: string; preview_url?: string }
  | { source: "upload"; file_url: string; preview_url?: string }
  | { source: "input"; text: string }
  | { source: "fixed" }
  | { source: "picgen"; title: string; subtitle?: string; tag?: string; preview_url?: string };

export type JobStatus = "pending" | "queued" | "running" | "success" | "failed" | "partial";

/**
 * 任务级扰动总开关 —— 分两类：
 *  · 整段画面（对全片生效）: allow_mirror / allow_speed / allow_brightness / allow_saturation
 *  · 逐素材抖动（与 slot 级 SlotPerturbationPolicy 双层 AND）: allow_position_jitter / allow_scale_jitter
 * 任一项任务级 false → 对应算子直接短路；true → 再按 slot policy 决定单个 slot 是否参与。
 */
export interface PerturbationOverrides {
  allow_mirror?: boolean;
  allow_speed?: boolean;
  allow_brightness?: boolean;
  allow_saturation?: boolean;
  allow_position_jitter?: boolean;
  allow_scale_jitter?: boolean;
}

/** 任务提交时随 binding 一并下发的模板快照，避免后端依赖模板表。 */
export interface CanvasSnapshot {
  width: number;
  height: number;
  fps?: number;
}

export interface SlotSnapshot {
  slot_id: string;
  layer_type: LayerType;
  rect?: Rect;
  z_index: number;
  perturbation_policy?: SlotPerturbationPolicy;
  /**
   * 填充方式（v0.13+）：cover = 填满裁切，contain = 完整居中（背景用原图高斯模糊）。
   * 缺省退回 "cover"。
   */
  fit?: "cover" | "contain";
  /**
   * v0.25+: 该 slot 绝对时间窗（秒，相对整片 0），由 flatSlotsAbsolute 计算。
   * 渲染器据此把 overlay 限制在所属场景时段内显示（enable=between(t,start,end)）。
   * 缺省（旧任务）→ overlay 整片可见，与 v0.24 及之前行为一致。
   */
  time_range?: [number, number];
}

/**
 * v0.25+: 场景快照。RenderJob.scenes_snapshot 携带，让渲染器按场景串行拼接：
 *   - segCount = scenes.length（不再硬编 2 段）
 *   - 每段长度 = scene.duration_sec
 *   - overlay 按 slot_ids 归属到对应场景的时段
 * scenes_snapshot 缺省 → 退回 v0.24 行为（最多 2 段，segDuration = maxOutputDurationSec/segCount）。
 */
export interface SceneSnapshot {
  id: string;
  label?: string;
  duration_sec: number;
  slot_ids: string[];
}

export interface RenderOutput {
  id: string;
  job_id: string;
  variant_index: number;
  file_url: string;
  thumbnail_url: string;
  file_size: number;
  duration: number;
  phash_signature: string;
  phash_distance_to_source: number;
  applied_transforms: {
    crop?: string;
    mirror?: boolean;
    speed?: number;
    brightness?: number;
    saturation?: number;
    slot_jitter?: Record<string, any>;
    [k: string]: any;
  };
  watermark_token: string;
  created_at: string;
  /** v0.14+: CDN 公开 URL（发布链路真值源；缺失时回落 file_url）。 */
  cdn_url?: string;
  cdn_key?: string;
  cdn_thumbnail_url?: string;
  cdn_uploaded_at?: string;
  /**
   * v0.19+: 累计派发次数；每条 (output × target) 派单成功 +1。
   * 视频库不再隐藏已发布变体，用此字段渲染「已发 ×N」徽标。
   * server 缺省 0；mock 数据可省略。
   */
  publish_count?: number;
  /** v0.19+: 最近一次派发时间（ISO 8601）；从未派发为 undefined。 */
  last_published_at?: string;
}

export interface RenderJob {
  id: string;
  user_id: string;
  template_id: string;
  template_name?: string;
  template_thumbnail?: string;
  slot_bindings: Record<string, SlotBinding>;
  perturbation_profile: PerturbationProfile;
  output_variants: number;
  status: JobStatus;
  progress: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  outputs?: RenderOutput[];
  /** v0.10: 模板快照,服务端按此严格定位。缺省时退回旧逻辑（720×1280 + 序号位置）。 */
  canvas_snapshot?: CanvasSnapshot;
  slots_snapshot?: SlotSnapshot[];
  /**
   * v0.25+: 场景快照（按场景顺序排列）。让渲染器按场景串行拼接而不是硬编 2 段。
   * 缺省（旧任务 / 单场景模板）→ 渲染器回退到旧行为。
   */
  scenes_snapshot?: SceneSnapshot[];
  /** v0.10: 任务级扰动总开关。 */
  perturbation_overrides?: PerturbationOverrides;
  /** v0.x: 原片视觉指纹（aHash 64bit hex,16 字符）。用于和每条变体的 phash_signature 做汉明距离对比。 */
  source_phash?: string;
  /**
   * v0.13+: 任务级扰动贴图池配置。结构（slot 级 Map）：
   *   { "<slotId>": StickerPoolBinding, "_global": StickerPoolBinding }
   * 模板编辑时挂在 slot 上；create job 时整理成 Map 提交给后端。
   */
  sticker_pool?: Record<string, StickerPoolBinding>;
  /**
   * v0.30+: 任务血缘 —— 由「重跑」入口 fork 时填入原 jobId；直接创建的任务为 undefined。
   * 详情页头部展示「来自任务 #xxx」徽章。后端字段名 forked_from_job_id。
   */
  forked_from_job_id?: string;
  /**
   * v0.26+: 关联商品 id（Product.id）。
   * 当用户从商品库点「生成视频」进入 create 页（URL ?product_id=X）时，
   * 提交 RenderJob 时把这个 id 透传给 server，落到 MixcutRenderJob.productId 列。
   * 分发阶段 BatchPublishDrawer 用它反查 Product 并自动 prefill 抖音商品挂载字段。
   */
  product_id?: string;
  /**
   * v0.48+: 来源实例 id（MixcutDraft.id）。当任务由「实例 / 草稿」生成时填入，
   * 任务详情页据此显示「来自实例」徽章并深链回 create 页继续编辑该实例。
   * 直接走模板创建（无草稿）时为空。后端字段名 draft_id。
   */
  draft_id?: string;
}

/**
 * v0.48+: 混剪「实例 / 草稿」—— 模版与生成任务之间的中间层。
 *
 * 一个实例 = 「针对某模版配好的一份素材绑定 + 扰动设置」，可保存、可反复编辑、可多次生成。
 * 字段与 RenderJob 的快照部分对齐（本质是「还没提交渲染的任务配置」）。
 * 后续从实例生成的每个 RenderJob 都带 draft_id 指回，形成
 * 模版（Template） → 实例（MixcutDraft） → 生成任务（RenderJob）三层血缘。
 */
export interface MixcutDraft {
  id: string;
  user_id?: string;
  template_id: string;
  template_name?: string;
  template_thumbnail?: string;
  /** 实例名（用户可命名；默认「{模版名} · 草稿」）。 */
  name: string;
  /** 创建 / 上次保存时的模版 version，用于重开时 reconcile 提示「模版已更新」。 */
  template_version?: string;
  slot_bindings: Record<string, SlotBinding>;
  canvas_snapshot?: CanvasSnapshot;
  slots_snapshot?: SlotSnapshot[];
  scenes_snapshot?: SceneSnapshot[];
  perturbation_overrides?: PerturbationOverrides;
  sticker_pool?: Record<string, StickerPoolBinding>;
  perturbation_profile: PerturbationProfile;
  output_variants: number;
  product_id?: string;
  /** draft / archived（预留）。 */
  status: string;
  /** 从本实例生成过几次任务。 */
  generated_job_count: number;
  last_generated_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * v0.48+: 新建 / 更新实例的请求体（POST /mixcut/drafts | PUT /mixcut/drafts/{id}）。
 * id 可前端预生成；缺省由后端补齐。其余字段与 MixcutDraft 同名（快照子集）。
 */
export interface MixcutDraftUpsert {
  id?: string;
  template_id: string;
  template_name?: string;
  template_thumbnail?: string;
  name?: string;
  template_version?: string;
  slot_bindings: Record<string, SlotBinding>;
  canvas_snapshot?: CanvasSnapshot;
  slots_snapshot?: SlotSnapshot[];
  scenes_snapshot?: SceneSnapshot[];
  perturbation_overrides?: PerturbationOverrides;
  sticker_pool?: Record<string, StickerPoolBinding>;
  perturbation_profile?: PerturbationProfile;
  output_variants?: number;
  product_id?: string;
}

/**
 * v0.30+: 「重跑」入口的可覆盖参数。两字段均可空 —— 缺省沿用原 job 的对应值。
 * 其它快照（slot_bindings/canvas/slots/scenes/sticker_pool/perturbation_overrides/product_id）
 * 严格使用原 job 的版本，不允许从 dialog 覆盖。
 */
export interface MixcutRerunJobRequest {
  output_variants?: number;
  perturbation_profile?: PerturbationProfile;
}

/**
 * v0.30+: 重跑被阻挡时的缺失素材条目。来自 server 409 MISSING_ASSETS 的
 * error.details.missing_assets[]，用于前端列出"哪个槽位的哪个素材已删"。
 */
export interface MissingAssetItem {
  slot_id: string;
  asset_id: string;
  source: "upload" | "library" | string;
  kind?: string;
}

export interface ActivationCode {
  code: string;
  tier: Tier;
  monthly_quota: number;
  quota_used_this_period: number;
  period_resets_at: string;
  bound_device_fingerprint?: string;
  bound_at?: string;
  status: "unused" | "active" | "expired" | "banned";
  expires_at: string;
  features: string[];
}

export interface DeviceInfo {
  fingerprint: string;
  cpu_id: string;
  motherboard_id: string;
  os: string;
  last_heartbeat: string;
  last_ip: string;
  status: "active" | "offline";
}

export interface Course {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  price: number;
  is_bundled: boolean;
  required_tier?: Tier;
  total_minutes: number;
  lesson_count: number;
  instructor: string;
  enrolled?: boolean;
  progress_percent?: number;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  video_url: string;
  duration_seconds: number;
  order_index: number;
  watched?: boolean;
}
