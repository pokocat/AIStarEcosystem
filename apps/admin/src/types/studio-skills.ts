// ─────────────────────────────────────────────────────────────────────────────
// Studio 技能（全能创作对话按它规划制作；用户侧只读 GET /v1/ip-studio/studio/skills）。
// 照 AGENTS.md §4.1 从 packages/types/src/ip-studio-workflow.ts 直接复制「技能」这一块
// （S3：技能表 + 不可变版本 + 后台编辑 / 试跑 + 意图路由 + 整理草稿），字段与服务端 DTO 1:1。
// 试跑返回的计划沿用对话里的 StudioPlan，这里只复制后台展示用到的字段。
// 设计真源：docs/ip-studio-conversational-video-recreation-plan.md「第三阶段 S3」。
// ─────────────────────────────────────────────────────────────────────────────

export type StudioPlanStage = "analysis" | "production";
export type StudioPlanOperation = "text" | "script" | "storyboard" | "image" | "video" | "recreation" | "check" | "assemble";

export interface StudioSkillLimits { maxSourceSec: number; maxSegments: number; maxSegmentSec: number | "model"; maxSteps: number; maxAutoFixPerSegment: number }

/** Routing hints in a skill's front matter. media = attachment/pinned node types that suggest this skill; default = fallback on ties / no hits. */
export interface StudioSkillTriggers { media?: ("video" | "image" | "audio" | "text")[]; keywords?: string[]; default?: boolean }

export interface StudioSkillSummary {
  key: string; name: string; version: number; status: "active" | "draft" | "withdrawn"; planning: "dynamic";
  summary: string; methodExamples: string[]; operations: Record<StudioPlanStage, StudioPlanOperation[]>;
  limits: StudioSkillLimits; checks: string[]; autoFixChecks: string[]; requiredCapabilities: string[];
  /** Optional routing hints from the front matter (absent = no triggers). Only used to pick a skill for a thread that has none yet. */
  triggers?: StudioSkillTriggers;
}

export type StudioSkillStatus = "active" | "draft" | "withdrawn";
export type StudioSkillVersionSource = "seed" | "admin" | "rollback" | "distilled";
/** published = in effect now or earlier; draft = distilled from a canvas, waiting for an admin to publish (never in effect by itself). */
export type StudioSkillVersionStatus = "published" | "draft";

/** One immutable skill version: front matter + body never change after insert; only a draft's status flips to published. */
export interface StudioSkillVersion {
  id: string; skillKey: string; version: number; status?: StudioSkillVersionStatus; source: StudioSkillVersionSource;
  author: string; note?: string; createdAt: string;
  /** Parsed YAML front matter (the server-side execution boundary) as JSON. */
  frontmatter: Record<string, unknown>;
  bodyMd: string;
  /** true for the version currently in effect (ip_skill.current_version). */
  current?: boolean;
  /** Drafts: the version they were distilled from. A draft at or below the current version can no longer be published as is. */
  baseVersion?: number;
  /** Drafts: where they came from (ids only, never content). */
  sourceProjectId?: string; sourceExecutionId?: string; sourceRunId?: string;
  publishedAt?: string;
}

/** GET /admin/studio/skills item. */
export interface StudioSkillAdminItem {
  key: string; name: string; status: StudioSkillStatus; currentVersion: number; summary: string;
  updatedBy?: string; createdAt: string; updatedAt: string;
  /** Drafts newer than the current version, waiting for review. */
  pendingDrafts: number;
  /** The current version as the runtime sees it (status = ip_skill.status, limits evaluated, triggers parsed). */
  skill: StudioSkillSummary;
  /** Repository seed file name when this skill is seeded from resources/studio/skills/*.md. */
  seedFile?: string;
}
/** GET /admin/studio/skills/{key}: the item plus the current version's full content. */
export interface StudioSkillAdminDetail extends StudioSkillAdminItem { current: StudioSkillVersion }

/** POST /admin/studio/skills: a whole skill file (YAML front matter + Markdown body); the key comes from the front matter. */
export interface StudioSkillCreateRequest { markdown: string; note?: string }
/** POST /admin/studio/skills/{key}/versions: publish a new immutable version (becomes current). */
export interface StudioSkillPublishRequest {
  /** YAML text (without the --- fences) or the JSON object. key must equal the path key; version and status are set by the server. */
  frontmatter: string | Record<string, unknown>;
  bodyMd: string; note?: string;
  /** Current version the admin edited from; mismatch → 409 STUDIO_SKILL_VERSION_CONFLICT. Omitted = no check. */
  expectedVersion?: number;
}
/** PUT /admin/studio/skills/{key}/status. Withdrawing the only active skill → 409 STUDIO_SKILL_LAST_ACTIVE. */
export interface StudioSkillStatusRequest { status: StudioSkillStatus }
/** POST /admin/studio/skills/{key}/rollback/{version} and POST /admin/studio/skills/{key}/versions/{version}/publish. */
export interface StudioSkillVersionActionRequest { note?: string; expectedVersion?: number }

export interface StudioSkillDryRunAsset { id?: string; type: "video" | "image" | "audio" | "text"; title?: string; description?: string; durationSec?: number }
/** POST /admin/studio/skills/{key}/dry-run: one skill_plan call, no user billing, nothing saved. */
export interface StudioSkillDryRunRequest {
  analysisMarkdown: string; brief: string; stage?: StudioPlanStage; assets?: StudioSkillDryRunAsset[];
  /** Admin-chosen text endpoint; omitted = the default planning endpoint. */
  endpointId?: string;
  /** Try a stored version (drafts included) instead of the current one. */
  version?: number;
  /** Try an unsaved edit before publishing (send both together; validated like a publish). */
  frontmatter?: string | Record<string, unknown>; bodyMd?: string;
}

export interface StudioProductionApproach {
  id: string; title: string; summary: string; rationale: string;
  preserve: string[]; change: string[]; tradeoffs: string[]; requiredCapabilities: string[];
}
export interface StudioPlanStep {
  id: string; operation: StudioPlanOperation; title: string; prompt: string;
  strategy?: { approachId: string; method: string; reason: string };
  execution?: "auto" | "confirm";
  /** Server quote; dry-run plans are not quoted, so usually absent. */
  quotedCost?: number;
  content?: string;
  referenceNodeIds: string[]; unresolvedReferences?: string[];
  dependsOn?: string[];
}
export interface StudioPlanBudget { estimated: number; autoFixCap: number; approvedCap?: number }
export interface StudioPlan {
  notes?: string[]; summary: string; steps: StudioPlanStep[]; questions: string[];
  skillKey?: string; skillVersion?: number; stage?: StudioPlanStage;
  revision?: number; fingerprint?: string;
  approaches?: StudioProductionApproach[]; recommendedApproachId?: string; confirmedApproachId?: string;
  budget?: StudioPlanBudget;
}

export interface StudioSkillDryRunResult {
  /** The normalized plan when the reply passed validation (not quoted, not fingerprinted); null otherwise. */
  plan: StudioPlan | null;
  validation: { ok: boolean; errors: string[] };
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  skillKey: string; skillVersion?: number; stage: StudioPlanStage; endpointId: string; model?: string; finishReason?: string;
  /** Start of the model reply when it did not validate (truncated, for debugging the skill). */
  rawExcerpt?: string;
}
