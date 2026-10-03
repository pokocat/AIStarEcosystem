// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/contract.ts —— 画布前端各块之间的接口（v0.198，主模型定义；设计真源 docs/drama-canvas-plan.md §6）。
//
// 分工：core（本目录，web-core）实现这里声明的一切；script / assets / board / episodes 四块只通过这里读写文档、发起生成。
// 规矩：
// - 文档唯一真值在 CanvasDocProvider（[canvasId]/layout.tsx 挂一次，四屏共用）。组件**只通过 update() 改文档**，
//   不要自己存一份副本再整份写回（两份真值会打架）。
// - 所有生成都走 useCanvasRuns().submit()：它先 flush() 保存，保存失败 / 版本冲突就不发请求；
//   发出去后把 run ref 写进文档、轮询、合并结果、保存。卡片只管调 submit 和读 runFor(target)。
// - 合并规则全在 merge.ts（纯函数、幂等、有单测）；组件里不许再写一份「把结果塞进文档」的逻辑（§8.0.1 ④）。
// - 价格一律从 useCanvasPricing() 拿，按钮上写本次价格；不要在组件里写死数字。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CanvasAssembleRunBody,
  CanvasImageBatchBody,
  CanvasImageRatio,
  CanvasImageRunBody,
  CanvasRunBase,
  CanvasScriptRunBody,
  CanvasStoryboardRunBody,
  CanvasVideoRunBody,
  DramaCanvasDoc,
  DramaCanvasRatio,
  DramaCanvasRun,
  DramaCanvasRunTarget,
} from "@ai-star-eco/types/drama-canvas";

// ── 文档 ─────────────────────────────────────────────────────────────────────

/**
 * loading：还没拿到服务端文档（此时**不许渲染任何可编辑界面**，否则空文档自动保存会覆盖服务端）
 * ready：正常
 * stale：保存时 409（别的页面改过），自动保存已停；readOnly=true，界面给「载入最新」（调 reload）
 * not-found / error：打不开
 */
export type CanvasDocStatus = "loading" | "ready" | "stale" | "not-found" | "error";

export type CanvasSaveState = "saved" | "dirty" | "saving" | "failed";

export type FlushResult = { ok: true; docVersion: string } | { ok: false; reason: "failed" | "stale" };

