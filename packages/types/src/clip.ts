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

export interface ClipAsset {
  id: string; label: string; tag?: string | null; kind: "video" | "image" | "bgm";
  durationSec: number; usedCount: number; preset: boolean;
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

export interface ClipCaptureRule {
  kind: "consent" | "avatar" | "voice";
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
  consentText: string;
  agreementTitle: string;
  officialDocsLastReviewed: string;
  officialDocs: string[];
  consent: ClipCaptureRule;
  avatar: ClipCaptureRule;
  voice: ClipCaptureRule;
  pollIntervalMs: number;
}
export interface ClipConsentResult { id: string; status: "submitted" | "verified" | "rejected"; accepted: boolean; verified: boolean; verificationUrl?: string | null }
export interface ClipAuditEntry { id: string; createdAt: string; createdText?: string; scope?: string; action?: string; status: string }
