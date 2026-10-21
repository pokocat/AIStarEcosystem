import type { EnterpriseBillingSelection } from "./enterprise";
import type { VideoStudioMode, VideoStudioReferenceInput } from "./video-studio";
/** Unified Studio operations. IpRun remains the single execution record. */
export interface StudioVideoSettings {
  mode: VideoStudioMode;
  resolutionTier: string;
  seed?: number;
  firstFrameKey?: string;
  lastFrameKey?: string;
  references?: VideoStudioReferenceInput[];
  /** false =「按原文生成」：请厂商出片前不改写描述；不填 = 模型默认（H3 默认会改写）。只对 supportsPromptOptimization 的模型开放。 */
  optimizePrompt?: boolean;
}
export type StudioOperation = "text" | "script" | "storyboard" | "image" | "video" | "assemble" | "assistant" | "recreation" | "check";
export interface StudioScriptSettings { genre?: string; fusionGenres?: string[]; characterBrief?: string; structure?: string; audience?: string; era?: string; core?: string; style?: string; episodeCount?: number; episodeDurationSec?: number }
export type StudioAssistantMode = "general" | "original" | "adapt" | "director";
/** Free document text extraction; the imported canvas node owns the resulting text. */
export interface StudioStoryImportResult { text: string; format: "pdf" | "doc" | "docx" }
export interface StudioTokenPricing { inputCreditsPerK:number; outputCreditsPerK:number; maxInputTokens:number; maxOutputTokens:number; maxCost:number }
export interface StudioTokenBilling { inputTokens:number; outputTokens:number; credits:number; inputCreditsPerK:number; outputCreditsPerK:number }
export interface StudioTurn { billing?:StudioTokenBilling; role: "user" | "assistant"; content: string }
/** Two-stage skill plans (docs/ip-studio-conversational-video-recreation-plan.md §两阶段计划契约). Legacy fields stay for old records. */
export type StudioPlanStage = "analysis" | "production";
export type StudioPlanOperation = "text" | "script" | "storyboard" | "image" | "video" | "recreation" | "check" | "assemble";
export interface StudioProductionApproach {
  id: string; title: string; summary: string; rationale: string;
  preserve: string[]; change: string[]; tradeoffs: string[]; requiredCapabilities: string[];
}
/** Typed per-operation step settings; the server rejects untyped JSON. referenceBindings resolve to canvas nodes or earlier steps. */
export interface StudioStepReferenceBinding { stepId?: string; nodeId?: string; role: "character" | "scene" | "product" | "frame" | "clip" | "reference-image" | "reference-video" | "reference-audio"; order: number }
export type StudioSkillStepSettings =
  | { operation: "recreation"; sourceNodeId: string; mode: "segments"; maxSegmentSec: number | "model"; videoModel: string }
  | { operation: "image"; size?: string; aspectRatio?: string; count: 1 | 2 | 4; referenceBindings: StudioStepReferenceBinding[] }
  | { operation: "video"; video: StudioVideoSettings; durationSec: number; aspectRatio: string; count: 1 | 2 | 4; referenceBindings: StudioStepReferenceBinding[] }
  | { operation: "check"; targetStepId: string; targetRunId?: string; candidateIndex?: number; checkIds: string[] }
  | { operation: "assemble"; clipOrder: { stepId: string; runId?: string; candidateIndex?: number }[]; audioStrategy: "generated" | "source-audio" | "none" }
  | { operation: "text"; purpose: "script" | "prompt-revision" | "plan-compile" | "note"; editTarget?: { nodeId: string; field: "content" | "prompt" | "script"; snapshot: string } };