export interface CanvasMeta {
  title: string;
  ratio: DramaCanvasRatio;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasDocValue {
  canvasId: string;
  status: CanvasDocStatus;
  /** status=error 时给用户看的话。 */
  errorMessage?: string;
  meta: CanvasMeta;
  /** status=loading / not-found / error 时是一份空文档，不要拿来渲染编辑界面。 */
  doc: DramaCanvasDoc;
  /** 事件回调里读最新文档用它，别用闭包里的 doc。 */
  getDoc: () => DramaCanvasDoc;
  /** 最近一次保存成功的版本。 */
  docVersion: string;
  saveState: CanvasSaveState;
  /** 函数式改文档（基于最新值）；触发 900ms 防抖保存。readOnly 时忽略。 */
  update: (updater: (doc: DramaCanvasDoc) => DramaCanvasDoc) => void;
  /** 改标题（随下一次保存一起带上）。 */
  rename: (title: string) => void;
  /** 立刻保存（跳过防抖）。生成前由 useCanvasRuns 调，组件一般不用直接调。 */
  flush: () => Promise<FlushResult>;
  /** 丢掉本地改动，重新从服务端拉（stale 时的「载入最新」）。 */
  reload: () => Promise<void>;
  readOnly: boolean;
}

// 实现：canvas/core/use-canvas-doc.tsx 导出 CanvasDocProvider({ canvasId, children }) 与 useCanvasDoc(): CanvasDocValue
//（Provider 外调用直接 throw）。

// ── 生成 ─────────────────────────────────────────────────────────────────────

type Body<T extends CanvasRunBase> = Omit<T, keyof CanvasRunBase>;

/** submit 的入参：kind + 去掉 clientRequestId / docVersion 的请求体（这两个由 core 填）。 */
export type CanvasRunRequest =
  | { kind: "script"; body: Body<CanvasScriptRunBody> }
  | { kind: "extract"; body: Record<string, never> }
  | { kind: "image"; body: Body<CanvasImageRunBody> }
  | { kind: "image-batch"; body: Body<CanvasImageBatchBody> }
  | { kind: "storyboard"; body: Body<CanvasStoryboardRunBody> }
  | { kind: "video"; body: Body<CanvasVideoRunBody> }
  | { kind: "assemble"; body: Body<CanvasAssembleRunBody> };

export type SubmitResult =
  | { ok: true; runs: DramaCanvasRun[] }
  /** save-failed / stale：没发请求、没花钱。rejected：服务端拒了（余额不足、归属闸、锁住的集…），message 是给用户看的话。 */
  | { ok: false; reason: "save-failed" | "stale" | "rejected"; errorCode?: string; message: string };

export interface CanvasRunsValue {
  submit: (req: CanvasRunRequest) => Promise<SubmitResult>;
  /** 某个目标当前在跑的、或最近一次的运行（给卡片显示进度 / 失败原因 / refs.notes）。 */
  runFor: (target: DramaCanvasRunTarget) => DramaCanvasRun | undefined;
  /** 取消排队中的；已开始的服务端 409，core 把 message 用 toast 报出来。 */
  cancel: (runId: string) => Promise<void>;
  /** 所有 queued / running 的运行。 */
  pending: DramaCanvasRun[];
  /**
   * 这个目标是否有请求**正在提交**（POST 还没回来，此时还没有 runFor 可看）。花钱的按钮要把它和
   * runFor 的 queued / running 一起算作「生成中」来禁用。core 自己也按目标去重：提交中再点一次同一目标，
   * 直接返回第一次的那个 Promise，不会发第二个请求（Codex 评审 P1：连点两次 = 两个幂等键 = 扣两份）。
   */
  isSubmitting: (target: DramaCanvasRunTarget) => boolean;
  /**
   * 按顺序逐个提交一批（「写全部分集剧本」「为选中的 N 集生成分镜脚本」「生成选中的 N 个视频」都用它，
   * **不许**在组件里自己 for 循环调 submit —— Codex 复审 P1：循环只锁当前那一项，后面的目标还能被单独点一次，
   * 轮到它时再生成一次 = 扣两份）。
   * - 一进来就把整批目标都登记为「提交中」（isSubmitting 对它们都返回 true），直到轮到并提交完或被跳过；
   * - 每一项发出前重新核对：这个目标此刻有提交中的请求、或 runFor 是 queued / running → 跳过（结果里记 skipped）；
   * - stopOnError=true（默认）时，遇到 ok:false 就停，剩下的解除登记、记 skipped。
   * - awaitEach=true：一项受理之后**等它跑完**（运行到终态、结果已合进文档）再发下一项 —— 下一项发之前的 flush()
   *   会把上一项的结果存上，服务端读到的文档里就有它（写全部分集剧本：后一集要接上一集的结尾）。
   *   上一项没成功（failed / canceled）且 stopOnError → 停下，剩下的记 skipped，这一项的结果仍是 ok:true，
   *   runs 是**终态**的那几条（调用方看 status 判断）。等的途中离开画布 / 换画布 / 文档进了 stale：
   *   不再等、不再发，剩下的记 skipped（stopped=true），这一项的 runs 是最后知道的状态。
   *   awaitEach 下 ok:true 的结果里 runs 都是等完之后的状态；不 awaitEach 时是刚受理时的状态。
   * - onProgress(index, total)：轮到第 index 项（从 0 数）、发出之前调一次（界面写「正在写第 2 / 3 集」）。
   * 返回与 reqs 一一对应的结果。skipped 项的 stopped=true 表示「因为前面停下了才没发」，否则是「已经在生成，跳过」。
   */
  submitSequence: (
    reqs: CanvasRunRequest[],
    opts?: { stopOnError?: boolean; awaitEach?: boolean; onProgress?: (index: number, total: number) => void },
  ) => Promise<SequenceItemResult[]>;
}

/** submitSequence 每一项的结果。 */
export type SequenceItemResult = SubmitResult | { ok: false; reason: "skipped"; message: string; stopped?: boolean };

// 实现：canvas/core/use-canvas-runs.tsx 导出 CanvasRunsProvider（挂在 CanvasDocProvider 里面）与 useCanvasRuns(): CanvasRunsValue。
// 进页时按文档里所有非终态的 run ref 自动接回（GET runs?ids=），刷新不丢。

/** 生成目标的拼法（和服务端同一套字符串）。 */
export const RunTarget = {
  scriptSetting: "script:setting" as const,
  scriptOutline: "script:outline" as const,
  scriptEpisode: (no: number) => `script:episode:${no}` as const,
  extract: "extract" as const,
  look: (id: string) => `look:${id}` as const,
  scene: (id: string) => `scene:${id}` as const,
  material: (id: string) => `material:${id}` as const,
  frame: (episodeNo: number, segmentId: string) => `frame:${episodeNo}:${segmentId}` as const,
  storyboard: (episodeNo: number) => `storyboard:${episodeNo}` as const,
  video: (episodeNo: number, segmentId: string) => `video:${episodeNo}:${segmentId}` as const,
  assemble: (episodeNo: number) => `assemble:${episodeNo}` as const,
};

// ── 价格 ─────────────────────────────────────────────────────────────────────

export interface CanvasModelOption {
  endpointId: string;
  name: string;
  isDefault: boolean;
  creditCost: number;
  billingUnit: "per_call" | "per_second";
  /** 视频：单条最长秒数（null = 未知，按 10 算）。 */
  maxDurationSec: number | null;
  /** 视频：单条最短秒数（null = 未知，按 1 算）。 */
  minDurationSec: number | null;
  /** 视频：是否看首帧（图生视频）。未知按 true，跑完以服务端 refs.notes 为准。 */
  acceptsFirstFrame: boolean;
}

export interface CanvasPricingValue {
  ready: boolean;
  imageModels: CanvasModelOption[];
  videoModels: CanvasModelOption[];
  /** 当前选中的视频模型（单集编辑器顶栏选；存 localStorage，按画布记）。 */
  videoModelId: string | undefined;
  setVideoModelId: (id: string) => void;
  /**
   * 当前选中的出图模型（出图面板、列表批量出图、片段「出首帧」**共用这一个选择**；存 localStorage
   * `drama-canvas:image-model:<canvasId>`，按画布记）。存的那个还在候选里就用它，否则用默认模型。
   * 发请求时一律带上它（endpointId），不要不带 —— 不带 = 后台默认模型，用户在别处选的不生效。
   */
  imageModelId: string | undefined;
  setImageModelId: (id: string) => void;
  confirmThreshold: number;
  scriptPrice: (stage: "setting" | "outline" | "episode") => number;
  extractPrice: () => number;
  storyboardPrice: () => number;
  /** 出图：单价 × 张数（endpointId 缺省 = 当前选中的出图模型）。 */
  imagePrice: (count: number, endpointId?: string) => number;
  /** 视频：按秒计费的端点 = 单价 × 秒数，按次的 = 单价。 */
  videoPrice: (durationSec: number, endpointId?: string) => number;
  /** 当前视频模型的片段时长上限（秒）。 */
  maxSegmentSec: () => number;
  /** 当前视频模型的片段时长下限（秒；不知道时 1）。 */
  minSegmentSec: () => number;
}

// 实现：canvas/core/use-canvas-pricing.tsx 导出 useCanvasPricing(): CanvasPricingValue（读 getDramaConfig + render models，模块级缓存）。

// ── 纯函数（canvas/core/refs.ts、merge.ts、doc-ops.ts；都要有单测）────────────────────────────

/** 片段文本里的一个引用（@[名字](look:id)）。 */
export interface SegmentRef {
  kind: "look" | "scene" | "material";
  id: string;
  label: string;
  /** 在原文里的位置 [start, end)。 */
  start: number;
  end: number;
}

/** 片段文本按行解析出的一个镜头：「（4 秒）……」。没写时长的行并进上一镜。 */
export interface SegmentShot {
  durationSec: number | null;
  text: string;
}

// refs.ts：
//   REF_PATTERN（与服务端同一个正则，见 drama-canvas.ts CanvasSegment 注释）
//   parseRefs(text): SegmentRef[]
//   formatRef(kind, id, label): string
//   stripRefs(text): string                       —— 把标记换成显示名（预览 / 复制用）
//   parseShots(text): SegmentShot[]
//   totalDuration(text): number                   —— 各镜时长之和（没写的按 0）；UI 用它同步 segment.durationSec
//
// merge.ts（全部 (doc, ...) => doc，幂等，不改入参）：
//   applyRunRef(doc, run)                         —— 把 {runId,status} 写到 run.target 对应的位置
//   applyRunResult(doc, run)                      —— run 终态时合并结果（succeeded）或只更新状态（failed / canceled）
//   pushScriptHistory(doc, label)                 —— 剧本存一版（最多 10 版）；「通过」和 AI 覆盖正文前都要调
//
// doc-ops.ts（常用编辑，给四块共用，避免各写一份）：
//   emptyDoc(): DramaCanvasDoc
//   pickedImage(set) / pickedVideo(set)           —— 挑中的那一版（缺省第一版）
//   findLook(doc, lookId) → { character, look } | null
//   findScene / findMaterial / findEpisode(doc, no) / findSegment(doc, no, segId)
//   addCharacter(doc, name) → { doc, characterId, lookId }
//   addLook(doc, characterId, name?) → { doc, lookId }
//   addScene(doc, name) / addMaterial(doc, kind) → { doc, id }
//   removeLook / removeCharacter / removeScene / removeMaterial（连带删掉相关连线与 positions）
//   setPicked(doc, target, key)                   —— 挑图 / 挑视频版本（target 同 RunTarget 的 look/scene/material/frame/video）
//   ensureEpisode(doc, no) / insertSegment(doc, no, index) / removeSegment(doc, no, segId) / updateSegment(doc, no, segId, patch)
//   episodeProgress(doc, no) → { segments, withVideo, assembledStale: boolean }
//   lookLabel(character, look) → 「林微·学生时期」（造型名是「基础造型」时只显示角色名）
//
// 【实现所在（web-core 补的注释）】以上全部从 `@/canvas/core`（index.ts）导出，对照表在 index.ts 头注释。
//   返回值约定：findSegment → CanvasSegment | null；insertSegment → { doc, segmentId }（新片段要选中）；
//   removeLook 删的是最后一个造型时连角色一起删；updateSegment 改 text 且没给 durationSec 时按 totalDuration 同步。
//   另外补了：restoreScriptVersion（merge.ts）、collectRunRefs / runRefAt / isTerminalStatus（merge.ts）、
//   parseRunTarget / canvasStep / map* / stripAssetUrls（doc-ops.ts）。

// ── 共享组件（assets 块实现，board 块复用）────────────────────────────────────

/** 出图面板：选中造型 / 场景 / 素材图时停在屏幕下方（画布）或抽屉里（列表 / 手机）。 */
export interface AssetGenPanelProps {
  target: { kind: "look"; id: string } | { kind: "scene"; id: string } | { kind: "material"; id: string };
  /** docked = 画布底部停靠；inline = 放在详情抽屉 / 弹窗里。 */
  variant: "docked" | "inline";
  onClose?: () => void;
  /** 「+ 上传参考」上传完之后：board 负责把新素材放到目标旁边并连线（inline 时不传，面板自己只加素材 + 连线、不管位置）。 */
  onReferenceAdded?: (materialId: string) => void;
}
// 实现：canvas/assets/asset-gen-panel.tsx 导出 AssetGenPanel。

export interface LookDetailDialogProps {
  lookId: string;
  open: boolean;
  onClose: () => void;
}
// 实现：canvas/assets/look-detail-dialog.tsx 导出 LookDetailDialog（造型详情：候选图挑主图 / 上传、角色名、造型名、出现集数、外貌描述）。

/** 默认画幅：造型 9:16（全身立绘）；场景、素材跟画布。 */
export function defaultImageRatio(kind: "look" | "scene" | "material", canvasRatio: DramaCanvasRatio): CanvasImageRatio {
  return kind === "look" ? "9:16" : canvasRatio;
}
