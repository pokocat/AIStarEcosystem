// ─────────────────────────────────────────────────────────────────────────────
// ai-avatar.ts — AiAvatar 形象资产管理中心 类型契约（唯一事实源）。
// 后端 com.aistareco.aep.aiavatar.dto.* 必须按本文件 camelCase 字段对齐。
// 枚举出 wire 全小写（与后端 @JsonValue 一致）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 枚举 ──────────────────────────────────────────────────────────────────────

/** 创建模式：真人授权复刻 / 纯 AI 原创。 */
export type AiAvatarCreationMode = "real_clone" | "ai_original";

/** 8 态资产状态机（严格按任务书 §3）。 */
export type AiAvatarStatus =
  | "draft"             // 草稿新建
  | "sampling"          // 打样中
  | "draft_iterating"   // 草稿迭代中
  | "refining"          // 精调中
  | "pending_finalize"  // 待定稿
  | "finalized_2d"      // 已定稿(2D)
  | "deriving"          // 衍生生成中
  | "archived";         // 正式归档

/** AI 能力（与后端 AiAvatarCapability.wire() 一致）。 */
export type AiAvatarCapability =
  | "faceClone"   // 真人复刻打样（InstantID）
  | "txt2img"     // AI 原创打样（SDXL/FLUX）
  | "img2img"     // 草稿指令调整（InstructPix2Pix）
  | "faceWarp"    // 几何微调（MediaPipe+液化，真实算法）
  | "inpaint"     // 局部重绘（SD inpaint）
  | "makeup"      // 妆容迁移
  | "hair"        // 发型变换
  | "restore"     // 美颜/质感（GFPGAN）
  | "img23d"      // 2D→3D（TripoSR）
  | "img2video"   // 图生视频（SVD）
  | "faceDetect"  // 人脸合规检测（InsightFace）
  | "nlu"         // 人设文案解析（LLM）
  | "segment";    // 局部分割（SAM）

/** 异步任务状态。 */
export type AiAvatarJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

/** Provider 实现来源。 */
export type AiAvatarProviderMode = "mock" | "backend" | "selfhost";

/** 资产文件类别。 */
export type AiAvatarAssetKind =
  | "image_2d"
  | "expression_image"
  | "model_3d"
  | "video"
  | "source_photo"
  | "reference_image"
  | "mask"
  | "draft_image";

/** 标准构图（2D 标准图集固定 4 张 + 表情图）。 */
export type AiAvatarStandardShot =
  | "front_bust"     // 正面半身
  | "front_full"     // 正面全身
  | "left_profile"   // 左侧脸
  | "right_profile"  // 右侧脸
  | "expression";    // 表情图

/** AI 模板分类。 */
export type AiAvatarTemplateCategory = "beauty" | "style" | "retouch" | "composition";

/** 真人肖像授权状态。 */
export type AiAvatarLicenseStatus = "active" | "expired" | "revoked";

/** 精调操作类别。 */
export type AiAvatarRefineKind = "geometry" | "appearance" | "nl_global" | "region";

// ── 实体 ──────────────────────────────────────────────────────────────────────

export interface AiAvatar {
  id: ID;
  ownerUserId: ID;
  studioId?: ID | null;
  name: string;
  mode: AiAvatarCreationMode;
  status: AiAvatarStatus;
  statusLabel?: string;
  persona?: string | null;
  personaStructured?: Record<string, unknown> | null;
  styleCategory?: string | null;
  coverAssetId?: ID | null;
  coverUrl?: string | null;
  currentVersionId?: ID | null;
  finalizedVersionId?: ID | null;
  has3d: boolean;
  hasVideo: boolean;
  tags: string[];
  forkedFromAvatarId?: ID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime | null;
}

export interface AiAvatarAsset {
  id: ID;
  avatarId?: ID | null;
  versionId?: ID | null;
  kind: AiAvatarAssetKind;
  standardShot?: AiAvatarStandardShot | null;
  fileUrl: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  width: number;
  height: number;
  fileSize: number;
  durationSec: number;
  format3d?: string | null;
  /** 实现来源（InstantID / SDXL / TripoSR / SVD / MOCK …）— 前端「来源角标」。 */
  engine?: string | null;
  providerMode?: AiAvatarProviderMode | null;
  watermarkToken?: string | null;
  encrypted: boolean;
  meta?: Record<string, unknown> | null;
  createdAt: ISODateTime;
}

export interface AiAvatarVersion {
  id: ID;
  avatarId: ID;
  versionNo: number;
  label?: string | null;
  note?: string | null;
  author?: string | null;
  sourceStatus?: AiAvatarStatus | null;
  params?: Record<string, unknown> | null;
  previewAssetId?: ID | null;
  previewUrl?: string | null;
  assetIds: ID[];
  jobId?: ID | null;
  preferred: boolean;
  discarded: boolean;
  createdAt: ISODateTime;
}

export interface AiAvatarSourceMaterial {
  id: ID;
  avatarId: ID;
  kind: string;               // "photo" | "text" | "reference"
  assetId?: ID | null;
  assetUrl?: string | null;
  text?: string | null;
  faceCheck?: AiAvatarFaceCheck | null;
  faceCheckPassed?: boolean | null;
  createdAt: ISODateTime;
}