export interface StudioPlanBudget {
  /** Server-computed quote total of this stage's base steps. */
  estimated: number;
  /** Auto-fix sub-cap inside the stage cap. */
  autoFixCap: number;
  /** Bound by the server after the user confirms; never supplied by the model. */
  approvedCap?: number;
}
export interface StudioPlan {
  notes?:string[]; summary: string; steps: StudioPlanStep[]; questions: string[];
  skillKey?: string; skillVersion?: number; stage?: StudioPlanStage;
  /** Monotonic per thread; every content change of the plan creates a new revision and fingerprint. */
  revision?: number; fingerprint?: string;
  approaches?: StudioProductionApproach[]; recommendedApproachId?: string;
  /** Server-bound from the user's confirmation; never supplied by the model. */
  confirmedApproachId?: string;
  budget?: StudioPlanBudget;
}
export interface StudioPlanStep {
  id:string; operation:StudioPlanOperation; title:string; prompt:string;
  strategy?: { approachId: string; method: string; reason: string };
  /** auto = executor proceeds inside the approved scope; confirm = stop at this step for the user. */
  execution?: "auto" | "confirm";
  /** Server quote; never supplied by the model. */
  quotedCost?: number;
  settings?: StudioSkillStepSettings;
  /** Ready-to-adopt text, generated in the assistant's existing paid turn. */
  content?:string;
  /** An editable proposal for a referenced node; applying it still requires user adoption. */
  editTarget?: { nodeId:string; field:"content"|"prompt"|"script" };
  referenceNodeIds:string[]; unresolvedReferences?:string[];
  /** Earlier steps only; canvas IDs are resolved after their output exists. */
  dependsOn?:string[];
  /** Client-owned adoption binding. Never supplied by the model or copied in shares. */
  resultNodeId?:string;
}
export interface StudioReference {
  ipId?: string;
  avatarId?: string;
  lookId?: string;
  version?: number;
  storageKey: string;
  role: "character" | "scene" | "product" | "frame" | "clip";
}
export interface StudioRunRequest {
  billing?: EnterpriseBillingSelection;
  clientRequestId: string;
  nodeId: string;
  operation: StudioOperation;
  prompt: string;
  references?: StudioReference[];
  model?: string;
  size?: string;
  count?: number;
  durationSec?: number;
  aspectRatio?: string;
  settings?: StudioScriptSettings;
  episodeNo?: number;
  mode?: StudioAssistantMode | "segments";
  contextNodeIds?: string[];
  /** Read selected images and four sampled video frames; never an audio-understanding promise. */
  readVisuals?: boolean;
  history?: StudioTurn[];
  /** Full document for the in-editor revision path; ordinary assistant plans are unchanged. */
  scriptEdit?: { markdown: string };
  /** Plain-text node revision: prompt is the intent, content is the immutable source snapshot. */
  textEdit?: { content: string };
  /** A ceiling, never a caller-defined price. Rejected before any freeze if the price increases. */
  maxCost?: number;
  packaging?: StudioPackaging;
  /** assemble only: 成片高级编辑的时间线；有它时按时间线合成，packaging 不用。 */
  edit?: StudioEditTimeline;
  video?: StudioVideoSettings;
  /** recreation(mode=segments) only: segment length cap; "model" reads the selected video model contract. */
  recreation?: { maxSegmentSec: number | "model"; videoModel: string };
  /** check only: target run output to inspect against skill checks. Visual snapshot is built server-side. */
  check?: { targetRunId: string; targetStorageKey?: string; checkIds: string[] };
  /** Skill planning binding; selects method/scope, never payment or execution authority. */
  skillKey?: string; skillVersion?: number; stage?: StudioPlanStage; executionId?: string;
  /** Parent dialogue binding for the server-side agent loop (new entry); legacy assistant requests omit it. */
  dialogue?: { threadId: string; messageId: string };
}

export interface StudioPackaging { brand?:string;title?:string;cta?:string;captions?:{start:number;end:number;text:string}[];voiceoverStorageKey?:string }
/** Editable work settings live in the canvas document, separately from accepted requests. */
export interface StudioWorkDraft {
  aspectRatio: string;
  packagingEnabled: boolean;
  brand: string;
  title: string;
  cta: string;
  captionText: string;
  voiceoverStorageKey?: string;
  /** 高级编辑（Twick）的工程；有它时成片以它为准。素材只存 storageKey，打开时再取。 */
  advanced?: StudioAdvancedEdit;
}
/** 高级编辑工程：Twick 的 ProjectJSON，媒体元素的 `metadata.storageKey` 是真值，`props.src` 不落库。 */
export interface StudioAdvancedEdit {
  engine: "twick";
  savedAt: string;
  project: { tracks: unknown[]; version: number; [key: string]: unknown };
}
/**
 * 交给服务端合成的剪辑清单（由高级编辑的工程转出来，时间单位秒）。
 * 视频按开始时间排成一条主轨，空隙补黑；音频、文字、字幕按时间叠上去。
 */
