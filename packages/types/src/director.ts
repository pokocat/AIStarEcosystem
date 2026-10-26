// AI 导演台（docs/ai-director-plan.md v1.1）。作品内容由服务端拥有；这里是 wire 形状。
// 媒体只在服务端存 key，出 wire 时附带短期签名的 url。
import type { StudioCapabilities } from "./ip-studio-workflow";

export type DirectorAssetKind = "character" | "scene" | "prop";
export type DirectorAspectRatio = "9:16" | "16:9" | "1:1";

export interface DirectorSettings {
  style: string;
  aspectRatio: DirectorAspectRatio;
  language: string;
  /** 所有文字任务用的模型；null 或缺省 = 后台默认。 */
  textModel?: string | null;
  /** 片段视频用的模型；null = 后台默认。 */
  videoModel: string | null;
}

export interface DirectorError {
  message: string;
  at: string;
  task?: string;
}

export interface DirectorRefUsed {
  assetId: string;
  name: string;
  label: string;
  key: string;
  url?: string | null;
}

export interface DirectorMedia {
  id: string;
  key: string;
  url?: string | null;
  runId: string | null;
  source: "generated" | "upload" | "library";
  createdAt: string;
  prompt?: string;
  refs?: DirectorRefUsed[];
  /** 测试响应生成，不是真实模型产物。 */
  mock?: boolean;
  /** 生成时的输入指纹，用来核对是否跟当前设置一致。 */
  fingerprint?: string;
  /** 生成期间改过设置，按旧设置生成；不会自动使用。 */
  stale?: boolean;
}

export interface DirectorMediaSlot {
  candidates: DirectorMedia[];
  adoptedId: string | null;
  /** auto = 系统自动填上、等用户确认；user = 用户选的或确认过。 */
  adoptedBy: "user" | "auto" | null;
  error: DirectorError | null;
  /** 当前采用的版本跟现在的设置是否一致：outdated = 按旧设置生成的；unknown = 生成时没留下可核对的记录。 */
  adoptedCheck?: "current" | "outdated" | "unknown" | null;
  /** outdated 时具体哪里变了（如「角色新绑了声音」「镜头、台词或提示词改了」）。 */
  staleReasons?: string[];
  /** 只有片段视频有：已交给视频模型、还在生成的原生任务。 */
  pending?: Array<{ jobId: string; at: string; stage: string; pct: number }>;
}

/** 角色的声音参考：真实音频样本，只在出片段视频时交给模型。 */
export interface DirectorVoice {
  key: string;
  url?: string | null;
  name: string;
  source: "upload" | "library";
  durationSec: number | null;
  voiceId: string | null;
  at: string;
}

export interface DirectorExport {
  id: string;
  episodeId: string;
  episodeNo: number;
  status: "running" | "done" | "failed";
  key: string | null;
  url?: string | null;
  durationSec: number | null;
  error: string | null;
  createdAt: string;
  /** 导出时用的每个片段视频版本；和现在采用的不一致就说明成片是旧的。 */
  clips: Array<{ clipId: string; candidateId: string }>;
}

export interface DirectorPlannedClip {
  title: string;
  summary: string;
  assetIds: string[];
  shots: Array<Omit<DirectorShot, "id" | "startSec" | "endSec">>;
}

export interface DirectorEpisode {
  id: string;
  no: number;
  title: string;
  summary: string;
  content: string;
  extracted: boolean;
  /** 正文在规划后改过，片段可能需要重新规划。 */
  planStale: boolean;
  planError: DirectorError | null;
  /** 规划期间用户改过片段，新计划没有直接替换，等用户决定。 */
  pendingPlan: { runId: string; at: string; clips: DirectorPlannedClip[] } | null;
  rev: number;
}

export interface DirectorAsset {
  id: string;
  kind: DirectorAssetKind;
  name: string;
  aliases: string[];
  description: string;
  prompt: string;
  promptCustom: boolean;
  episodeIds: string[];
  image: DirectorMediaSlot;
  voice: DirectorVoice | null;
  /** 角色音色的文字描述（如「女声，青年音色，语调中偏低，温柔清晰」）；没有参考音频时视频按它配音。 */
  voiceDesc?: string;
  /** 角色的形象参考照片（用户上传）：只在生成设定图时作为参考交给模型，不会直接当角色参考图用。 */
  refImage?: { key: string; url?: string | null } | null;
  /** 从个人资产库导入时记下的资产库对象 id；再导入同一项时据此对上，不重复建。 */
  libraryObjectId?: string;
  rev: number;
}

export interface DirectorLine {
  speakerId: string | null;
  text: string;
}

export interface DirectorShot {
  id: string;
  durationSec: number;
  startSec: number;
  endSec: number;
  size: string;
  camera: string;
  action: string;
  still: string;
  dialogue: DirectorLine[];
}

export interface DirectorClip {
  id: string;
  episodeId: string;
  order: number;
  title: string;
  summary: string;
  durationSec: number;
  assetIds: string[];
  shots: DirectorShot[];
  boardPrompt: string;
  boardPromptCustom: boolean;
  videoPrompt: string;
  videoPromptCustom: boolean;
  board: DirectorMediaSlot;
  video: DirectorMediaSlot;
  /** 需要用户修改才能出分镜图的问题（镜头太多、时长超出视频模型、引用对不上）。 */
  issues: string[];
  /** 分镜节奏的程序检查（镜头数、单镜时长、相邻景别、片段时长）：只是提示，不拦截出图 */
  warnings?: string[];
  /** 有台词但没绑声音参考的角色名：视频照样能生成，但跨片段音色不保证。 */
  unvoiced: string[];
  /** 有台词并且绑了声音的角色名。 */
  voiced?: string[];
  /** 当前视频模型不支持声音参考时，用户明确选了「不带声音参考生成」。声音绑定本身不删。 */
  videoWithoutVoice?: boolean;
  rev: number;
}

