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
}

export interface ClipProject {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  status: ClipProjectStatus;
  variables: Record<string, string>;
  segments: ClipSegment[];
  avatarId?: string | null;
  voiceId?: string | null;
  bgmAssetId?: string | null;
  subtitleStyle?: Record<string, unknown> | null;
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
  durationSec: number; usedCount: number; preset: boolean; previewUrl?: string | null; createdAt: string;
}

export interface ClipWork {
  id: string; projectId: string; title: string; status: "generating" | "done" | "published";
  durationSec: number; avatarSec: number; credits: number; videoUrl?: string | null; thumbnailUrl?: string | null;
  publishStats: Array<{ platform: string; text: string }>;
}

export interface ClipAvatarView {
  imageStatus: "none" | "training" | "ready" | "failed";
  voiceStatus: "none" | "training" | "ready" | "failed";
  imageTrainedText?: string | null; voiceTrainedText?: string | null;
  engine?: string | null; presetAvailable: boolean;
}

export interface ClipConsentResult { id: string; status: "pending" | "verified" | "rejected"; verified: boolean; verificationUrl?: string | null }
export interface ClipAuditEntry { id: string; createdAt: string; createdText?: string; scope?: string; action?: string; status: string }