export interface StudioEditTimeline {
  width: number;
  height: number;
  clips: StudioEditMedia[];
  audios: StudioEditMedia[];
  texts: StudioEditText[];
  captions: StudioEditCaption[];
}
/** start / end 是在成片里的位置；from 是从素材的第几秒开始取；volume 0–2。 */
export interface StudioEditMedia { storageKey: string; start: number; end: number; from: number; volume: number }
/** x / y 是相对画面中心的偏移（像素）；color 为 #RRGGBB。 */
export interface StudioEditText { text: string; start: number; end: number; x: number; y: number; fontSize: number; color: string }
export interface StudioEditCaption { text: string; start: number; end: number }
export interface StudioShot {
  id: string;
  title: string;
  description: string;
  dialogue: string;
  durationSec: number;
  characters: string[];
  episodeNo?: number;
}
export interface StudioScript {
  title: string;
  outline: string;
  characters: { name: string; description: string }[];
  scenes: { name: string; description: string }[];
  props: { name: string; description: string }[];
  episodes: { no: number; title: string; content: string }[];
  shots: StudioShot[];
}
export interface StudioCapabilities {
  mock: boolean;
  operations: StudioOperation[];
  imageCost: number;
  textCost: number;
  videoCost: number | null;
  imageModelMode?: "fixed" | "selectable";
  textModelMode?: "fixed" | "selectable";
  textModels?: { endpointId: string; name: string; isDefault: boolean; supportsVision?: boolean; supportsTools?: boolean; supportsStreaming?: boolean; creditCost?: number; tokenPricing?:StudioTokenPricing }[];
}
export interface StudioAdoptRequest {
  nodeId: string;
  storageKey: string;
  name: string;
  ipId?: string;
  avatarId?: string;
  intent?: "main" | "look";
  description?: string;
  assetRole?: StudioIpAssetRole;
}
export type StudioIpAssetRole = "main" | "history" | "sheet" | "portrait" | "three-view" | "front" | "side" | "back" | "expression" | "detail" | "look";
export interface StudioAdoptResult {
  ipId: string;
  avatarId: string;
  version: number;
  storageKey: string;
  lookId?: string;
}
export interface StudioIpAsset extends Omit<StudioAdoptResult,"ipId"> {
  librarySource?: "mine" | "official";
  ipId?: string | null;
  name: string;
  url: string;
  current: boolean;
  characterName?: string;
  path?: "ai" | "real";
  assetRole?: StudioIpAssetRole;
  description?: string;
  attributes?: Record<string,string>;
}