export type DirectorPipelineStatus = "running" | "waiting" | "paused" | "done" | "failed" | "stopped";

export interface DirectorPipeline {
  id: string;
  scope: "episode" | "work";
  episodeId: string | null;
  /** plan = 只做到分镜脚本（分集、资产、镜头与提示词，不出图）；film = 一路做到每集导出成片 */
  target: DirectorPipelineTarget;
  /** 全自动：资产清单、参考图、分镜图、片段视频都不停下来等确认 */
  auto?: boolean;
  status: DirectorPipelineStatus;
  /** confirm-assets / budget / fix-clips / failed-items / blocked / 进行中的阶段 */
  stage: string;
  message: string;
  budget: number;
  spent: number;
  startedAt: string;
  finishedAt?: string;
  runIds: string[];
  failed: string[];
}

export interface DirectorTask {
  id: string;
  /** script / split / extract[:ep] / plan:ep / asset:id / board:clip / video:clip / export:ep */
  target: string;
  status: "running" | "done" | "failed";
  stage: string | null;
  cost: number;
  errorMessage: string | null;
  createdAt: string | null;
}

export interface DirectorVideoModel {
  id: string;
  name: string;
  isDefault: boolean;
  minSec: number;
  maxSec: number;
  /** omni = 分镜板 + 参考图 + 声音一起交给模型；frame = 只按首帧出片（一镜一段，不带参考图和声音）。 */
  mode: "omni" | "frame";
}

export interface DirectorPendingExtractItem {
  itemId: string;
  kind: DirectorAssetKind;
  name: string;
  description: string;
  aliases: string[];
  episodeNos: number[];
  /** 对上的已有资产；保存时合并进它，不新建。 */
  matchId: string | null;
  matchName?: string;
}

export interface DirectorPendingExtract { runId: string; at: string; items: DirectorPendingExtractItem[] }

/** 剧本生成时一起写的整体故事大纲；导入的剧本和旧作品没有。 */
export interface DirectorOutline {
  world: string;
  characters: Array<{ name: string; age: string; identity: string; secret: string; flaw: string; arc: string }>;
  plot: string;
  reversals: string;
  theme: string;
}

export interface DirectorWork {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  idea: string;
  /** 剧本题材 / 调性（剧本页选的，空表示不限），决定编剧提示词追加哪组规则 */
  genre?: string | null;
  tone?: string | null;
  logline: string;
  outline?: DirectorOutline | null;
  /** 拆集之前的整份剧本；拆集后为空，正文在各集里。 */
  draft: string;
  draftRev: number;
  settings: DirectorSettings;
  episodes: DirectorEpisode[];
  assets: DirectorAsset[];
  clips: DirectorClip[];
  exports?: DirectorExport[];
  pipeline: DirectorPipeline | null;
  notice: { message: string; at: string } | null;
  /** 提取出来、还没保存进资产库的清单；用户勾选、改名后保存（extract.save）或不保存（extract.discard）。 */
  pendingExtract?: DirectorPendingExtract | null;
  /** 重新生成剧本前的旧稿，新的在前，最多 3 版；只读留底。 */
  scriptHistory?: { at: string; logline: string; draft: string }[];
  textError: DirectorError | null;
  tasks: DirectorTask[];
  pricing: { textMax: number; image: number; mock: boolean };
  textModels?: StudioCapabilities["textModels"];
  textModelMode?: StudioCapabilities["textModelMode"];
  videoModels: DirectorVideoModel[];
  videoLimits: { model: string | null; name: string; minSec: number; maxSec: number; mock: boolean; mode: "omni" | "frame"; maxShots: number } | null;
}

export interface DirectorWorkSummary {
  id: string;
  title: string;
  episodeCount: number;
  assetCount: number;
  clipCount: number;
  boardCount: number;
  videoCount: number;
  hasScript: boolean;
  running: boolean;
  updatedAt: string;
  coverUrl: string | null;
}

export type DirectorEditOp =
  | "draft.asEpisode" | "episode.update" | "episode.usePendingPlan" | "episode.discardPendingPlan"
  | "asset.create" | "asset.update" | "asset.delete" | "asset.adopt" | "asset.upload" | "assets.confirm"
  | "clip.update" | "clip.split" | "clip.delete" | "clip.adoptBoard" | "clip.confirmBoard" | "notice.dismiss"
  | "asset.setVoice" | "asset.clearVoice" | "asset.setRef" | "asset.clearRef" | "clip.adoptVideo" | "clip.confirmVideo" | "clips.confirmBoards" | "clip.setVoiceMode"
  | "extract.save" | "extract.discard" | "asset.import";

export type DirectorTaskType = "script" | "split" | "extract" | "plan" | "asset-image" | "board" | "video" | "export";
export type DirectorPipelineAction = "start" | "pause" | "resume" | "retry" | "confirm-assets" | "confirm-boards" | "confirm-videos" | "stop" | "dismiss";

export type DirectorPipelineTarget = "plan" | "board" | "video" | "film";

/** 一键制作的推荐预算：按作品现状和真实单价估算，还没规划的部分按默认篇幅估（rough=true）。 */
export interface DirectorPipelineEstimate {
  target: DirectorPipelineTarget;
  rough: boolean;
  total: number;
  recommended: number;
  text: { count: number; credits: number };
  images: { count: number; credits: number };
  videos: { included: boolean; clips: number; seconds: number; credits: number; error: string | null };
}

export interface DirectorQuote {
  items: Array<{ targetId: string; credits: number | null; error: string | null }>;
}

export interface DirectorAudioUpload {
  key: string;
  url: string | null;
  fileName: string;
  durationSec: number | null;
}
