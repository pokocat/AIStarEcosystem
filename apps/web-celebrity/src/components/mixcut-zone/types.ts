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

export interface Template {
  template_id: string;
  name: string;
  version: string;
  canvas: TemplateCanvas;
  slots: TemplateSlot[];
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

export type SlotBinding =
  | { source: "library"; asset_id: string }
  | { source: "upload"; file_url: string; preview_url?: string }
  | { source: "input"; text: string }
  | { source: "fixed" };

export type JobStatus = "pending" | "queued" | "running" | "success" | "failed" | "partial";

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