/** Business metadata on generic canvas nodes. Server stores the client document whole. */
export interface StudioNodeMetadata {
  libraryReference?: { objectId:string; versionId?:string; name:string; description:string; folderName:string; sourceTitle:string };
  assetExtraction?: { clientRequestId:string; sourceHash:string; title:string; runId?:string; model?:string; maxCost:number; episodeNo?:number };
  /** Template copies use ordinary canvas inputs; constraints are checked when a connected node generates. */
  templateInput?: { required: boolean; label: string; options?: string[] };
  /** Authored video defaults for an ordinary copied node; contains no input media or task identity. */
  videoPreset?: Pick<StudioVideoSettings, "mode" | "resolutionTier" | "seed">;
  /** Display projection refreshed from IpRun; never used as execution or queue authority. */
  task?: { status: "running" | "done" | "failed"; stage: string; pct: number; errorCode?: string; errorMessage?: string; logId?: string;
    queue?: import('./ai-model-concurrency').AiGenerationQueuePosition | null };
  workDraft?: StudioWorkDraft;
  speechDraft?: Omit<StudioSpeechRequest,'clientRequestId'|'nodeId'|'maxCost'>;
  /** Client-owned editor draft, separate from the immutable accepted run request. */
  composerDraft?: { operation: StudioOperation; prompt: string; referenceNodeIds: string[]; connectedReferenceNodeIds?: string[]; aspectRatio: string; model?: string;
    count: number; durationSec: number; settings: StudioScriptSettings; pasteScript?: boolean;
    episodeNo?: number; rewriteScope?: StudioNodeMetadata['rewriteScope'];
    scriptMode?: "original" | "adapt"; scriptSourceNodeId?: string;
    video: { mode: VideoStudioMode; tier: string; seed?: number; firstId?: string; lastId?: string } };
  sourceRange?: {startSec:number;endSec:number;storageKey:string};
  recreation?: { mode?:"segments"; document?:boolean; materializedSegmentNos?:number[]; materializedAudioSourceKey?:string; resumeRunId?:string; study?:StudioFilmStudy; materializedRunId?:string; sourceNodeId: string; sourceStorageKey: string; sourceTitle: string; report?: StudioRecreationReport };
  kind: "recreation" | "text" | "script" | "shot" | "ip" | "work" | "assistant" | "batch" | "audio" | "check";
  /** Stable binding to a plan execution step; status and cost always come from IpRun / ip_plan_execution. */
  execution?: { executionId: string; stepId: string; runId?: string };
  /** Display projection of the latest native check run on this node. */
  check?: StudioCheckResult;
  speechRequest?: StudioSpeechRequest;
  voiceProfile?: StudioVoiceProfile;
  lipSyncRequest?: StudioLipSyncRequest;
  lipSyncNormalized?: boolean;
  settings?: StudioScriptSettings;
  scriptMode?: "original" | "adapt";
  scriptSourceNodeId?: string;
  episodeNo?: number;
  conversation?: { mode: StudioAssistantMode; turns: StudioTurn[]; plan?: StudioPlan };
  /** Original values at send time; adoption rejects concurrent manual edits. */
  assistantEditSnapshots?: Record<string, Partial<Record<"content"|"prompt"|"script",string>>>;
  /** Client-owned rollback snapshot; model request.history is only a bounded context. */
  assistantPreviousConversation?: NonNullable<StudioNodeMetadata["conversation"]>;
  batch?: StudioBatch;
  script?: StudioScript;
  /** Markdown is canonical after editor save; script is its downstream structured projection. */
  scriptMarkdown?: string;
  textEditor?: {
    turns: StudioTurn[];
    /** A concurrent manual edit keeps the AI result here rather than overwriting the newer body. */
    proposal?: { content: string; summary: string; runId: string };
  };
  scriptEditor?: {
    draft?: string;
    turns: StudioTurn[];
    chatDraft?: string;
    model?: string;
    pending?: { request: StudioRunRequest; baseMarkdown: string; runId?: string };
    proposal?: { markdown: string; summary: string; baseMarkdown: string; runId: string };
    error?: string;
  };
  shot?: StudioShot;
  parentNodeId?: string;
  references?: StudioReference[];
  upstreamChanged?: boolean;
  assetRole?: "character" | "scene" | "product";
  libraryAssetRole?: StudioIpAssetRole;
  /** Display grouping for published character copies, independent of owner avatar identity. */
  libraryCharacterId?: string;
  libraryCharacterName?: string;
  adoption?: StudioAdoptResult;
  runId?: string;
  request?: StudioRunRequest;
  mock?: boolean;
  includeInWork?: boolean;
  /** UI projection of template execution acceptance; refreshed from the server, never an approval authority. */
  templateAccepted?: boolean;
  order?: number;
  rewriteScope?: { field: "outline" | "episode"; episodeNo?: number };
}

/** Preset speech is distinct from a trained personal voice or lip-sync driver. */
export interface StudioSpeechRequest {
  billing?: EnterpriseBillingSelection;
  clientRequestId: string; nodeId: string; model: string; text: string; speaker: string;
  instruct?: string; maxCost: number; avatarId?: string; voiceId?: string;
}
export interface StudioSpeechCatalog {
  models: { endpointId: string; name: string; isDefault: boolean; creditCost: number | null; creditCostPerSecond?: number | null }[];
  voices: { speaker: string; name: string; language: string; description: string }[];
  maxTextLength: number; maxInstructLength: number;
}

