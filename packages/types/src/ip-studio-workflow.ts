import type { StudioTakeChange } from "./ip-studio-scenes";
import type { EnterpriseBillingSelection } from "./enterprise";
import type { VideoStudioMode, VideoStudioReferenceInput } from "./video-studio";
/** Optional model-generated script follow-ups; limits count Unicode code points. */
export interface StudioScriptSuggestion { label: string; instruction: string }
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
  /**
   * 智能优化（2026-10-27）：提交前先按 H3 官方写法把提示词改写成英文（台词保留原文）。auto = 改写完直接出片（创作助手）；
   * review = 没有提示就直接出片，有提示停下来让用户选用优化稿还是原文（画布）。带它时服务端关掉厂商自己的改写。
   */
  rewrite?: "auto" | "review";
}
/** 智能优化的结果：发给模型的英文（台词已填好）、要用户判断的提示、已经自动处理好的小事、能不能直接用（超长不能用）。 */
export interface StudioVideoPromptOptimization { text: string; warnings: string[]; notes?: string[]; usable: boolean }
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
  | { operation: "image"; model?: string; size?: string; aspectRatio?: string; count: 1 | 2 | 4; referenceBindings: StudioStepReferenceBinding[] }
  | { operation: "video"; model?: string; video: StudioVideoSettings; durationSec: number; aspectRatio: string; count: 1 | 2 | 4; referenceBindings: StudioStepReferenceBinding[] }
  | { operation: "check"; targetStepId: string; targetRunId?: string; candidateIndex?: number; checkIds: string[]; sampling?: "shots"; compareReferences?: boolean; /** 可省的检查：报价放不下批准的上限时按名次从大到小省掉（1 最后省）。 */ optionalRank?: number }
  | { operation: "assemble"; clipOrder: { stepId: string; runId?: string; candidateIndex?: number }[]; audioStrategy: "generated" | "source-audio" | "none" }
  | { operation: "text"; purpose: "script" | "prompt-revision" | "plan-compile" | "note"; editTarget?: { nodeId: string; field: "content" | "prompt" | "script"; snapshot: string } };
export interface StudioPlanBudget {
  /** Server-computed quote total of this stage's base steps. */
  estimated: number;
  /** 确认卡上的预估（折后价加一般用量）；estimated 是用户授权的上限。 */
  expected?: number;
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
  /**
   * The canvas object prepared for this step's result (the assistant's create_nodes draft or an empty object the user
   * placed): the result fills it instead of a new node. Checked against the saved canvas at confirmation; a target that
   * no longer fits is dropped and the step gets its own node (§6.1).
   */
  targetNodeId?:string;
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
  modelBilling?: import('./model-billing').ModelBillingApproval;
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
  check?: {
    targetRunId: string; targetStorageKey?: string; checkIds: string[];
    /** "shots": sample by the real cuts of the checked video (start and end of each shot) instead of four even frames. */
    sampling?: "shots";
    /** Images shown to the checker next to the result (the caller's own files), labelled like the checked step's prompt (图1…). */
    references?: { label: string; storageKey: string }[];
  };
  /** Skill planning binding; selects method/scope, never payment or execution authority. */
  skillKey?: string; skillVersion?: number; stage?: StudioPlanStage; executionId?: string;
  /** Parent dialogue binding for the server-side agent loop (new entry); legacy assistant requests omit it. */
  dialogue?: { threadId: string; messageId: string };
  /**
   * AI 视频页的编导（operation "text" + textEdit）：场景输入，服务端按提示词库的编导环节拼 system / user 并记下版本
   * （docs/studio-prompt-architecture.md §5.1）。有它时 prompt 只是显示用的一句话。
   */
  scene?: import('./ip-studio-scenes').StudioSceneComposeRequest;
}

export type StudioQuality = "720p" | "1080p";
/** auto = 合成时自动生成；manual = 用户自己填写时间和文字；off = 不加。 */
export type StudioCaptionMode = "auto" | "manual" | "off";
export interface StudioPackaging {
  brand?:string;title?:string;cta?:string;captions?:{start:number;end:number;text:string}[];voiceoverStorageKey?:string;
  /** 合成阶段自动生成字幕（手写的 captions 优先）。 */
  autoCaptions?:boolean;
  /** 背景音乐，说话时自动压低。 */
  musicStorageKey?:string;
  /** 缺省跟随片段。 */
  quality?:StudioQuality;
}
/**
 * 合成结果带回来的字幕。status：recognized = 时间来自语音识别；estimated = 有台词，时间按镜头估算；manual = 手写；
 * no_lines = 没有台词；no_speech = 没听到人声；unavailable = 语音识别不可用，这次没加。
 */
