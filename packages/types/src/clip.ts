/** 数字分身口播成片域。注意：与 clip-studio.ts 的 MCN 真人切片台不是同一领域。 */
export type ClipSegmentRole = "avatar" | "broll" | "tail";
export type ClipProjectStatus = "draft" | "generating" | "done" | "failed";
export type ClipRenderStatus = "queued" | "generating" | "assembling" | "succeeded" | "failed" | "cancelled";
export type ClipPublishPlatform = "douyin" | "kuaishou" | "xiaohongshu" | "shipinhao";

export interface ClipSegment {
  no: number;
  text: string;
  role: ClipSegmentRole;
  hint?: string | null;
  durationSec?: number;
  actualDurationSec?: number;
  assetId?: string | null;
  assetLabel?: string | null;
  brollSource?: "user" | "preset" | null;
  replaceable?: boolean;
}

export interface ClipShot {
  id: string;
  startNo: number;
  endNo: number;
  role: ClipSegmentRole;
  assetId?: string | null;
  assetLabel?: string | null;
  brollSource?: "user" | "preset" | null;
  hint?: string | null;
}

export interface ClipScriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at?: string;
  applied?: boolean;
}

export interface ClipSubtitleStyle {
  /** 成片右上角“AI 生成”可见水印；缺省与 false 均表示关闭。 */
  aiWatermark?: boolean;
  [key: string]: unknown;
}

/**
 * 成片封面：一张 720x1280 的图，拼在成片最前面当第一帧。
 * 抖音等平台发布后拿第一帧做缩略图，所以它有设计感；时长仅 1~2 帧，不占播放内容。
 * 可选步骤 —— enabled 非 true 或四个文本槽位全空，成片就不加封面。
 */
export interface ClipCoverConfig {
  enabled?: boolean;
  /** 版式模板 id；未知值回落主模板 cover_shiti。 */
  templateId?: string;
  /** 顶部书法大字关键词，2 字。 */
  keyword?: string;
  /** 白底黑字账号名标签，如 "@可乐米乐麻麻讲Ai"。 */
  handle?: string;
  /** 居中两行标语，白色粗体 + 黑描边。 */
  sloganLines?: string[];
  /** 落款金句，金色渐变粗体，比标语更大。 */
  signature?: string;
  /** 自传底图素材 id；留空则从成片抽一帧。 */
  backgroundAssetId?: string | null;
  /** 底图取自哪一句（segment.no）；0 表示交给服务端挑形象出镜段。 */
  backgroundSourceNo?: number;
  [key: string]: unknown;
}

export interface ClipTemplate {
  id: string;
  name: string;
  industry: string;
  themeKey: string;
  description: string;
  status: "draft" | "published";
  ownerScope: "official" | "user";
  scriptSkeleton: { segments: ClipSegment[]; variables: Array<{ key: string; label: string; placeholder?: string; required?: boolean }> };
  timeline: Record<string, unknown>;
  tailClips: Array<Record<string, unknown>>;
  brollPool: string[];
  previewCoverUrl?: string | null;
  previewVideoUrl?: string | null;
  ratio: "9:16";
  estDurationSec: number;
  avatarSecHint: number;
  creditHint?: number | null;
  segmentCount: number;
  tailLabel?: string | null;
  tailDurationSec: number;
  tailAssetId?: string | null;
  tailPreviewUrl?: string | null;
  tailVideoUrl?: string | null;
}

export interface ClipProject {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  status: ClipProjectStatus;
  variables: Record<string, string>;
  segments: ClipSegment[];
  shots: ClipShot[];
  scriptChat: ClipScriptMessage[];
  avatarId?: string | null;
  voiceId?: string | null;
  bgmAssetId?: string | null;
  subtitleStyle?: ClipSubtitleStyle | null;
  cover?: ClipCoverConfig | null;
  durationSec: number;
  avatarSeconds: number;
  segmentCount: number;
  progress: number;
  step: number;
  updatedAt: string;
}

export interface ClipEstimate {
  items: Array<{ key: string; label: string; credits: number; freeText?: string }>;
  total: number;
  summary: { totalSec: number; avatarSec: number; tailSec: number; avatarCount: number; brollCount: number; tailCount: number; chars: number };
}

export interface ClipRenderRequest { clientRequestId: string; externalCreditsHeld: number }
export interface ClipRenderResult { jobId: string; projectId: string; status: ClipRenderStatus; mock: boolean }
export interface ClipJob {
  id: string; projectId: string; status: ClipRenderStatus; stage: string; progress: number;
  workId?: string | null; errorMessage?: string | null; mock: boolean; updatedAt: string;
}