export interface StudioLipSyncInput { model:string;videoStorageKey:string;audioStorageKey:string }
export interface StudioLipSyncRequest extends StudioLipSyncInput { billing?:EnterpriseBillingSelection; clientRequestId:string;nodeId:string;maxCost:number }
export interface StudioLipSyncCatalog { models:{endpointId:string;name:string;isDefault:boolean;creditCostPerSecond:number|null}[];maxAudioSeconds:number }
export interface StudioLipSyncQuote { cost:number;billableSeconds:number;audioDurationSec:number;videoDurationSec:number }

/** Saved approval and request identities; actual status and cost always come from IpRun. */
export interface StudioBatchStep {
  id: string; title: string; sourceNodeId: string; sourceSnapshot: string;
  /** An already adopted frame is part of the approval; newly generated frames arrive later. */
  sourceFrameKey?: string;
  targetNodeId: string; operation: "image" | "video" | "assemble"; maxCost: number;
  request?: StudioRunRequest; runId?: string;
}
export interface StudioBatch {
  steps: StudioBatchStep[]; imageModel?: string; videoModel?: string; aspectRatio: string; durationSec: number;
  approvedCost: number; episodeNo?: number;
}

export interface StudioAssetCatalog {
  products:{id:string;name:string;description?:string;storageKey?:string;url?:string;status:string}[];
  performers:{avatarId:string;ipId?:string;name:string;imageReady:boolean;driverStatus:"unavailable"|"not_created"|"training"|"ready"|"failed";voiceId?:string}[];
  voices:{id:string;name:string;avatarId?:string;status:"not_created"|"training"|"ready"|"failed";demoUrl?:string}[];
  voiceEngineReady:boolean;
  videoLipSyncReady:boolean;
}

/** Immutable official preset versions, stored in the existing DapVoice inventory. */
export interface StudioVoiceProfile {
  voiceId:string;avatarId:string;name:string;version:number;speaker:string;instruct?:string;
  demoUrl?:string;demoStorageKey?:string;sourceRunId:string;
}
export interface StudioVoiceCatalog {
  performers:{avatarId:string;ipId?:string;name:string;voiceId?:string}[];
  profiles:StudioVoiceProfile[];
}
export interface StudioAdoptVoiceRequest {runId:string;avatarId:string;name:string;expectedVoiceId?:string}
export interface StudioBindVoiceRequest {voiceId:string;expectedVoiceId?:string}

/** Evidence indexes are 1-based indexes into source.frameTimes; times are approximate samples. */
export interface StudioRecreationEvidence { observed: string; rule: string; evidenceFrames: number[] }
export interface StudioRecreationReport {
  title: string;
  creativePremise: string;
  references?: { storageKey:string;url?:string;frame:number;timeSec:number;width:number;height:number }[];
  visualGenes: (StudioRecreationEvidence & { dimension: string })[];
  motifs: string[];
  retain: string[];
  skeleton: (StudioRecreationEvidence & { dimension: string })[];
  techniques: (StudioRecreationEvidence & { name: string; effect: string })[];
  uncertainties: string[];
  recreationPrompt: string;
  source: { nodeId: string; title: string; storageKey: string; durationSec: number; frameTimes: number[]; audioAnalyzed: false; samplingStrategy?: "visual-change-v1" | "visual-change-v2" | "hypit-media-v1"; mediaEngineRevision?: string; visualChanges?: { timeSec:number; kind:"visual"|"lighting" }[] };
}

/** Engineering-owned time ranges and media, with model-authored Markdown. */
export interface StudioSourceAudio {
 sourceNodeId:string;
 sourceStorageKey:string;
 sourceTitle:string;
 status:"ready"|"absent";
 storageKey?:string;
 url?:string;
 mimeType?:string;
 durationSec?:number;
 bytes?:number;
}