export interface StudioCaptionResult { status:"recognized"|"estimated"|"manual"|"no_lines"|"no_speech"|"unavailable"; cues:{start:number;end:number;text:string}[] }
/** Editable work settings live in the canvas document, separately from accepted requests. */
export interface StudioWorkDraft {
  aspectRatio: string;
  packagingEnabled: boolean;
  brand: string;
  title: string;
  cta: string;
  captionText: string;
  voiceoverStorageKey?: string;
  /** 老画布没有这个字段：填过字幕的按手写，其余按自动（见 studioCaptionMode）。 */
  captionMode?: StudioCaptionMode;
  musicStorageKey?: string;
  quality?: StudioQuality;
  /** 高级编辑（Twick）的工程；有它时成片以它为准。素材只存 storageKey，打开时再取。 */
  advanced?: StudioAdvancedEdit;
}
/** 高级编辑工程：Twick 的 ProjectJSON，媒体元素的 `metadata.storageKey` 是真值，`props.src` 不落库。 */
export interface StudioAdvancedEdit {
  engine: "twick";
  savedAt: string;
  project: { tracks: unknown[]; version: number; [key: string]: unknown };
  /** 这份工程的画面尺寸（元素坐标都按它算）；2026-11-07 之前的工程没有，是 720 档。 */
  size?: { width: number; height: number };
  /** 时间线上没有字幕时，导出时自动生成。 */
  autoCaptions?: boolean;
  /** 背景音乐：循环铺满全片，人物说话时自动压低，和一键成片同一套处理。 */
  musicStorageKey?: string;
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
  /** 画中画和贴图。 */
  overlays?: StudioEditOverlay[];
  /** 时间线上没有字幕时，导出时自动生成。 */
  autoCaptions?: boolean;
  /** 背景音乐：循环铺满全片，人物说话时自动压低，和一键成片同一套处理。 */
  musicStorageKey?: string;
}
/**
 * start / end 是在成片里的位置；from 是从素材的第几秒开始取；volume 0–2。
 * speed 播放速度（缺省 1）；fadeIn / fadeOut 开头、结尾淡入淡出的秒数；look 调色预设（saturated | bright | black_white | warm | cool）。
 */
export interface StudioEditMedia { storageKey: string; start: number; end: number; from: number; volume: number; speed?: number; fadeIn?: number; fadeOut?: number; look?: string }
/** 画中画（video）或贴图（image）：x / y 是相对画面中心的偏移（像素），width / height 是显示尺寸。 */
export interface StudioEditOverlay { kind: "video" | "image"; storageKey: string; start: number; end: number; from?: number; x: number; y: number; width: number; height: number; volume?: number; speed?: number }
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
  /** 语音识别已开通：自动字幕能从声音生成。没开通时一键成片合成前就说明。 */
  captionRecognition?: boolean;
  textModels?: { endpointId: string; name: string; isDefault: boolean; supportsVision?: boolean; supportsTools?: boolean; supportsStreaming?: boolean; creditCost?: number; tokenPricing?:StudioTokenPricing; dialogueTokenPricing?:StudioTokenPricing }[];
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
  /** 官方形象的使用方式：free 免费，可直接用于生成；license 需授权，暂不能选。我的 IP 没有这一项。 */
  access?: "free" | "license" | null;
  /** 官方形象分类（pro / life / ugc / community），选择框按它筛选。 */
  category?: string | null;
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