export interface AiAvatarFaceCheck {
  faces?: number;
  occlusion?: boolean;
  blur?: boolean;
  multiFace?: boolean;
  brightness?: string;
  passed?: boolean;
  reason?: string;
  engine?: string;
}

export interface AiAvatarLicenseGrant {
  id: ID;
  avatarId: ID;
  subjectName?: string | null;
  scope?: string | null;
  platforms: string[];
  validFrom?: ISODateTime | null;
  validTo?: ISODateTime | null;
  status: AiAvatarLicenseStatus;
  statusLabel?: string;
  hasAgreement: boolean;
  signatureName?: string | null;
  signedAt?: ISODateTime | null;
  boundAssetIds: ID[];
  credentialUrl?: string | null;
  createdAt: ISODateTime;
}

export interface AiAvatarTemplate {
  id: ID;
  name: string;
  category: AiAvatarTemplateCategory;
  categoryLabel?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  params?: Record<string, unknown> | null;
  capability?: AiAvatarCapability | null;
  official: boolean;
  ownerUserId?: ID | null;
  enabled: boolean;
  usageCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AiAvatarJob {
  id: ID;
  ownerUserId: ID;
  avatarId?: ID | null;
  versionId?: ID | null;
  capability: AiAvatarCapability;
  capabilityLabel?: string;
  status: AiAvatarJobStatus;
  progress: number;
  providerMode?: AiAvatarProviderMode | null;
  engine?: string | null;
  title?: string | null;
  input?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  attempts: number;
  maxAttempts: number;
  creditsHeld: number;
  batchId?: ID | null;
  createdAt: ISODateTime;
  startedAt?: ISODateTime | null;
  completedAt?: ISODateTime | null;
}

export interface AiAvatarRefineEdit {
  id: ID;
  avatarId: ID;
  versionId?: ID | null;
  kind: AiAvatarRefineKind;
  kindLabel?: string;
  params?: Record<string, unknown> | null;
  beforeAssetId?: ID | null;
  afterAssetId?: ID | null;
  jobId?: ID | null;
  note?: string | null;
  createdAt: ISODateTime;
}

/** 资产详情聚合（图集/3D/视频/版本时间线/授权 Tab）。 */
export interface AiAvatarDetail {
  avatar: AiAvatar;
  versions: AiAvatarVersion[];
  assets: AiAvatarAsset[];
  sourceMaterials: AiAvatarSourceMaterial[];
  licenses: AiAvatarLicenseGrant[];
  refineEdits: AiAvatarRefineEdit[];
  recentJobs: AiAvatarJob[];
  allowedNextStatus: AiAvatarStatus[];
}

/** Provider 健康（GET /api/aiavatar/health/providers）。 */
export interface AiAvatarProviderHealth {
  capability: AiAvatarCapability;
  capabilityLabel: string;
  mode: AiAvatarProviderMode | null;
  healthy: boolean;
  engine?: string | null;
  approach?: string | null;
  message?: string | null;
}

// ── 请求体 ────────────────────────────────────────────────────────────────────

export interface AiAvatarCreateInput {
  mode: AiAvatarCreationMode;
  name: string;
  persona?: string;
  styleCategory?: string;
  tags?: string[];
}

export interface AiAvatarUpdateInput {
  name?: string;
  persona?: string;
  styleCategory?: string;
  tags?: string[];
}

/** 几何微调滑块（相对中性值，约 -100..100）。 */
export interface AiAvatarGeometrySliders {
  slimFace?: number;
  eyeSize?: number;
  noseBridge?: number;
  faceShape?: number;
  mouthShape?: number;
  /** 形变锚点来源（审计）："mediapipe-facemesh-478" = 真实关键点；"heuristic-center" = 居中估计回退。 */
  landmarkEngine?: string;
  /** 检测到的关键点数（478 / 0）。 */
  landmarkCount?: number;
}

export interface AiAvatarSubmitJobInput {
  prompt?: string;
  baseAssetId?: string;
  referenceAssetId?: string;
  maskAssetId?: string;
  templateId?: string;
  variants?: number;
  params?: Record<string, unknown>;
  note?: string;
}

export interface AiAvatarGeometryRefineInput {
  afterAssetId: string;
  beforeAssetId?: string;
  params?: AiAvatarGeometrySliders;
  note?: string;
}

export interface AiAvatarSignLicenseInput {
  subjectName?: string;
  scope?: string;
  platforms?: string[];
  validFrom?: string;
  validTo?: string;
  signatureName: string;
  boundAssetIds?: string[];
  agreementText?: string;
}

export interface AiAvatarFinalizeInput {
  versionId?: string;
  confirmedAssetIds?: string[];
  note?: string;
}

export interface AiAvatarDeriveInput {
  capabilities: AiAvatarCapability[];
  baseAssetId?: string;
  videoDurationSec?: number;
  params?: Record<string, unknown>;
}

export interface AiAvatarTemplateUpsertInput {
  name: string;
  category: AiAvatarTemplateCategory;
  description?: string;
  thumbnailUrl?: string;
  params?: Record<string, unknown>;
  capability?: AiAvatarCapability;
  official?: boolean;
  enabled?: boolean;
}