export interface StudioFilmStudy {
 source: StudioRecreationReport['source'];
 strategy: "model" | "visual-changes";
 segments: {no:number;title:string;startSec:number;endSec:number;durationSec?:number;storageKey?:string;url?:string;coverStorageKey?:string;coverUrl?:string;width?:number;height?:number;markdown?:string;status:"pending"|"done";error?:string}[];
}

// ─── Skill catalog, native check, dialogue thread/events, plan execution (docs/ip-studio-conversational-video-recreation-plan.md) ───
export interface StudioSkillLimits { maxSourceSec: number; maxSegments: number; maxSegmentSec: number | "model"; maxSteps: number; maxAutoFixPerSegment: number }
export interface StudioSkillSummary {
  key: string; name: string; version: number; status: "active" | "draft" | "withdrawn"; planning: "dynamic";
  summary: string; methodExamples: string[]; operations: Record<StudioPlanStage, StudioPlanOperation[]>;
  limits: StudioSkillLimits; checks: string[]; autoFixChecks: string[]; requiredCapabilities: string[];
  /** S3: optional routing hints from the front matter (absent = no triggers). Only used to pick a skill for a thread that has none yet. */
  triggers?: StudioSkillTriggers;
}
export type StudioCheckVerdict = "pass" | "fail" | "unknown";
export interface StudioCheckEvidence { kind: "frame" | "media" | "text"; timeSec?: number; observation: string }
export interface StudioCheckItem { id: string; status: StudioCheckVerdict; evidence: StudioCheckEvidence[]; reason: string; suggestion?: string }
/** output.check of a native check run. Evidence frames/keys come from the real target media, never from the model. */
export interface StudioCheckResult { status: StudioCheckVerdict; targetRunId: string; targetStorageKey?: string; sampledTimesSec?: number[]; items: StudioCheckItem[] }

export type StudioMessageBlock =
  | { type: "plan"; planRunId: string; revision: number; fingerprint: string; plan: StudioPlan }
  | { type: "approval"; approvalId: string; stage: StudioPlanStage; planFingerprint: string; scope: string[]; quotedCost: number; budgetCap: number; autoFixCap: number;
      billingSelection?: EnterpriseBillingSelection; status: "pending" | "approved" | "expired" | "superseded"; approvedMessageId?: string; executionId?: string; expiresAt?: string;
      /** What the server actually authorized (immutable once approved); the proposal fields above stay the quote. */
      approvedBudgetCap?: number; approvedAutoFixCap?: number; approvedAt?: string; approvedByMessageId?: string;
      /** Plan revision the approval bound (the thread's revision at confirmation). */
      approvedPlanRevision?: number;
      /** Set when a newer plan revision or a newer card replaced this pending card. */
      supersededAt?: string;
      /** Part of the default budgetCap kept for dialogue turns during the stage (turns count against the stage budget). */
      dialogueReserve?: number;
      /** Budget-raise cards posted by the executor: how much the next step was short. */
      shortfall?: number }
  | { type: "tool_call"; toolCallId: string; toolName: string; title: string; safeInputSummary: string; status: "running" | "done" | "failed"; childRunId?: string;
      startedAt: string; finishedAt?: string; durationMs?: number; progress?: string; result?: { summary: string; nodeIds?: string[]; storageKeys?: string[] };
      creditsActual?: number; settling?: boolean; errorCode?: string; errorMessage?: string }
  | { type: "question"; questionId: string; text: string; options?: string[]; answeredMessageId?: string }
  | { type: "adoption"; nodeId: string; field: "content" | "prompt" | "script"; content: string; snapshot: string; status: "proposed" | "adopted" | "rejected" };
