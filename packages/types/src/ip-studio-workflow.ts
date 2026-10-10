import type { VideoStudioMode, VideoStudioReferenceInput } from "./video-studio";
/** Unified Studio operations. IpRun remains the single execution record. */
export interface StudioVideoSettings {
  mode: VideoStudioMode;
  resolutionTier: string;
  seed?: number;
  firstFrameKey?: string;
  lastFrameKey?: string;
  references?: VideoStudioReferenceInput[];
}
export type StudioOperation = "script" | "storyboard" | "image" | "video" | "assemble" | "assistant";
export interface StudioScriptSettings { genre?: string; fusionGenres?: string[]; characterBrief?: string; structure?: string; audience?: string; era?: string; core?: string; style?: string; episodeCount?: number; episodeDurationSec?: number }
export type StudioAssistantMode = "general" | "original" | "adapt" | "director";
/** Free document text extraction; the imported canvas node owns the resulting text. */
export interface StudioStoryImportResult { text: string; format: "pdf" | "doc" | "docx" }
export interface StudioTurn { role: "user" | "assistant"; content: string }
export interface StudioPlan {
  notes?:string[]; summary: string; steps: {id:string;operation:"script"|"storyboard"|"image"|"video";title:string;prompt:string;referenceNodeIds:string[];unresolvedReferences?:string[]}[]; questions: string[] }
export interface StudioReference {
  ipId?: string;
  avatarId?: string;
  lookId?: string;
  version?: number;
  storageKey: string;
  role: "character" | "scene" | "product" | "frame" | "clip";
}
export interface StudioRunRequest {
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
  mode?: StudioAssistantMode;
  contextNodeIds?: string[];
  /** Read selected images and four sampled video frames; never an audio-understanding promise. */
  readVisuals?: boolean;
  history?: StudioTurn[];
  /** Full document for the in-editor revision path; ordinary assistant plans are unchanged. */
  scriptEdit?: { markdown: string };
  /** A ceiling, never a caller-defined price. Rejected before any freeze if the price increases. */
  maxCost?: number;
  packaging?: StudioPackaging;
  video?: StudioVideoSettings;
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
}
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
  textModels?: { endpointId: string; name: string; isDefault: boolean; supportsVision?: boolean; creditCost?: number }[];
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
  /** Template copies use ordinary canvas inputs; constraints are checked when a connected node generates. */
  templateInput?: { required: boolean; label: string; options?: string[] };
  /** Authored video defaults for an ordinary copied node; contains no input media or task identity. */
  videoPreset?: Pick<StudioVideoSettings, "mode" | "resolutionTier" | "seed">;
  /** Display projection refreshed from IpRun; never used as execution or queue authority. */
  task?: { status: "running" | "done" | "failed"; stage: string; pct: number; errorCode?: string;
    queue?: import('./ai-model-concurrency').AiGenerationQueuePosition | null };
  workDraft?: StudioWorkDraft;
  speechDraft?: Omit<StudioSpeechRequest,'clientRequestId'|'nodeId'|'maxCost'>;
  /** Client-owned editor draft, separate from the immutable accepted run request. */
  composerDraft?: { operation: StudioOperation; prompt: string; referenceNodeIds: string[]; connectedReferenceNodeIds?: string[]; aspectRatio: string; model?: string;
    count: number; durationSec: number; settings: StudioScriptSettings; pasteScript?: boolean;
    episodeNo?: number; rewriteScope?: StudioNodeMetadata['rewriteScope'];
    scriptMode?: "original" | "adapt"; scriptSourceNodeId?: string;
    video: { mode: VideoStudioMode; tier: string; seed?: number; firstId?: string; lastId?: string } };
  kind: "script" | "shot" | "ip" | "work" | "assistant" | "batch" | "audio";
  speechRequest?: StudioSpeechRequest;
  voiceProfile?: StudioVoiceProfile;
  lipSyncRequest?: StudioLipSyncRequest;
  lipSyncNormalized?: boolean;
  settings?: StudioScriptSettings;
  scriptMode?: "original" | "adapt";
  scriptSourceNodeId?: string;
  episodeNo?: number;
  conversation?: { mode: StudioAssistantMode; turns: StudioTurn[]; plan?: StudioPlan };
  /** Client-owned rollback snapshot; model request.history is only a bounded context. */
  assistantPreviousConversation?: NonNullable<StudioNodeMetadata["conversation"]>;
  batch?: StudioBatch;
  script?: StudioScript;
  /** Markdown is canonical after editor save; script is its downstream structured projection. */
  scriptMarkdown?: string;
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
  clientRequestId: string; nodeId: string; model: string; text: string; speaker: string;
  instruct?: string; maxCost: number; avatarId?: string; voiceId?: string;
}
export interface StudioSpeechCatalog {
  models: { endpointId: string; name: string; isDefault: boolean; creditCost: number | null; creditCostPerSecond?: number | null }[];
  voices: { speaker: string; name: string; language: string; description: string }[];
  maxTextLength: number; maxInstructLength: number;
}

export interface StudioLipSyncInput { model:string;videoStorageKey:string;audioStorageKey:string }
export interface StudioLipSyncRequest extends StudioLipSyncInput { clientRequestId:string;nodeId:string;maxCost:number }
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
