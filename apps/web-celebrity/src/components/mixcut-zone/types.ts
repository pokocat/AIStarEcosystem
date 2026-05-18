// 混剪专区类型定义 —— 从 mixcut/frontend/lib/types.ts 迁入。
// 4 个 UI 常量（TIER_LABELS / TIER_COLORS / PROFILE_LABELS / PROFILE_DESCRIPTIONS）已剥离到 @/constants/mixcut-ui.ts。

export type Tier = "trial" | "basic" | "standard" | "professional" | "annual_pro" | "city_agent";

export type PerturbationProfile = "light" | "moderate" | "aggressive";

export type LayerType = "video" | "image" | "sticker" | "text" | "audio" | "digital_human";

export type FillStrategy =
  | "fixed"
  | "library_select"
  | "user_upload"
  | "user_input"
  | "api_generated"
  | "variable_binding";

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
  user_id: string;
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
}

export type SlotBinding =
  | { source: "library"; asset_id: string; preview_url?: string }
  | { source: "upload"; file_url: string; preview_url?: string }
  | { source: "input"; text: string }
  | { source: "fixed" };

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
  /** v0.10: 任务级扰动总开关。 */
  perturbation_overrides?: PerturbationOverrides;
  /** v0.x: 原片视觉指纹（aHash 64bit hex,16 字符）。用于和每条变体的 phash_signature 做汉明距离对比。 */
  source_phash?: string;
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