export type StudioDialogueMessageStatus = "queued" | "applied" | "streaming" | "done" | "failed" | "interrupted";
export interface StudioDialogueMessage {
  id: string; threadId: string; seq: number; turnId?: string; runId?: string; role: "user" | "assistant" | "system";
  text: string; blocks: StudioMessageBlock[]; pinnedNodeIds?: string[]; attachmentNodeIds?: string[]; clientMessageId?: string;
  billing?: StudioTokenBilling; settling?: boolean; status: StudioDialogueMessageStatus; createdAt: string;
  /** Set when imported from the legacy four-mode conversation nodes. */
  legacyNodeId?: string;
  /** Follow-ups offered under an assistant message (an execution's completion summary keeps them across reloads). */
  suggestions?: string[];
}
export interface StudioDialogueThread {
  id: string; projectId: string; parentThreadId?: string; branchFromMessageId?: string; title?: string;
  lastSeq: number; activeTurnId?: string; activeExecutionId?: string; createdAt: string; updatedAt: string;
  /** S3: the skill this thread is bound to (explicit choice or intent routing on its first turn); absent until a turn picks one. */
  skillKey?: string; skillVersion?: number;
}
export interface StudioDialogueState { thread: StudioDialogueThread; messages: StudioDialogueMessage[]; nextCursor?: string; latestSeq: number; execution?: StudioPlanExecution }
export interface StudioPostMessageRequest { clientMessageId: string; text: string; pinnedNodeIds?: string[]; attachmentNodeIds?: string[]; expectedPlanRevision?: number; skillKey?: string; billing?: EnterpriseBillingSelection; maxCost?: number;
  /** Text endpoint for this turn when the account may choose; omitted = scene default. Never a payment authority. */
  model?: string }
export interface StudioPostMessageResult { messageId: string; turnId?: string; runId?: string; queueState: "accepted" | "queued" | "applied" }
export interface StudioDialogueControlRequest { controlId: string; action: "stop" | "pause" | "resume"; executionId?: string }
export interface StudioBranchRequest { clientRequestId: string; fromMessageId: string }

export type StudioDialogueEventType = "message.delta" | "tool.started" | "tool.progress" | "tool.finished" | "plan.proposed" | "approval.required" | "node.upsert" | "check.result" | "budget.update" | "turn.done";
export interface StudioDialogueEvent<T = unknown> { eventId: string; seq: number; threadId: string; turnId: string; runId?: string; executionId?: string; createdAt: string; type: StudioDialogueEventType; data: T }
export interface StudioMessageDeltaData { messageId: string; partId: string; delta: string }
export interface StudioToolEventData { toolCallId: string; toolName: string; /** Assistant message the work-record card belongs to. */ messageId?: string; title?: string; safeInputSummary?: string; childRunId?: string; status?: "running" | "done" | "failed"; progress?: string;
  result?: { summary: string; nodeIds?: string[]; storageKeys?: string[] }; creditsActual?: number; settling?: boolean; durationMs?: number; errorCode?: string; errorMessage?: string }
export interface StudioPlanProposedData { messageId: string; block: Extract<StudioMessageBlock, { type: "plan" }> }
export interface StudioApprovalRequiredData { messageId: string; block: Extract<StudioMessageBlock, { type: "approval" }>; shortfall?: number }
export interface StudioNodeUpsertData { nodeId: string; op: "create" | "update" | "connect" | "propose"; node?: import("./ip-studio").IpNode; connection?: { fromNodeId: string; toNodeId: string };
  executionId?: string; stepId?: string; runId?: string; expectedDocVersion?: string; proposal?: { field: "content" | "prompt" | "script"; content: string } }
export interface StudioCheckResultData { stepId?: string; runId: string; result: StudioCheckResult }
export interface StudioBudgetUpdateData { executionId: string; stage: StudioPlanStage; approvedCap: number; spent: number; inFlight: number; remaining: number; shortfall?: number; source: "actual" | "quote";
  /** Parent-dialogue share already included in spent / inFlight (never add it again). */
  dialogueSpent?: number; dialogueInFlight?: number }
export interface StudioTurnDoneData { reason: "completed" | "waiting_user" | "handed_off" | "interrupted" | "failed"; messageId: string; billing?: StudioTokenBilling; settling?: boolean; suggestions?: string[] }

export type StudioPlanExecutionStatus = "running" | "paused" | "needs_user" | "done" | "partial" | "failed" | "canceled";
export type StudioPlanExecutionStepStatus = "pending" | "submitted" | "running" | "done" | "failed" | "skipped" | "needs_user";
export interface StudioPlanExecutionStep { id: string; title: string; operation: StudioPlanOperation; stage: StudioPlanStage; dependsOn: string[]; status: StudioPlanExecutionStepStatus;
  runIds: string[]; attempt: number; quotedCost: number; maxCost?: number; acceptedRunId?: string; acceptedCandidateIndex?: number; nodeId?: string; reason?: string }