/** See StudioNodeMetadata.spec. Mirrors the server's NodeSpecs (dialogue tools). */
export interface StudioNodeSpec {
  aspectRatio?: string;
  durationSec?: number;
  count?: number;
  references?: { nodeId: string; role: "character" | "scene" | "product" | "frame" | "style" }[];
  source: "assistant";
  updatedAt: string;
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
  /** 合成时自动生成的字幕：结果说明用它，打开高级编辑时放到时间线上。 */
  captions?: StudioCaptionResult;
  /** 成片节点：提交导出的时间，用来在「已导出的成片」里分清哪条最新。 */
  exportedAt?: string;
  speechDraft?: Omit<StudioSpeechRequest,'clientRequestId'|'nodeId'|'maxCost'>;
  /**
   * Settings the assistant wrote for this image / video draft (create_nodes / update_nodes): what the user said in the
   * conversation — ratio, seconds, count, which material is used as what. The composer opens with them; a value the chosen
   * model cannot do is shown as a blocking message, never replaced. `references` are also canvas edges into the node.
   */
  spec?: StudioNodeSpec;
  /** Client-owned editor draft, separate from the immutable accepted run request. */
  composerDraft?: { operation: StudioOperation; prompt: string; referenceNodeIds: string[]; connectedReferenceNodeIds?: string[]; aspectRatio: string; model?: string; size?: string;
    count: number; durationSec: number; settings: StudioScriptSettings; pasteScript?: boolean;
    episodeNo?: number; rewriteScope?: StudioNodeMetadata['rewriteScope'];
    scriptMode?: "original" | "adapt"; scriptSourceNodeId?: string;
    video: { mode: VideoStudioMode; tier: string; seed?: number; firstId?: string; lastId?: string } };
  sourceRange?: {startSec:number;endSec:number;storageKey:string};
  /**
   * AI 视频页按脚本出的视频：编辑框里的完整脚本。发给模型的 request.prompt 是从它挑出来的
   * （apps/web-aiavatar/src/ip/scenes/scene-script-layers.ts，去掉只给人看的段落）；「修改后生成」放回的是它。没挑过时不写。
   */
  sceneScript?: string;
  /**
   * AI 视频页「编导」的一轮（docs/studio-scene-creation.md §8）：用户这句话（没写就是空串）、是不是在改上一版，
   * 以及写这版脚本时的时长 / 画面 / 语言。脚本正文就是节点 content，任务和计费是这个节点上普通的文字任务。
   */
  sceneDirector?: { ask: string; revision: boolean; duration: number; ratio: string; language: string; at: string;
    /** 写这一版时选的场景选项（出镜方式、语气…）：改稿沿用它，不回到默认值。2026-10-30 之前写的版本没有。 */
    options?: Record<string, string>;
    /** 写这一版时按哪个视频模型、交给它哪几张图（文件 key，按图1、图2 的顺序）写的：出片时换了就提示让编导按新的改一版。 */
    videoModel?: string; refs?: string[];
    /** Suggestions from this reply only: at most 3, label <=8, instruction <=80 code points. */
    suggestions?: StudioScriptSuggestion[] };
  /**
   * AI 视频页「视频裂变」给某条任务（of = 任务编号）找的变量（kind=variables，正文是变量清单）或 AI 改写的一版脚本（kind=rewrite，正文是脚本）。
   * 和编导的版本分开放，不出现在编导那一页；batch 是同一次操作的编号，每次重新写换一个。
   */
  sceneTake?: { of: string; kind: "variables" | "rewrite"; batch: string; at: string; index?: number; total?: number; changes?: StudioTakeChange[] };
  /** AI 图片页这一次出图用的条件（场景、补充要求、改过的描述、选项、模型和规格；参考图看请求里的 references）。「用这次的设置再做」按它放回，不把拼好的整段话当描述。 */
  sceneImage?: { sceneId: string; supplement: string; custom?: string; options: Record<string, string>; model?: string; ratio: string; size?: string; count: number; refCounts?: number[] };
  recreation?: { mode?:"segments"; document?:boolean; materializedSegmentNos?:number[]; materializedAudioSourceKey?:string; resumeRunId?:string; study?:StudioFilmStudy; materializedRunId?:string; sourceNodeId: string; sourceStorageKey: string; sourceTitle: string; report?: StudioRecreationReport };
  kind: "recreation" | "text" | "script" | "shot" | "ip" | "work" | "assistant" | "batch" | "audio" | "check";
  /** Stable binding to a plan execution step; status and cost always come from IpRun / ip_plan_execution. */
  execution?: { executionId: string; stepId: string; runId?: string };
  /**
   * A result just landed and the box should take its shape once (docs/ip-studio-new-canvas-and-threads.md §6.2): the task's
   * `aspectRatio` right away, then the file's real size when `storageKey` loads; removed after that. Width stays, height is capped.
   */
  mediaFit?: { storageKey?: string; aspectRatio?: string };
  /** Display projection of the latest native check run on this node. */
  check?: StudioCheckResult;
  speechRequest?: StudioSpeechRequest;
  /** 上传时就说明白的用途：music 只出现在背景音乐的选择里，不进「人物声音」。 */
  audioRole?: "music";
  voiceProfile?: StudioVoiceProfile;
  lipSyncRequest?: StudioLipSyncRequest;
  lipSyncNormalized?: boolean;
  /** 智能优化的结果有提示（或没优化成），等用户选用优化稿还是原文生成；再次生成后清掉。 */
  promptReview?: { runId: string; failed?: boolean; message?: string; /** 模型回了内容但不是优化稿（如回复看不到素材）：text 是它的原话，不能当优化稿发给视频模型。 */ notRewritten?: boolean; /** 当时的生成输入（studioVideoInputKey）：卡片上的文字、素材、时长、画幅、模型变了就不再显示这次的选择 */ inputKey?: string } & Partial<StudioVideoPromptOptimization>;
  /** 上次是在「用优化稿 / 用原文」里选的（请求里没有 rewrite）：智能优化开关仍算开着。 */
  promptChoice?: "optimized" | "original";
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
  | { type: "approval"; approvalId: string; stage: StudioPlanStage; planFingerprint: string; scope: string[]; quotedCost: number; /** 卡上显示的预估（折后价加一般用量）。老卡没有，退回 quotedCost。 */ estimatedCost?: number; budgetCap: number; autoFixCap: number;
      billingSelection?: EnterpriseBillingSelection; status: "pending" | "approved" | "expired" | "superseded"; approvedMessageId?: string; executionId?: string; expiresAt?: string;
      /** What the server actually authorized (immutable once approved); the proposal fields above stay the quote. */
      approvedBudgetCap?: number; approvedAutoFixCap?: number; approvedAt?: string; approvedByMessageId?: string;
      /** Plan revision the approval bound (the thread's revision at confirmation). */
      approvedPlanRevision?: number;
      /** Set when a newer plan revision or a newer card replaced this pending card. */
      supersededAt?: string;
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
  /** A system note's one action: the chain ran out of credits, offer a recharge (personal or enterprise payer). */
  notice?: "recharge" | "recharge-enterprise";
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
/**
 * One conversation of this canvas in the assistant's 「历史对话」 (GET /v1/ip-studio/projects/{id}/conversations).
 * Java StudioDialogueDtos.ThreadSummary uses the same field names (docs/ip-studio-new-canvas-and-threads.md §3.2).
 */
export interface StudioDialogueThreadSummary {
  id: string;
  /** 显示名：第一条用户消息（压掉空白，最多 24 字，超出加「…」）；还没说过话是「新对话」。 */
  title: string;
  /** 从「从这里重新开始」分出来的那段才有。 */
  parentThreadId?: string;
  messageCount: number;
  /** 最后一条消息时间与这段对话创建时间取较晚的那个（刚分出来的分支因此排在原对话前面）；ISO 8601。 */
  lastActivityAt: string;
  createdAt: string;
  /** 是不是 GET /conversation 现在返回的那段（最近打开的）。 */
  current: boolean;
  /** 有回合正在回复，或有执行在跑 / 暂停中。 */
  active: boolean;
}
/** POST /v1/ip-studio/projects/{id}/conversations: a new empty conversation (an unused empty one is reused). Same key, same result. */
export interface StudioCreateThreadRequest { clientRequestId: string }

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
/** A stage's production budget; dialogue turns are billed on their own and are not part of it (2026-10-23). */
export interface StudioBudgetUpdateData { executionId: string; stage: StudioPlanStage; approvedCap: number; spent: number; inFlight: number; remaining: number; shortfall?: number; source: "actual" | "quote" }
export interface StudioTurnDoneData { reason: "completed" | "waiting_user" | "handed_off" | "interrupted" | "failed"; messageId: string; billing?: StudioTokenBilling; settling?: boolean; suggestions?: string[] }

export type StudioPlanExecutionStatus = "running" | "paused" | "needs_user" | "done" | "partial" | "failed" | "canceled";
export type StudioPlanExecutionStepStatus = "pending" | "submitted" | "running" | "done" | "failed" | "skipped" | "needs_user";
export interface StudioPlanExecutionStep { id: string; title: string; operation: StudioPlanOperation; stage: StudioPlanStage; dependsOn: string[]; status: StudioPlanExecutionStepStatus;
  runIds: string[]; attempt: number; quotedCost: number; maxCost?: number; acceptedRunId?: string; acceptedCandidateIndex?: number;
  /** The canvas node this step's result goes to: the prepared object it was bound to at confirmation, else its own output node. */
  nodeId?: string; reason?: string; errorCode?: string;
  /** A stopped plan-compile step: canvas objects its plan used that this execution does not carry (the user adds them or re-plans without). */
  materials?: StudioPlanExecutionMaterial[] }
/** A canvas object a stopped step named outside the execution's materials; `onCanvas: false` once it was deleted. */
export interface StudioPlanExecutionMaterial { nodeId: string; title: string; onCanvas: boolean }
export interface StudioPlanExecutionBudget { stage: StudioPlanStage; approvedCap: number; autoFixCap: number; spent: number; inFlight: number; remaining: number; shortfall?: number }
export interface StudioPlanExecution {
  id: string; projectId: string; threadId?: string; skillKey: string; skillVersion: number; stage: StudioPlanStage; planRunId: string; planRevision: number; planFingerprint: string;
  status: StudioPlanExecutionStatus; steps: StudioPlanExecutionStep[]; budgets: StudioPlanExecutionBudget[]; billing?: EnterpriseBillingSelection; needsUserReason?: string;
  startedAt: string; deadlineAt: string; updatedAt: string; finishedAt?: string;
}
/** Create an analysis execution, or confirm a new stage on the same execution (executionId + approachId + expectedRevision). */
export interface StudioPlanExecutionCreateRequest { clientRequestId: string; stage: StudioPlanStage; planRunId: string; planFingerprint: string; approachId?: string; budgetCap: number; autoFixCap: number;
  billing?: EnterpriseBillingSelection; executionId?: string; expectedRevision?: number; approvalId?: string; confirmationMessageId?: string }
export interface StudioPlanExecutionControlRequest { clientRequestId: string; expectedStatus?: StudioPlanExecutionStatus;
  /** Resume only: add these objects (from the stopped step's `materials`, still on the canvas) before re-planning. */
  addMaterialNodeIds?: string[];
  /** Resume only: retry a reference-upload failure or portrait review timeout for the displayed attempt. */
  retryStepId?: string; retryAttempt?: number }
export interface StudioPlanExecutionAcceptRequest { clientRequestId: string; runId: string; candidateIndex?: number }

// ─── AI 视频页的长视频：比模型单段上限长，一键做到成片（docs/studio-segmented-video.md）───
/** 一份素材：草稿画布上的节点。slot：image 场景图 | character 出镜人物 | voice 声音。 */
export interface StudioSegmentedMaterial { nodeId: string; title: string; slot: "image" | "character" | "voice" }
export interface StudioSegmentedVideoRequest {
  clientRequestId: string; sceneId: string; text: string;
  /** text 是已经写好的脚本（采用了编导那一版），按它分段，不改台词。 */
  hasScript?: boolean;
  options?: Record<string, string>; language?: string; duration: number; ratio: string;
  /** 所选视频模型；不写用默认。 */
  model?: string; tier?: string; optimize?: boolean; materials: StudioSegmentedMaterial[];
  /** 用户看到的「最多」（StudioSegmentedVideoPrice.cap）；服务端重新报价，对不上 409 STUDIO_PRICE_CHANGED。 */
  budgetCap: number; billing?: EnterpriseBillingSelection;
}
/** 按钮旁的价。cap 比 estimated 多的是分镜图不合格时重出一次的余量；textCost 是脚本、审核和提示词优化的冻结上限，按实际用量结算。 */
export interface StudioSegmentedVideoPrice { segments: number[]; boards: number; boardReview: boolean; videoCost: number; boardCost: number; textCost: number; estimated: number; cap: number; discountedVideoCost?: number | null; videoDiscountName?: string | null }
/** 草稿里记的一条长视频。先记下请求再提交；没有 executionId 说明提交结果没确认，同一个请求编号再交一次会拿回原来那次。 */
export interface StudioSceneSegmentedRecord { clientRequestId: string; at: string; title: string; request: StudioSegmentedVideoRequest; executionId?: string }

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
  /** The current version as the runtime sees it (status = ip_skill.status, limits evaluated, triggers parsed); absent for prompt library entries. */
  skill?: StudioSkillSummary;
  /** Repository seed file name when this skill is seeded from resources/studio/skills/*.md or resources/studio/prompts/**. */
  seedFile?: string;
  /** 提示词库分层（docs/studio-prompt-architecture.md §2）：method 下 kind = workflow（制作做法）| content（内容方法）；target 只有环节有。 */
  layer?: StudioPromptLayer; kind?: "workflow" | "content"; target?: "llm" | "image-model" | "video-model" | "message";
}
export type StudioPromptLayer = "base" | "stage" | "method" | "scene";
/** POST /admin/studio/skills/preview：按调用点的方式拼一次，不调模型、不存东西。vars 缺省用调用点的示例。 */
export interface StudioPromptPreviewRequest { stage: string; method?: string; scene?: string; vars?: Record<string, unknown> }
export interface StudioPromptPreviewResult {
  stage: string; title: string; target: string; system: string; user: string;
  params: { temperature?: number; maxTokens?: number; jsonMode?: boolean };
  refs: { key: string; version: number }[];
  /** 代码生成的输出格式（只读）。 */
  formats: Record<string, string>;
  /** 调用点登记的变量和说明。 */
  variables: Record<string, string>;
  vars: Record<string, unknown>;
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