/** 素材库存储占用。预置素材由平台提供，不计入用户配额。 */
export interface ClipAssetStorage { usedBytes: number; limitBytes: number; count: number }

export interface ClipAsset {
  id: string; label: string; tag?: string | null; kind: "video" | "image" | "bgm";
  durationSec: number; bytes: number; usedCount: number; preset: boolean;
  /**
   * 像素宽高。**可选且可空**：历史素材与 ffprobe 读不出的素材不会下发这两个字段。
   * 消费方必须把"缺字段"渲染成未知（整块不显示），不得回退成 0 —— 0×0 是错误信息，不是空态。
   */
  width?: number | null; height?: number | null;
  previewUrl?: string | null; contentUrl?: string | null; createdAt: string;
}

export interface ClipWork {
  id: string; projectId: string; title: string; status: "generating" | "done" | "published";
  durationSec: number; avatarSec: number; credits: number; videoUrl?: string | null; thumbnailUrl?: string | null;
  createdAt: string;
  generatedAt?: string | null;
  publishStats: Array<{ platform: string; text: string }>;
  aiWatermark: boolean;
}
export interface ClipWorkDeleteResult { ok: boolean; cancelledJobIds: string[] }

export interface ClipAvatarView {
  id: string;
  name: string;
  imageStatus: "none" | "training" | "ready" | "failed";
  voiceStatus: "none" | "training" | "ready" | "failed";
  voiceSource?: "video" | "dedicated" | null;
  imagePreviewUrl?: string | null;
  imageTrainedText?: string | null; voiceTrainedText?: string | null;
  imageProgress: number; voiceProgress: number;
  imageMessage?: string | null; voiceMessage?: string | null;
  engine?: string | null; presetAvailable: boolean;
  linkedVoiceId?: string | null;
  linkedVoiceName?: string | null;
}

export interface ClipVoiceView {
  id: string;
  name: string;
  status: "none" | "training" | "ready" | "failed";
  source?: "video" | "dedicated" | null;
  trainedText?: string | null;
  progress: number;
}

export type ClipCloneKind = "avatar" | "voice" | "avatarImage";
export interface ClipCloneUploadTicket {
  uploadId: string;
  uploadUrl?: string | null;
  formData: Record<string, string>;
  expiresAt?: string | null;
  status: "issued" | "uploaded" | "processing" | "accepted" | "failed";
  reused?: boolean;
}
export interface ClipCloneUploadStatus {
  uploadId: string;
  clientRequestId: string;
  kind: ClipCloneKind;
  status: "issued" | "uploaded" | "processing" | "accepted" | "failed";
  avatarId?: string | null;
  voiceId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** 仅供可信 BFF 做上传后机审；最终用户端响应必须剥离。 */
  reviewUrl?: string | null;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export interface ClipCaptureRule {
  kind: "consent" | "avatar" | "voice" | "avatarImage";
  vendorMinDurationSec: number;
  vendorMaxDurationSec: number;
  minDurationSec: number;
  recommendedMinDurationSec: number;
  recommendedMaxDurationSec: number;
  maxDurationSec: number;
  vendorMaxBytes: number;
  maxBytes: number;
  vendorFormats: string[];
  formats: string[];
  codec?: string | null;
  minShortSidePx?: number | null;
  maxLongSidePx?: number | null;
  sampleRateHz?: number | null;
  channels?: number | null;
  guidance: string[];
}
export interface ClipCaptureRequirements {
  /** 石榴 authId 是可选校验项；当前直传创建链路不要求另录授权视频。 */
  authorizationVideoRequired: boolean;
  consentText: string;
  agreementTitle: string;
  officialDocsLastReviewed: string;
  officialDocs: string[];
  consent: ClipCaptureRule;
  avatar: ClipCaptureRule;
  voice: ClipCaptureRule;
  /** 图片训练数字人。时长类字段全为 0——静态图没有时长概念，端上据此不展示秒数。 */
  image: ClipCaptureRule;
  pollIntervalMs: number;
}
export interface ClipConsentResult { id: string; status: "submitted" | "verified" | "rejected"; accepted: boolean; verified: boolean; verificationUrl?: string | null }
export interface ClipAuditEntry { id: string; createdAt: string; createdText?: string; scope?: string; action?: string; status: string }