export interface StudioPlanExecutionBudget { stage: StudioPlanStage; approvedCap: number; autoFixCap: number; spent: number; inFlight: number; remaining: number; shortfall?: number;
  /** Parent-dialogue share already included in spent / inFlight (never add it again). */
  dialogueSpent?: number; dialogueInFlight?: number }
export interface StudioPlanExecution {
  id: string; projectId: string; threadId?: string; skillKey: string; skillVersion: number; stage: StudioPlanStage; planRunId: string; planRevision: number; planFingerprint: string;
  status: StudioPlanExecutionStatus; steps: StudioPlanExecutionStep[]; budgets: StudioPlanExecutionBudget[]; billing?: EnterpriseBillingSelection; needsUserReason?: string;
  startedAt: string; deadlineAt: string; updatedAt: string; finishedAt?: string;
}
/** Create an analysis execution, or confirm a new stage on the same execution (executionId + approachId + expectedRevision). */
export interface StudioPlanExecutionCreateRequest { clientRequestId: string; stage: StudioPlanStage; planRunId: string; planFingerprint: string; approachId?: string; budgetCap: number; autoFixCap: number;
  billing?: EnterpriseBillingSelection; executionId?: string; expectedRevision?: number; approvalId?: string; confirmationMessageId?: string }
export interface StudioPlanExecutionControlRequest { clientRequestId: string; expectedStatus?: StudioPlanExecutionStatus }
export interface StudioPlanExecutionAcceptRequest { clientRequestId: string; runId: string; candidateIndex?: number }

// ─── S3: skill registry with immutable versions, admin editing / dry-run, intent routing, distilled drafts ───
// (docs/ip-studio-conversational-video-recreation-plan.md §第三阶段 S3; server: ipstudio/skill/**, V63 ip_skill / ip_skill_version)
/** Routing hints in a skill's front matter. media = attachment/pinned node types that suggest this skill; default = tie-breaker among the best matches (a message matching no skill binds none). */
export interface StudioSkillTriggers { media?: ("video" | "image" | "audio" | "text")[]; keywords?: string[]; default?: boolean }
export type StudioSkillStatus = "active" | "draft" | "withdrawn";
export type StudioSkillVersionSource = "seed" | "admin" | "rollback" | "distilled";
/** published = in effect now or earlier; draft = distilled from a canvas, waiting for an admin to publish (never in effect by itself). */
export type StudioSkillVersionStatus = "published" | "draft";
/** One immutable skill version: front matter + body (and digest) never change after insert; publishing a draft only flips its status, sets publishedAt and appends the publish note. */
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
export interface StudioSkillDryRunResult {
  /** The normalized plan when the reply passed validation (not quoted, not fingerprinted); null otherwise. */
  plan: StudioPlan | null;
  validation: { ok: boolean; errors: string[] };
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  skillKey: string; skillVersion?: number; stage: StudioPlanStage; endpointId: string; model?: string; finishReason?: string;
  /** Start of the model reply when it did not validate (truncated, for debugging the skill). */
  rawExcerpt?: string;
}
/** POST /v1/ip-studio/projects/{id}/skill-drafts (operators only): distill a finished execution into a draft version. Returns the text run (IpRun). */
export interface StudioSkillDraftRequest { clientRequestId: string; executionId: string; note?: string; maxCost: number; billing?: EnterpriseBillingSelection }
/** output.skillDraft of a finished distill run: the draft was saved; publishing is an admin action. */
export interface StudioSkillDraftOutput { skillKey: string; version: number; baseVersion: number; changeNote: string; strippedReferences: number }
/** error.details of 400 STUDIO_SKILL_REQUIRED: several skills fit (or none clearly), so the UI should ask which one. */
export interface StudioSkillRequiredDetails { skills: { key: string; name: string; summary: string }[] }
